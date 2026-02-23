import type {
    WikiLang,
    FetchResult,
    Entry,
    DecodeContext,
} from "./types";

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
import { uniq, deepMerge, commonsThumbUrl } from "./utils";

export async function fetchWiktionary({
    query,
    lang,
    preferredPos,
    enrich = true,
}: {
    query: string;
    lang: WikiLang;
    preferredPos?: string;
    enrich?: boolean;
}): Promise<FetchResult> {
    const qPage = await fetchWikitextEnWiktionary(query);
    if (!qPage.exists) {
        return {
            rawLanguageBlock: "",
            entries: [],
            notes: [`No page found for ${query} on en.wiktionary.org (after redirects).`],
        };
    }
    const languageName = langToLanguageName(lang);
    const langBlock = extractLanguageSection(qPage.wikitext, languageName);
    if (!langBlock) {
        return {
            rawLanguageBlock: "",
            entries: [],
            notes: [
                `No ${languageName} section found on en.wiktionary.org for ${qPage.title}.`,
            ],
        };
    }

    const etyms = splitEtymologiesAndPOS(langBlock);
    let entries: Entry[] = [];

    for (const e of etyms) {
        for (const pb of e.posBlocks) {
            const templates = parseTemplates(pb.wikitext);
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

            const patch: any = registry.decodeAll(ctx);
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


            if (!base.part_of_speech) {
                const mapped = mapHeadingToPos(pb.posHeading);
                if (mapped) base.part_of_speech = mapped;
            }

            base.form = qPage.title;
            entries.push(base);
        }
    }

    // Lemma resolution
    const lemmaRequests: string[] = [];
    for (const ent of entries) {
        const lemma = ent.form_of?.lemma;
        const lemmaLang = ent.form_of?.lang ?? lang;
        if (ent.type === "INFLECTED_FORM" && lemma && lemmaLang === lang) {
            lemmaRequests.push(lemma);
        }
    }
    const uniqueLemmas = uniq(lemmaRequests);

    const lemmaEntries: Entry[] = [];
    for (const lemma of uniqueLemmas) {
        const res = await fetchWiktionary({ query: lemma, lang, preferredPos, enrich });
        let cands = res.entries.filter((e) => e.type === "LEXEME");
        cands.sort(
            (a, b) =>
                preferredPosSortKey(a.part_of_speech || "", preferredPos) -
                preferredPosSortKey(b.part_of_speech || "", preferredPos)
        );
        if (cands[0]) lemmaEntries.push(cands[0]);
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

    return { rawLanguageBlock: langBlock, entries: merged, notes: [] };
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
