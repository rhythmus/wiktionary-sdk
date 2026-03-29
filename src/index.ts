import type {
    WikiLang,
    FetchResult,
    Entry,
    DecodeContext,
    DecoderDebugEvent,
} from "./types";
import { SCHEMA_VERSION } from "./types";

import {
    fetchWikitextEnWiktionary,
    fetchWikidataEntity,
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
import { registry, FORM_OF_TEMPLATES, VARIANT_TEMPLATES } from "./registry";
import { deepMerge, commonsThumbUrl } from "./utils";

/**
 * Fetches and normalizes a Wiktionary entry.
 *
 * @param options.query - The term to look up (e.g. `"γράφω"`)
 * @param options.lang - BCP-47 language code (e.g. `"el"`) or `"Auto"` (default)
 * @param options.pos - Optional POS filter (e.g. `"verb"`, `"noun"`) or `"Auto"` (default)
 * @param options.preferredPos - Optional POS filter for disambiguation (legacy, use pos)
 * @param options.enrich - Whether to fetch Wikidata enrichment (default `true`)
 * @returns A {@link FetchResult} containing normalized entries and raw wikitext
 */
export async function wiktionary(
    opts: {
        query: string;
        lang?: WikiLang;
        pos?: string;
        preferredPos?: string;
        enrich?: boolean;
        debugDecoders?: boolean;
    }
): Promise<FetchResult> {
    const visited = new Set<string>();
    return wiktionaryRecursive({ 
        ...opts, 
        lang: opts.lang || "Auto", 
        pos: opts.pos || "Auto",
        _visited: visited 
    });
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
    _visited,
}: {
    query: string;
    lang?: WikiLang;
    pos?: string;
    preferredPos?: string;
    enrich?: boolean;
    debugDecoders?: boolean;
    _visited: Set<string>;
}): Promise<FetchResult> {
    query = query.normalize("NFC");
    const key = lemmaKey(lang, query);
    if (_visited.has(key)) {
        return {
            schema_version: SCHEMA_VERSION,
            rawLanguageBlock: "",
            entries: [],
            notes: [`Cycle detected: ${query} already visited in ${lang}.`],
        };
    }
    _visited.add(key);

    const qPage = await fetchWikitextEnWiktionary(query);
    if (!qPage.exists) {
        return {
            schema_version: SCHEMA_VERSION,
            rawLanguageBlock: "",
            entries: [],
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
                entries: [],
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
            entries: [],
            notes: [
                lang === "Auto" 
                    ? `No language sections found on en.wiktionary.org for ${qPage.title}.`
                    : `No ${langToLanguageName(lang)} section found on en.wiktionary.org for ${qPage.title}.`,
            ],
        };
    }

    let entries: Entry[] = [];
    const allDebugEvents: DecoderDebugEvent[][] = [];
    const combinedLangBlock = searchSections.map(s => s.block).join("\n\n");

    for (const section of searchSections) {
        const etyms = splitEtymologiesAndPOS(section.block);
        for (const e of etyms) {
            for (const pb of e.posBlocks) {
                const mappedPos = mapHeadingToPos(pb.posHeading);

                // Apply POS filter if not Auto
                if (pos !== "Auto") {
                    if (mappedPos !== pos && pb.posHeading.toLowerCase() !== pos.toLowerCase()) {
                        continue;
                    }
                }

                const templates = parseTemplates(pb.wikitext, true) as any[]; // always withLocation for templates_all
                const lines = pb.wikitext.split("\n");
                const entryType = guessEntryTypeFromTemplates(templates);

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
                const id = `${section.lang}:${qPage.title}#E${e.idx}#${slug(pb.posHeading)}#${entryType}`;

                const base: Entry = {
                    id,
                    language: section.lang,
                    query,
                    type: entryType,
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
                
                // Attach metadata and filter categories
                const langName = section.langName;
                base.categories = (qPage as any).categories?.filter((c: string) => 
                    c.toLowerCase().includes(langName.toLowerCase()) || 
                    c.toLowerCase().includes("pages with") // e.g. "Pages with 3 entries"
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

                entries.push(base);
            }
        }
    }

    // Lemma resolution with cycle protection
    const lemmaRequests: Array<{ lemma: string; lang: WikiLang; triggeredBy: string }> = [];
    for (const ent of entries) {
        const lemma = ent.form_of?.lemma;
        const lemmaLang = ent.form_of?.lang ?? ent.language;
        if (ent.type === "INFLECTED_FORM" && lemma) {
            const key = lemmaKey(lemmaLang, lemma);
            if (!_visited.has(key)) {
                lemmaRequests.push({ lemma, lang: lemmaLang, triggeredBy: ent.id });
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

    const lemmaEntries: Entry[] = [];
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
            _visited,
        });
        let cands = res.entries.filter((e) => e.type === "LEXEME");
        cands.sort(
            (a, b) =>
                preferredPosSortKey(a.part_of_speech || "", preferredPos) -
                preferredPosSortKey(b.part_of_speech || "", preferredPos)
        );
        return cands[0] ? { lemma, lang: lLang, entry: cands[0] } : null;
    });
    const resolved = await Promise.all(fetchPromises);
    for (const r of resolved) {
        if (r) {
            const triggeredBy = triggerMap.get(`${r.lang}:${r.lemma}`);
            if (triggeredBy) {
                (r.entry as any).lemma_triggered_by_entry_id = triggeredBy;
            }
            lemmaEntries.push(r.entry);
        }
    }

    // Wikidata enrichment
    if (enrich) {
        for (const ent of entries) {
            if (ent.type !== "LEXEME") continue;
            const qid = qPage.pageprops?.wikibase_item;
            if (!qid) continue;
            ent.wikidata = { qid };
            try {
                const wd = await fetchWikidataEntity(qid);
                if (wd) {
                    ent.wikidata.labels = wd.labels || {};
                    ent.wikidata.descriptions = wd.descriptions || {};
                    ent.wikidata.sitelinks = wd.sitelinks || {};
                    const p18 = wd.claims?.P18;
                    if (Array.isArray(p18) && p18[0]?.mainsnak?.datavalue?.value) {
                        const filename = p18[0].mainsnak.datavalue.value;
                        ent.wikidata.media = {
                            P18: filename,
                            commons_file: `File:${filename}`,
                        };
                        ent.wikidata.media.thumbnail = commonsThumbUrl(filename, 420);
                    }
                    // Extract types (P31 Instance Of and P279 Subclass Of)
                    const p31 = wd.claims?.P31 ?? [];
                    ent.wikidata.instance_of = p31.map((c: any) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
                    
                    const p279 = wd.claims?.P279 ?? [];
                    ent.wikidata.subclass_of = p279.map((c: any) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
                }
            } catch (err: any) {
                (ent as any).wikidata_error = String(err?.message || err);
            }
        }
    }

    const merged = entries.concat(
        lemmaEntries.map((le) => ({ ...le, resolved_for_query: query }))
    );

    if (preferredPos) {
        for (const ent of merged) {
            if (ent.type === "LEXEME" && ent.part_of_speech === preferredPos)
                ent.preferred = true;
        }
    }

    const LANG_PRIORITY: Record<string, number> = {
        el: 1,
        grc: 2,
        en: 3,
    };

    // Sort entries by language priority, then POS heading
    merged.sort((a, b) => {
        if (a.language !== b.language) {
            const pA = LANG_PRIORITY[a.language] || 100;
            const pB = LANG_PRIORITY[b.language] || 100;
            if (pA !== pB) return pA - pB;
            return a.language.localeCompare(b.language);
        }
        return a.part_of_speech_heading.localeCompare(b.part_of_speech_heading);
    });

    const out: FetchResult = { 
        schema_version: SCHEMA_VERSION, 
        rawLanguageBlock: lang === "Auto" ? qPage.wikitext : (searchSections[0]?.block || ""), 
        entries: merged, 
        notes: [],
        metadata: {
            categories: (qPage as any).categories || [],
            langlinks: (qPage as any).langlinks || [],
            info: (qPage as any).info || {},
        }
    };
    if (debugDecoders && allDebugEvents.length > 0) {
        out.debug = allDebugEvents.concat(Array(lemmaEntries.length).fill([]));
    }
    return out;
}

function guessEntryTypeFromTemplates(templates: any[]) {
    for (const t of templates) {
        if (VARIANT_TEMPLATES.has(t.name)) return "FORM_OF";
        if (FORM_OF_TEMPLATES.has(t.name)) return "INFLECTED_FORM";
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
export * from "./stem";
export type { GrammarTraits, ConjugateCriteria, DeclineCriteria } from "./morphology";
