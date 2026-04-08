/**
 * Core fetch engine: `wiktionary` / `wiktionaryRecursive` without the public package barrel.
 * Consumers inside the repo should import from here instead of `./index` to avoid circular graphs.
 */
import type {
    WikiLang,
    FetchResult,
    Lexeme,
    DecodeContext,
    DecoderDebugEvent,
} from "../model";
import { SCHEMA_VERSION } from "../model";

import {
    fetchWikitextEnWiktionary,
    fetchWikidataEntity,
    fetchWikidataEntityByWiktionaryTitle,
    fetchWikidataEntityByWikipediaTitle,
    fetchWikipediaDisambiguationLinks,
} from "../ingress/api";
import {
    extractLanguageSection,
    extractAllLanguageSections,
    splitEtymologiesAndPOS,
    parseTemplates,
    langToLanguageName,
    languageNameToLang,
} from "../parse/parser";
import {
    fallbackLexicographicFromHeading,
    lexemeMatchesPosQuery,
    lexemePosSortKey,
    mapHeadingToLexicographic,
} from "../parse/lexicographic-headings";
import {
    registry,
    isFormOfTemplateName,
    isVariantFormOfTemplateName,
} from "../decode/registry";
import { deepMerge, commonsThumbUrl, parallelMap } from "../infra/utils";
import { enrichFormOfMorphLinesFromParseBatch } from "./form-of-parse-enrich";
import { enrichIso639LexemesBatch } from "./iso639-enrich";
import { linkRelationsToSenses } from "./sense-relation-linker";
import { LANG_PRIORITY } from "../infra/constants";

export type LexemeSortStrategy = "source" | "priority";
export type LexemeSortOption =
    | LexemeSortStrategy
    | {
        strategy: LexemeSortStrategy;
        priorities?: Record<string, number>;
    };

function wikidataSitelinkUrl(site: string | undefined, title: string | undefined): string | undefined {
    if (!site || !title || !site.endsWith("wiki")) return undefined;
    const lang = site.slice(0, -4);
    return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function capitalizeFirstTitleChar(title: string): string {
    if (!title) return title;
    return title[0].toLocaleUpperCase() + title.slice(1);
}

function wikipediaTitleCandidates(title: string, query: string): string[] {
    const candidates: string[] = [];
    const seen = new Set<string>();
    const push = (v: string | undefined) => {
        const t = (v || "").trim();
        if (!t || seen.has(t)) return;
        seen.add(t);
        candidates.push(t);
    };
    const pushWithDisambiguationFallback = (v: string | undefined) => {
        const t = (v || "").trim();
        if (!t) return;
        push(t);
        if (!/\([^)]*\)\s*$/.test(t)) {
            push(`${t} (disambiguation)`);
        }
    };

    pushWithDisambiguationFallback(title);
    pushWithDisambiguationFallback(capitalizeFirstTitleChar(title));
    if (query && query !== title) {
        pushWithDisambiguationFallback(query);
        pushWithDisambiguationFallback(capitalizeFirstTitleChar(query));
    }
    return candidates;
}

const WIKIDATA_DISAMBIGUATION_QID = "Q4167410";
const DISAMBIGUATION_WIKIPEDIA_CANDIDATE_LIMIT = 25;
const SENSE_MATCH_STOPWORDS = new Set([
    "the", "and", "for", "with", "from", "this", "that", "these", "those", "into", "onto",
    "about", "under", "over", "into", "than", "then", "such", "term", "word", "words", "sense",
    "meaning", "meanings", "page", "article", "used", "use", "very", "much", "more", "less",
    "write", "writing",
]);

function tokenizeForLooseMatch(s: string): string[] {
    return (s || "")
        .toLocaleLowerCase()
        .replace(/[_()[\],.;:!?/\\'"`-]+/g, " ")
        .split(/\s+/)
        .map((x) => x.trim())
        .filter((x) => x.length >= 3 && !SENSE_MATCH_STOPWORDS.has(x));
}

function buildSenseMatchesForDisambiguation(
    senses: Lexeme["senses"] | undefined,
    candidates: Array<{ title: string; qid: string | null; match_texts?: string[] }>,
): Array<{
    sense_id: string;
    candidate_qid: string;
    candidate_title: string;
    score: number;
    match_reasons?: {
        title_token_hits?: number;
        aux_token_hits?: number;
        title_phrase_hit?: boolean;
    };
}> {
    if (!senses || senses.length === 0) return [];
    const withQid = candidates.filter((c) => Boolean(c.qid)) as Array<{
        title: string;
        qid: string;
        match_texts?: string[];
    }>;
    if (withQid.length === 0) return [];
    const out: Array<{
        sense_id: string;
        candidate_qid: string;
        candidate_title: string;
        score: number;
        match_reasons?: {
            title_token_hits?: number;
            aux_token_hits?: number;
            title_phrase_hit?: boolean;
        };
    }> = [];
    for (const sense of senses) {
        const senseTextParts: string[] = [sense.gloss || ""];
        if (sense.gloss_raw) senseTextParts.push(sense.gloss_raw);
        if (sense.qualifier) senseTextParts.push(sense.qualifier);
        for (const ex of sense.examples || []) {
            if (typeof ex === "string") senseTextParts.push(ex);
            else {
                if (ex.text) senseTextParts.push(ex.text);
                if (ex.translation) senseTextParts.push(ex.translation);
                if (ex.raw) senseTextParts.push(ex.raw);
            }
        }
        const senseText = senseTextParts.join(" ").toLocaleLowerCase();
        const senseTokens = new Set(tokenizeForLooseMatch(senseText));
        if (senseTokens.size === 0) continue;
        let best: {
            title: string;
            qid: string;
            score: number;
            titleTokenHits: number;
            auxTokenHits: number;
            titlePhraseHit: boolean;
        } | null = null;
        for (const candidate of withQid) {
            const titleTokens = new Set(tokenizeForLooseMatch(candidate.title));
            const auxTokens = new Set(tokenizeForLooseMatch((candidate.match_texts || []).join(" ")));
            let score = 0;
            let titleTokenHits = 0;
            let auxTokenHits = 0;
            for (const token of titleTokens) {
                if (senseTokens.has(token)) {
                    score += 2;
                    titleTokenHits += 1;
                }
            }
            for (const token of auxTokens) {
                if (senseTokens.has(token)) {
                    score += 1;
                    auxTokenHits += 1;
                }
            }
            const candTitleLower = candidate.title.toLocaleLowerCase();
            let titlePhraseHit = false;
            if (candTitleLower && senseText.includes(candTitleLower)) {
                score += 4;
                titlePhraseHit = true;
            }
            if (score < 2) continue;
            if (!best || score > best.score) {
                best = {
                    title: candidate.title,
                    qid: candidate.qid,
                    score,
                    titleTokenHits,
                    auxTokenHits,
                    titlePhraseHit,
                };
            }
        }
        if (best) {
            out.push({
                sense_id: sense.id,
                candidate_qid: best.qid,
                candidate_title: best.title,
                score: best.score,
                match_reasons: {
                    ...(best.titleTokenHits > 0 ? { title_token_hits: best.titleTokenHits } : {}),
                    ...(best.auxTokenHits > 0 ? { aux_token_hits: best.auxTokenHits } : {}),
                    ...(best.titlePhraseHit ? { title_phrase_hit: true } : {}),
                },
            });
        }
    }
    return out;
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
        sort?: LexemeSortOption;
        matchMode?: "strict" | "fuzzy";
        /** Max concurrent lemma-resolution fetches (default: unlimited). */
        lemmaFetchConcurrency?: number;
        /** Max concurrent form-of `action=parse` calls per page (default: unlimited). */
        formOfParseConcurrency?: number;
    },
): Promise<FetchResult> {
    const normalizedSort = normalizeSortOption(opts.sort);
    const normalizedOpts = {
        ...opts,
        lang: opts.lang || "Auto",
        pos: opts.pos || "Auto",
        sort: normalizedSort,
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

    const sortedFuzzy = sortLexemesWithDebug(mergedLexemes, includeDebug ? mergedDebug : undefined, normalizedSort);
    const out: FetchResult = {
        schema_version: SCHEMA_VERSION,
        rawLanguageBlock,
        lexemes: sortedFuzzy.lexemes,
        notes,
        metadata,
    };
    if (includeDebug) out.debug = sortedFuzzy.debug;
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
        capitalizeFirstTitleChar(nfc),
        stripDiacritics(nfc),
        stripDiacritics(nfc).toLocaleLowerCase(),
        capitalizeFirstTitleChar(stripDiacritics(nfc)),
    ].filter((v) => v.trim().length > 0);
    return [...new Set(variants)].sort();
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
    lemmaFetchConcurrency,
    formOfParseConcurrency,
    _visited,
}: {
    query: string;
    lang?: WikiLang;
    pos?: string;
    preferredPos?: string;
    enrich?: boolean;
    debugDecoders?: boolean;
    sort?: LexemeSortOption;
    lemmaFetchConcurrency?: number;
    formOfParseConcurrency?: number;
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
                const mappedLex = mapHeadingToLexicographic(pb.posHeading);
                const fb = fallbackLexicographicFromHeading(pb.posHeading);
                const lexProbe = {
                    part_of_speech: mappedLex?.strict_pos ?? null,
                    lexicographic_section: fb.section_slug,
                    part_of_speech_heading: pb.posHeading,
                };

                if (pos !== "Auto") {
                    if (!lexemeMatchesPosQuery(lexProbe, pos)) {
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
                    lexicographic_section: fb.section_slug,
                    lexicographic_family: fb.family,
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

                if (base.part_of_speech == null && mappedLex?.strict_pos) {
                    base.part_of_speech = mappedLex.strict_pos;
                }

                base.form = qPage.title;

                const langName = section.langName;
                base.categories =
                    (qPage as any).categories?.filter(
                        (c: string) =>
                            c.toLowerCase().includes(langName.toLowerCase()) ||
                            c.toLowerCase().includes("pages with"),
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
        await enrichFormOfMorphLinesFromParseBatch(lexemes, qPage.title, formOfParseConcurrency);
        await enrichIso639LexemesBatch(lexemes, qPage.title);
    }

    for (const lex of lexemes) {
        linkRelationsToSenses(lex);
    }

    const lemmaRequests: Array<{ lemma: string; lang: WikiLang; triggeredBy: string }> = [];
    for (const lex of lexemes) {
        const lm = lex.form_of?.lemma;
        const lemmaLang = lex.form_of?.lang ?? lex.language;
        if (lex.type === "INFLECTED_FORM" && lm) {
            const lkey = lemmaKey(lemmaLang, lm);
            if (!_visited.has(lkey)) {
                lemmaRequests.push({ lemma: lm, lang: lemmaLang, triggeredBy: lex.id });
            }
        }
    }
    const seen = new Set<string>();
    const uniqueRequests = lemmaRequests.filter((r) => {
        const k = `${r.lang}:${r.lemma}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });

    const resolvedLexemes: Lexeme[] = [];
    const triggerMap = new Map<string, string>();
    for (const { lemma, lang: lLang, triggeredBy } of uniqueRequests) {
        triggerMap.set(`${lLang}:${lemma}`, triggeredBy);
    }
    const limit = lemmaFetchConcurrency ?? Infinity;
    const resolved = await parallelMap(uniqueRequests, limit, async ({ lemma, lang: lLang }) => {
        const res = await wiktionaryRecursive({
            query: lemma,
            lang: lLang,
            pos,
            preferredPos,
            enrich,
            debugDecoders,
            sort,
            lemmaFetchConcurrency,
            formOfParseConcurrency,
            _visited,
        });
        let cands = res.lexemes.filter((l) => l.type === "LEXEME");
        cands.sort(
            (a, b) =>
                preferredPosSortKey(lexemePosSortKey(a), preferredPos) -
                preferredPosSortKey(lexemePosSortKey(b), preferredPos),
        );
        return cands[0] ? { lemma, lang: lLang, lexeme: cands[0] } : null;
    });
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
        let resolvedQidFromWikipedia = false;
        let fallbackAttempted = false;
        for (const lex of lexemes) {
            if (lex.type !== "LEXEME") continue;
            let qid = qPage.pageprops?.wikibase_item as string | undefined;
            let qidFromWikipedia = false;
            if (!qid && resolvedQid) { qid = resolvedQid; qidFromWikipedia = resolvedQidFromWikipedia; }
            if (!qid && !fallbackAttempted) {
                fallbackAttempted = true;
                try {
                    resolvedEntity = await fetchWikidataEntityByWiktionaryTitle(qPage.title);
                    if (!resolvedEntity?.id) {
                        const wikiCandidates = wikipediaTitleCandidates(qPage.title, query);
                        for (const candidate of wikiCandidates) {
                            resolvedEntity = await fetchWikidataEntityByWikipediaTitle(candidate);
                            if (resolvedEntity?.id) break;
                        }
                        resolvedQidFromWikipedia = Boolean(resolvedEntity?.id);
                    }
                    resolvedQid = resolvedEntity?.id;
                    qidFromWikipedia = resolvedQidFromWikipedia;
                    if (resolvedQid) qid = resolvedQid;
                } catch {
                    // best-effort fallback only
                }
            }
            if (!qid) continue;
            if (qidFromWikipedia && lex.language === "Translingual") continue;
            lex.wikidata = { qid };
            try {
                const wd =
                    resolvedEntity && resolvedEntity.id === qid ? resolvedEntity : await fetchWikidataEntity(qid);
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
                    const isDisambiguation = (lex.wikidata.instance_of || []).includes(WIKIDATA_DISAMBIGUATION_QID);
                    if (isDisambiguation) {
                        const links = await fetchWikipediaDisambiguationLinks(
                            qPage.title,
                            DISAMBIGUATION_WIKIPEDIA_CANDIDATE_LIMIT,
                        );
                        const candidates: Array<{ title: string; qid: string | null; url?: string; match_texts?: string[] }> = [];
                        for (const link of links) {
                            let candidateQid: string | null = null;
                            let matchTexts: string[] = [];
                            try {
                                const c = await fetchWikidataEntityByWikipediaTitle(link.title);
                                candidateQid = c?.id || null;
                                const labelEn = c?.labels?.en?.value ? [String(c.labels.en.value)] : [];
                                const descEn = c?.descriptions?.en?.value ? [String(c.descriptions.en.value)] : [];
                                const aliasEn = Array.isArray(c?.aliases?.en)
                                    ? c.aliases.en.map((x: any) => String(x?.value || "")).filter(Boolean)
                                    : [];
                                matchTexts = [...labelEn, ...descEn, ...aliasEn];
                            } catch {
                                candidateQid = null;
                            }
                            candidates.push({
                                title: link.title,
                                qid: candidateQid,
                                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(link.title.replace(/ /g, "_"))}`,
                                ...(matchTexts.length > 0 ? { match_texts: matchTexts } : {}),
                            });
                        }
                        const senseMatches = buildSenseMatchesForDisambiguation(lex.senses, candidates);
                        const publicCandidates = candidates.map((c) => ({
                            title: c.title,
                            qid: c.qid,
                            ...(c.url ? { url: c.url } : {}),
                        }));
                        const originalDisambigQid = lex.wikidata.qid;
                        lex.wikidata.disambiguation = {
                            source_qid: originalDisambigQid,
                            candidates: publicCandidates,
                            ...(senseMatches.length > 0 ? { sense_matches: senseMatches } : {}),
                        };

                        const DISAMBIG_CONFIDENCE_THRESHOLD = 4;
                        const confident = senseMatches.filter((m) => m.score >= DISAMBIG_CONFIDENCE_THRESHOLD);
                        if (confident.length > 0 && lex.senses) {
                            for (const match of confident) {
                                const sense = lex.senses.find((s) => s.id === match.sense_id);
                                if (sense) sense.wikidata_qid = match.candidate_qid;
                            }
                            const best = confident.reduce((a, b) => (b.score > a.score ? b : a));
                            lex.wikidata.qid = best.candidate_qid;
                            lex.wikidata.instance_of = (lex.wikidata.instance_of || []).filter(
                                (id) => id !== WIKIDATA_DISAMBIGUATION_QID,
                            );
                        } else {
                            lex.wikidata.disambiguation.unresolved = true;
                        }
                    }
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                lex.wikidata.wikidata_error = msg;
            }
        }
    }

    const merged = lexemes.concat(resolvedLexemes.map((rl) => ({ ...rl, resolved_for_query: query })));

    if (preferredPos) {
        for (const lex of merged) {
            if (lex.type === "LEXEME" && lexemeMatchesPosQuery(lex, preferredPos)) lex.preferred = true;
        }
    }

    const normalizedSort = normalizeSortOption(sort);
    const sortedMerged = sortLexemesWithDebug(
        merged,
        debugDecoders && allDebugEvents.length > 0
            ? allDebugEvents.concat(Array.from({ length: resolvedLexemes.length }, () => [] as DecoderDebugEvent[]))
            : undefined,
        normalizedSort,
    );

    const out: FetchResult = {
        schema_version: SCHEMA_VERSION,
        rawLanguageBlock: lang === "Auto" ? qPage.wikitext : searchSections[0]?.block || "",
        lexemes: sortedMerged.lexemes,
        notes: resolvedPageTitleNote && debugDecoders ? [resolvedPageTitleNote] : [],
        metadata: {
            categories: (qPage as any).categories || [],
            langlinks: (qPage as any).langlinks || [],
            info: (qPage as any).info || {},
        },
    };
    if (debugDecoders && sortedMerged.debug) {
        out.debug = sortedMerged.debug;
    }
    return out;
}

function normalizeSortOption(sort: LexemeSortOption | undefined): { strategy: LexemeSortStrategy; priorities: Record<string, number> } {
    if (!sort) {
        return { strategy: "source", priorities: LANG_PRIORITY };
    }
    if (typeof sort === "string") {
        return { strategy: sort, priorities: LANG_PRIORITY };
    }
    return {
        strategy: sort.strategy,
        priorities: { ...LANG_PRIORITY, ...(sort.priorities ?? {}) },
    };
}

function languagePriority(lang: string, priorities: Record<string, number>): number {
    return priorities[lang] ?? 100;
}

function compareLexemesForPriority(a: Lexeme, b: Lexeme, priorities: Record<string, number>): number {
    if (a.language !== b.language) {
        const pA = languagePriority(a.language, priorities);
        const pB = languagePriority(b.language, priorities);
        if (pA !== pB) return pA - pB;
        return a.language.localeCompare(b.language);
    }
    const etA = a.etymology_index ?? Number.MAX_SAFE_INTEGER;
    const etB = b.etymology_index ?? Number.MAX_SAFE_INTEGER;
    if (etA !== etB) return etA - etB;
    return a.part_of_speech_heading.localeCompare(b.part_of_speech_heading);
}

function sortLexemesWithDebug(
    lexemes: Lexeme[],
    debugRows: DecoderDebugEvent[][] | undefined,
    sort: { strategy: LexemeSortStrategy; priorities: Record<string, number> },
): { lexemes: Lexeme[]; debug?: DecoderDebugEvent[][] } {
    if (sort.strategy !== "priority") {
        return debugRows ? { lexemes, debug: debugRows } : { lexemes };
    }
    const rows = lexemes.map((lexeme, idx) => ({
        lexeme,
        debug: debugRows?.[idx] ?? [],
    }));
    rows.sort((a, b) => compareLexemesForPriority(a.lexeme, b.lexeme, sort.priorities));
    return {
        lexemes: rows.map((r) => r.lexeme),
        ...(debugRows ? { debug: rows.map((r) => r.debug) } : {}),
    };
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
