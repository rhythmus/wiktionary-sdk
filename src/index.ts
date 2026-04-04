import type {
    WikiLang,
    FetchResult,
    Lexeme,
    DecodeContext,
    DecoderDebugEvent,
} from "./types";
import { SCHEMA_VERSION } from "./types";

import {
    fetchWikitextEnWiktionary,
    fetchWikidataEntity,
    fetchWikidataEntityByWiktionaryTitle,
    fetchWikidataEntityByWikipediaTitle,
} from "./api";
import {
    extractLanguageSection,
    extractAllLanguageSections,
    splitEtymologiesAndPOS,
    parseTemplates,
    mapHeadingToPos,
    langToLanguageName,
    languageNameToLang,
} from "./parser";
import {
    registry,
    isFormOfTemplateName,
    isVariantFormOfTemplateName,
} from "./registry";
import { deepMerge, commonsThumbUrl } from "./utils";
import { enrichFormOfMorphLinesFromParseBatch } from "./form-of-parse-enrich";

function wikidataSitelinkUrl(site: string | undefined, title: string | undefined): string | undefined {
    if (!site || !title || !site.endsWith("wiki")) return undefined;
    const lang = site.slice(0, -4);
    return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/**
 * Fetches and normalizes a Wiktionary entry into lexemes.
 *
 * @param options.query - The term to look up (e.g. `"γράφω"`)
 * @param options.lang - BCP-47 language code (e.g. `"el"`) or `"Auto"` (default)
 * @param options.pos - Optional POS filter (e.g. `"verb"`, `"noun"`) or `"Auto"` (default)
 * @param options.preferredPos - Optional POS filter for disambiguation (legacy, use pos)
 * @param options.enrich - Whether to fetch Wikidata enrichment (default `true`)
 * @param options.sort - Lexeme ordering strategy (default `"source"`):
 *   - `"source"`: preserve the order in which language sections and PoS blocks
 *     appear in the Wiktionary source markup.
 *   - `"priority"`: apply a hardcoded language-priority heuristic (el > grc > en),
 *     then sort alphabetically within the same priority tier. Useful when the
 *     caller wants Modern Greek results first regardless of source order.
 * @returns A {@link FetchResult} containing normalized lexemes and raw wikitext
 */
export async function wiktionary(
    opts: {
        query: string;
        lang?: WikiLang;
        pos?: string;
        preferredPos?: string;
        enrich?: boolean;
        debugDecoders?: boolean;
        sort?: "source" | "priority";
        matchMode?: "strict" | "fuzzy";
    }
): Promise<FetchResult> {
    const normalizedOpts = {
        ...opts,
        lang: opts.lang || "Auto",
        pos: opts.pos || "Auto",
        sort: opts.sort || "source",
        matchMode: opts.matchMode || "strict",
    };

    const runSingle = async (query: string): Promise<FetchResult> => {
        const visited = new Set<string>();
        return wiktionaryRecursive({
            ...normalizedOpts,
            query,
            _visited: visited,
        });
    };

    if (normalizedOpts.matchMode === "strict") {
        return runSingle(normalizedOpts.query);
    }

    const variants = buildFuzzyQueryVariants(normalizedOpts.query);
    const results: Array<{ query: string; result: FetchResult }> = [];
    for (const q of variants) {
        results.push({ query: q, result: await runSingle(q) });
    }

    const mergedLexemes: Lexeme[] = [];
    const mergedDebug: DecoderDebugEvent[][] = [];
    const seenLexemeIds = new Set<string>();
    const notes: string[] = [];
    let rawLanguageBlock = "";
    let metadata: FetchResult["metadata"] | undefined;
    const includeDebug = Boolean(normalizedOpts.debugDecoders);

    for (const { query, result } of results) {
        if (!rawLanguageBlock && result.rawLanguageBlock) rawLanguageBlock = result.rawLanguageBlock;
        if (!metadata && result.metadata) metadata = result.metadata;
        if (result.notes.length) notes.push(...result.notes);

        const debugRows = result.debug ?? [];
        result.lexemes.forEach((lex, idx) => {
            if (seenLexemeIds.has(lex.id)) return;
            seenLexemeIds.add(lex.id);
            mergedLexemes.push(lex);
            if (includeDebug) mergedDebug.push(debugRows[idx] ?? []);
        });

        if (query !== normalizedOpts.query && result.lexemes.length > 0) {
            notes.push(`Fuzzy match: included ${result.lexemes.length} lexeme(s) from variant query "${query}".`);
        }
    }

    if (mergedLexemes.length === 0) {
        notes.push(`No strict or fuzzy variants matched for "${normalizedOpts.query}".`);
    }

    const out: FetchResult = {
        schema_version: SCHEMA_VERSION,
        rawLanguageBlock,
        lexemes: mergedLexemes,
        notes,
        metadata,
    };
    if (includeDebug) out.debug = mergedDebug;
    return out;
}

/** NFD + strip Unicode marks (macrons, etc.); NFC. Matches common en.wiktionary title normalization. */
export function stripCombiningMarksForPageTitle(s: string): string {
    return s.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

function buildFuzzyQueryVariants(query: string): string[] {
    const nfc = query.normalize("NFC");
    const stripDiacritics = stripCombiningMarksForPageTitle;
    const variants = [
        nfc,
        nfc.toLocaleLowerCase(),
        stripDiacritics(nfc),
        stripDiacritics(nfc).toLocaleLowerCase(),
    ].filter((v) => v.trim().length > 0);
    return [...new Set(variants)];
}

function lemmaKey(lang: WikiLang, lemma: string) {
    return `${lang}:${lemma}`;
}

/**
 * Core engine: fetches, parses, and decodes a term recursively resolving lemmas.
 * @internal
 */
export async function wiktionaryRecursive({
    query,
    lang = "Auto",
    pos = "Auto",
    preferredPos,
    enrich = true,
    debugDecoders = false,
    sort = "source",
    _visited,
}: {
    query: string;
    lang?: WikiLang;
    pos?: string;
    preferredPos?: string;
    enrich?: boolean;
    debugDecoders?: boolean;
    sort?: "source" | "priority";
    _visited: Set<string>;
}): Promise<FetchResult> {
    query = query.normalize("NFC");
    const key = lemmaKey(lang, query);
    if (_visited.has(key)) {
        return {
            schema_version: SCHEMA_VERSION,
            rawLanguageBlock: "",
            lexemes: [],
            notes: [`Cycle detected: ${query} already visited in ${lang}.`],
        };
    }
    _visited.add(key);

    let qPage = await fetchWikitextEnWiktionary(query);
    let resolvedPageTitleNote: string | undefined;

    if (!qPage.exists) {
        const alt = stripCombiningMarksForPageTitle(query);
        if (alt !== query && alt.length > 0) {
            const altKey = lemmaKey(lang, alt);
            if (!_visited.has(altKey)) {
                const altPage = await fetchWikitextEnWiktionary(alt);
                if (altPage.exists) {
                    qPage = altPage;
                    _visited.add(altKey);
                    resolvedPageTitleNote = `Page title "${alt}" (retried without combining marks; no page for "${query}").`;
                }
            }
        }
    }

    if (!qPage.exists) {
        return {
            schema_version: SCHEMA_VERSION,
            rawLanguageBlock: "",
            lexemes: [],
            notes: [`No page found for ${query} on en.wiktionary.org (after redirects).`],
        };
    }

    let searchSections: Array<{ langName: string; lang: WikiLang; block: string }> = [];

    if (lang === "Auto") {
        const sections = extractAllLanguageSections(qPage.wikitext);
        for (const s of sections) {
            searchSections.push({
                langName: s.langName,
                lang: languageNameToLang(s.langName) || s.langName,
                block: s.block,
            });
        }
    } else {
        const languageName = langToLanguageName(lang);
        if (languageName === null) {
            return {
                schema_version: SCHEMA_VERSION,
                rawLanguageBlock: "",
                lexemes: [],
                notes: [`Unknown language code: ${lang}. No language section searched.`],
            };
        }
        const langBlock = extractLanguageSection(qPage.wikitext, languageName);
        if (langBlock) {
            searchSections.push({ langName: languageName, lang, block: langBlock });
        }
    }

    if (searchSections.length === 0) {
        return {
            schema_version: SCHEMA_VERSION,
            rawLanguageBlock: "",
            lexemes: [],
            notes: [
                lang === "Auto" 
                    ? `No language sections found on en.wiktionary.org for ${qPage.title}.`
                    : `No ${langToLanguageName(lang)} section found on en.wiktionary.org for ${qPage.title}.`,
            ],
        };
    }

    let lexemes: Lexeme[] = [];
    const allDebugEvents: DecoderDebugEvent[][] = [];

    for (const section of searchSections) {
        const etyms = splitEtymologiesAndPOS(section.block);
        for (const e of etyms) {
            for (const pb of e.posBlocks) {
                const mappedPos = mapHeadingToPos(pb.posHeading);

                if (pos !== "Auto") {
                    if (mappedPos !== pos && pb.posHeading.toLowerCase() !== pos.toLowerCase()) {
                        continue;
                    }
                }

                const templates = parseTemplates(pb.wikitext, true) as any[];
                const lines = pb.wikitext.split("\n");
                const lexemeType = guessLexemeTypeFromTemplates(templates);

                const ctx: DecodeContext = {
                    lang: section.lang,
                    query,
                    page: qPage,
                    languageBlock: section.block,
                    etymology: e,
                    posBlock: pb,
                    posBlockWikitext: pb.wikitext,
                    templates,
                    lines,
                };

                const result = registry.decodeAll(ctx, { debug: debugDecoders });
                const patch: any = typeof result === "object" && "patch" in result ? result.patch : result;
                const id = `${section.lang}:${qPage.title}#E${e.idx}#${slug(pb.posHeading)}#${lexemeType}`;

                const base: Lexeme = {
                    id,
                    language: section.lang,
                    query,
                    type: lexemeType,
                    form: qPage.title,
                    etymology_index: e.idx,
                    part_of_speech_heading: pb.posHeading,
                    templates: {},
                    source: {
                        wiktionary: {
                            site: "en.wiktionary.org",
                            title: qPage.title,
                            language_section: section.langName,
                            etymology_index: e.idx,
                            pos_heading: pb.posHeading,
                            revision_id: (qPage as any).info?.lastrevid ?? undefined,
                            last_modified: (qPage as any).info?.last_modified ?? undefined,
                            pageid: qPage.pageid ?? null,
                        },
                    },
                };

                deepMerge(base, patch.entry || {});

                if (debugDecoders && typeof result === "object" && "debug" in result && result.debug) {
                    allDebugEvents.push(result.debug);
                }
                base.templates_all = templates.map((t: any) => ({
                    name: t.name,
                    raw: t.raw,
                    params: t.params,
                    ...(t.start != null && { start: t.start, end: t.end, line: t.line }),
                }));

                if (!base.part_of_speech && mappedPos) {
                    base.part_of_speech = mappedPos;
                }

                base.form = qPage.title;
                
                const langName = section.langName;
                base.categories = (qPage as any).categories?.filter((c: string) => 
                    c.toLowerCase().includes(langName.toLowerCase()) || 
                    c.toLowerCase().includes("pages with")
                ) || [];
                base.langlinks = (qPage as any).langlinks || [];
                base.images = (qPage as any).images || [];
                base.page_links = (qPage as any).page_links || [];
                base.external_links = (qPage as any).external_links || [];
                base.metadata = {
                    last_modified: (qPage as any).info?.last_modified,
                    length: (qPage as any).info?.length,
                    pageid: (qPage as any).info?.pageid,
                };

                lexemes.push(base);
            }
        }
    }

    if (enrich) {
        await enrichFormOfMorphLinesFromParseBatch(lexemes, qPage.title);
    }

    const lemmaRequests: Array<{ lemma: string; lang: WikiLang; triggeredBy: string }> = [];
    for (const lex of lexemes) {
        const lm = lex.form_of?.lemma;
        const lemmaLang = lex.form_of?.lang ?? lex.language;
        if (lex.type === "INFLECTED_FORM" && lm) {
            const key = lemmaKey(lemmaLang, lm);
            if (!_visited.has(key)) {
                lemmaRequests.push({ lemma: lm, lang: lemmaLang, triggeredBy: lex.id });
            }
        }
    }
    const seen = new Set<string>();
    const uniqueRequests = lemmaRequests.filter((r) => {
        const key = `${r.lang}:${r.lemma}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const resolvedLexemes: Lexeme[] = [];
    const triggerMap = new Map<string, string>();
    for (const { lemma, lang: lLang, triggeredBy } of uniqueRequests) {
        triggerMap.set(`${lLang}:${lemma}`, triggeredBy);
    }
    const fetchPromises = uniqueRequests.map(async ({ lemma, lang: lLang }) => {
        const res = await wiktionaryRecursive({
            query: lemma,
            lang: lLang,
            pos,
            preferredPos,
            enrich,
            debugDecoders,
            sort,
            _visited,
        });
        let cands = res.lexemes.filter((l) => l.type === "LEXEME");
        cands.sort(
            (a, b) =>
                preferredPosSortKey(a.part_of_speech || "", preferredPos) -
                preferredPosSortKey(b.part_of_speech || "", preferredPos)
        );
        return cands[0] ? { lemma, lang: lLang, lexeme: cands[0] } : null;
    });
    const resolved = await Promise.all(fetchPromises);
    for (const r of resolved) {
        if (r) {
            const triggeredBy = triggerMap.get(`${r.lang}:${r.lemma}`);
            if (triggeredBy) {
                r.lexeme.lemma_triggered_by_lexeme_id = triggeredBy;
            }
            resolvedLexemes.push(r.lexeme);
        }
    }

    if (enrich) {
        let resolvedEntity: any = null;
        let resolvedQid: string | undefined;
        let fallbackAttempted = false;
        for (const lex of lexemes) {
            if (lex.type !== "LEXEME") continue;
            let qid = qPage.pageprops?.wikibase_item as string | undefined;
            if (!qid && resolvedQid) qid = resolvedQid;
            if (!qid && !fallbackAttempted) {
                fallbackAttempted = true;
                try {
                    resolvedEntity = await fetchWikidataEntityByWiktionaryTitle(qPage.title);
                    if (!resolvedEntity?.id) {
                        resolvedEntity = await fetchWikidataEntityByWikipediaTitle(qPage.title);
                    }
                    resolvedQid = resolvedEntity?.id;
                    if (resolvedQid) qid = resolvedQid;
                } catch {
                    // best-effort fallback only
                }
            }
            if (!qid) continue;
            lex.wikidata = { qid };
            try {
                const wd = (resolvedEntity && resolvedEntity.id === qid) ? resolvedEntity : await fetchWikidataEntity(qid);
                if (wd) {
                    lex.wikidata.labels = wd.labels || {};
                    lex.wikidata.descriptions = wd.descriptions || {};
                    if (wd.sitelinks) {
                        const sitelinks: Record<string, any> = {};
                        for (const [key, value] of Object.entries(wd.sitelinks as Record<string, any>)) {
                            sitelinks[key] = {
                                ...value,
                                url: value?.url || wikidataSitelinkUrl(value?.site || key, value?.title),
                            };
                        }
                        lex.wikidata.sitelinks = sitelinks;
                    } else {
                        lex.wikidata.sitelinks = {};
                    }
                    const p18 = wd.claims?.P18;
                    if (Array.isArray(p18) && p18[0]?.mainsnak?.datavalue?.value) {
                        const filename = p18[0].mainsnak.datavalue.value;
                        lex.wikidata.media = {
                            P18: filename,
                            commons_file: `File:${filename}`,
                        };
                        lex.wikidata.media.thumbnail = commonsThumbUrl(filename, 420);
                    }
                    const p31 = wd.claims?.P31 ?? [];
                    lex.wikidata.instance_of = p31.map((c: any) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
                    
                    const p279 = wd.claims?.P279 ?? [];
                    lex.wikidata.subclass_of = p279.map((c: any) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
                }
            } catch (err: any) {
                (lex as any).wikidata_error = String(err?.message || err);
            }
        }
    }

    const merged = lexemes.concat(
        resolvedLexemes.map((rl) => ({ ...rl, resolved_for_query: query }))
    );

    if (preferredPos) {
        for (const lex of merged) {
            if (lex.type === "LEXEME" && lex.part_of_speech === preferredPos)
                lex.preferred = true;
        }
    }

    if (sort === "priority") {
        const LANG_PRIORITY: Record<string, number> = {
            el: 1,
            grc: 2,
            en: 3,
        };
        merged.sort((a, b) => {
            if (a.language !== b.language) {
                const pA = LANG_PRIORITY[a.language] || 100;
                const pB = LANG_PRIORITY[b.language] || 100;
                if (pA !== pB) return pA - pB;
                return a.language.localeCompare(b.language);
            }
            return a.part_of_speech_heading.localeCompare(b.part_of_speech_heading);
        });
    }

    const out: FetchResult = { 
        schema_version: SCHEMA_VERSION, 
        rawLanguageBlock: lang === "Auto" ? qPage.wikitext : (searchSections[0]?.block || ""), 
        lexemes: merged, 
        notes: resolvedPageTitleNote && debugDecoders ? [resolvedPageTitleNote] : [],
        metadata: {
            categories: (qPage as any).categories || [],
            langlinks: (qPage as any).langlinks || [],
            info: (qPage as any).info || {},
        }
    };
    if (debugDecoders && allDebugEvents.length > 0) {
        const padding = Array.from({ length: resolvedLexemes.length }, () => [] as DecoderDebugEvent[]);
        out.debug = allDebugEvents.concat(padding);
    }
    return out;
}

function guessLexemeTypeFromTemplates(templates: any[]) {
    for (const t of templates) {
        if (!isFormOfTemplateName(t.name)) continue;
        if (isVariantFormOfTemplateName(t.name)) return "FORM_OF";
        return "INFLECTED_FORM";
    }
    return "LEXEME";
}

function preferredPosSortKey(pos: string, pref?: string) {
    if (!pref) return 100;
    return pos === pref ? 0 : 50;
}

function slug(s: string) {
    return (s ?? "unknown")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

// Consolidate exports to avoid duplicates and lint errors
export * from "./library";
export * from "./formatter";
export * from "./lexeme-display-groups";
export * from "./stem";
export * from "./wrapper-invoke";
export type { GrammarTraits, ConjugateCriteria, DeclineCriteria } from "./morphology";
export type { WikiLang, LexemeType, Lexeme, LexemeResult, FetchResult, RichEntry, OnlyUsedIn } from "./types";
export { isFormOfTemplateName, isVariantFormOfTemplateName } from "./registry";
