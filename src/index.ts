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
    splitEtymologiesAndPOS,
    parseTemplates,
    mapHeadingToPos,
    langToLanguageName,
} from "./parser";
import { registry, FORM_OF_TEMPLATES } from "./registry";
import { deepMerge, commonsThumbUrl } from "./utils";

/**
 * Fetches and normalizes a Wiktionary entry.
 *
 * @param options.query - The term to look up (e.g. `"γράφω"`)
 * @param options.lang - BCP-47 language code (e.g. `"el"`)
 * @param options.preferredPos - Optional POS filter for disambiguation
 * @param options.enrich - Whether to fetch Wikidata enrichment (default `true`)
 * @returns A {@link FetchResult} containing normalized entries and raw wikitext
 */
function lemmaKey(lang: WikiLang, lemma: string) {
    return `${lang}:${lemma}`;
}

export async function wiktionary(
    opts: {
        query: string;
        lang: WikiLang;
        preferredPos?: string;
        enrich?: boolean;
        debugDecoders?: boolean;
    }
): Promise<FetchResult> {
    const visited = new Set<string>();
    return wiktionaryRecursive({ ...opts, _visited: visited });
}

async function wiktionaryRecursive({
    query,
    lang,
    preferredPos,
    enrich = true,
    debugDecoders = false,
    _visited,
}: {
    query: string;
    lang: WikiLang;
    preferredPos?: string;
    enrich?: boolean;
    debugDecoders?: boolean;
    _visited: Set<string>;
}): Promise<FetchResult> {
    const key = lemmaKey(lang, query);
    if (_visited.has(key)) {
        return {
            schema_version: SCHEMA_VERSION,
            rawLanguageBlock: "",
            entries: [],
            notes: [`Cycle detected: ${query} already visited.`],
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
    if (!langBlock) {
        return {
            schema_version: SCHEMA_VERSION,
            rawLanguageBlock: "",
            entries: [],
            notes: [
                `No ${languageName} section found on en.wiktionary.org for ${qPage.title}.`,
            ],
        };
    }

    const etyms = splitEtymologiesAndPOS(langBlock);
    let entries: Entry[] = [];
    const allDebugEvents: DecoderDebugEvent[][] = [];

    for (const e of etyms) {
        for (const pb of e.posBlocks) {
            const templates = parseTemplates(pb.wikitext, true) as any[]; // always withLocation for templates_all
            const lines = pb.wikitext.split("\n");
            const entryType = guessEntryTypeFromTemplates(templates);

            const ctx: DecodeContext = {
                lang,
                query,
                page: qPage,
                languageBlock: langBlock,
                etymology: e,
                posBlock: pb,
                posBlockWikitext: pb.wikitext,
                templates,
                lines,
            };

            const result = registry.decodeAll(ctx, { debug: debugDecoders });
            const patch: any = typeof result === "object" && "patch" in result ? result.patch : result;
            const id = `${lang}:${qPage.title}#E${e.idx}#${slug(pb.posHeading)}#${entryType}`;

            const base: Entry = {
                id,
                language: lang,
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
                        language_section: languageName,
                        etymology_index: e.idx,
                        pos_heading: pb.posHeading,
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

            if (!base.part_of_speech) {
                const mapped = mapHeadingToPos(pb.posHeading);
                if (mapped) base.part_of_speech = mapped;
            }

            base.form = qPage.title;
            entries.push(base);
        }
    }

    // Lemma resolution with cycle protection
    const lemmaRequests: Array<{ lemma: string; triggeredBy: string }> = [];
    for (const ent of entries) {
        const lemma = ent.form_of?.lemma;
        const lemmaLang = ent.form_of?.lang ?? lang;
        if (ent.type === "INFLECTED_FORM" && lemma && lemmaLang === lang) {
            const key = lemmaKey(lang, lemma);
            if (!_visited.has(key)) {
                lemmaRequests.push({ lemma, triggeredBy: ent.id });
            }
        }
    }
    const seen = new Set<string>();
    const uniqueRequests = lemmaRequests.filter((r) => {
        if (seen.has(r.lemma)) return false;
        seen.add(r.lemma);
        return true;
    });

    const lemmaEntries: Entry[] = [];
    const triggerMap = new Map<string, string>();
    for (const { lemma, triggeredBy } of uniqueRequests) {
        triggerMap.set(lemma, triggeredBy);
    }
    const fetchPromises = uniqueRequests.map(async ({ lemma }) => {
        const res = await wiktionaryRecursive({
            query: lemma,
            lang,
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
        return cands[0] ? { lemma, entry: cands[0] } : null;
    });
    const resolved = await Promise.all(fetchPromises);
    for (const r of resolved) {
        if (r) {
            const triggeredBy = triggerMap.get(r.lemma);
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

    const out: FetchResult = { schema_version: SCHEMA_VERSION, rawLanguageBlock: langBlock, entries: merged, notes: [] };
    if (debugDecoders && allDebugEvents.length > 0) {
        out.debug = allDebugEvents.concat(Array(lemmaEntries.length).fill([]));
    }
    return out;
}

function guessEntryTypeFromTemplates(templates: any[]) {
    for (const t of templates) {
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
