import { commonsThumbUrl } from "../infra/utils";
import { wiktionary } from "../pipeline/wiktionary-core";
import type { EtymologyStep, Lexeme, WikiLang } from "../model";
import { lemma } from "./lemma-translate";
import { mapLexemes, type GroupedLexemeResults } from "./grouped-results";
import {
    warnEtymologySteps,
    warnGender,
    warnHomophones,
    warnInflectionTableRef,
    warnLexemeArrayField,
    warnPrincipalParts,
    warnRhymes,
    warnSensesList,
    warnTransitivity,
    withExtractionSupport,
} from "./extraction-support";

const WIKTIONARY_LANG_MACROS: Record<string, string> = {
    "ine-pro": "PIE", "grk-pro": "Proto-Greek", "gem-pro": "Proto-Germanic", "itc-pro": "Proto-Italic",
    "sla-pro": "Proto-Slavic", "cel-pro": "Proto-Celtic", "iir-pro": "Proto-Indo-Iranian",
    "trk-pro": "Proto-Turkic", "ira-pro": "Proto-Iranian", "sem-pro": "Proto-Semitic",
    "urj-pro": "Proto-Uralic", "gkm": "Medieval Greek",
};

function resolveLangCode(code: string): string {
    if (WIKTIONARY_LANG_MACROS[code]) return WIKTIONARY_LANG_MACROS[code];
    if (code.endsWith("-pro")) {
        const base = code.replace("-pro", "");
        return "Proto-" + base.charAt(0).toUpperCase() + base.slice(1);
    }
    return code;
}

function extractEtymologySteps(lexeme: Lexeme): EtymologyStep[] | null {
    if (!lexeme.etymology) return null;
    const links = lexeme.etymology.chain ?? lexeme.etymology.links;
    if (!links || links.length === 0) return null;
    const output: EtymologyStep[] = [];
    for (const link of links) {
        if (!link.term) continue;
        output.push({ lang: resolveLangCode(link.source_lang), form: link.term });
    }
    return output.length > 0 ? output : null;
}

export async function etymology(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<EtymologyStep[] | null>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const steps = extractEtymologySteps(lexeme);
        return withExtractionSupport(steps, warnEtymologySteps(lexeme, steps));
    });
}

export async function wikidataQid(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string | null>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.wikidata?.qid || null);
}

export async function image(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string | null>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.wikidata?.media?.thumbnail || null);
}

export async function wikipediaLink(query: string, sourceLang: WikiLang = "Auto", targetWikiLang: WikiLang = "en", pos: string = "Auto"): Promise<GroupedLexemeResults<string | null>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => {
        if (!lexeme.wikidata?.sitelinks) return null;
        const sitelinkKey = targetWikiLang + "wiki";
        const link = (lexeme.wikidata.sitelinks as Record<string, any>)[sitelinkKey];
        return link?.url || null;
    });
}

/**
 * Returns a map of other Wiktionary editions where this term exists.
 */
export const interwiki = langlinks;

/**
 * Checks if a word belongs to a specific category.
 */
export async function isCategory(query: string, categoryName: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<boolean>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme =>
        (lexeme.categories || []).some(c => c.toLowerCase().includes(categoryName.toLowerCase()))
    );
}

/**
 * Retrieves page-level metadata from the API.
 * Stays scalar — metadata is inherently about the page, not a specific lexeme.
 */
export async function pageMetadata(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<any> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return result.metadata?.info || null;
}

/**
 * Retrieves the principal paradigm forms of a verb (e.g. simple_past, future_active).
 */
export async function principalParts(query: string, sourceLang: WikiLang = "Auto"): Promise<GroupedLexemeResults<Record<string, string> | null>> {
    const lemmaStr = await lemma(query, sourceLang, "verb");
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos: "verb" });
    return mapLexemes(result, (lexeme) => {
        const v = lexeme.headword_morphology?.principal_parts || null;
        return withExtractionSupport(v, warnPrincipalParts(lexeme, v));
    });
}

/**
 * Returns the grammatical gender of a nominal (noun, adjective, etc.).
 */
export async function gender(query: string, sourceLang: WikiLang = "Auto"): Promise<GroupedLexemeResults<"masculine" | "feminine" | "neuter" | null>> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    return mapLexemes(result, (lexeme) => {
        const g = lexeme.headword_morphology?.gender || null;
        return withExtractionSupport(g, warnGender(lexeme, g));
    });
}

/**
 * Returns all rhyming words listed for the term.
 */
export async function rhymes(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const list = lexeme.pronunciation?.rhymes || [];
        return withExtractionSupport(list, warnRhymes(lexeme, list));
    });
}

/**
 * Returns all homophones listed for the term.
 */
export async function homophones(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const list = lexeme.pronunciation?.homophones || [];
        return withExtractionSupport(list, warnHomophones(lexeme, list));
    });
}

/**
 * Returns a list of all images used on the Wiktionary page and the primary Wikidata image.
 */
export async function allImages(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => {
        const images: string[] = [];
        if (lexeme.wikidata?.media?.thumbnail) images.push(lexeme.wikidata.media.thumbnail);
        if (lexeme.images) {
            for (const img of lexeme.images) {
                if (!/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(img)) continue;
                images.push(commonsThumbUrl(img, 420));
            }
        }
        return Array.from(new Set(images));
    });
}

/**
 * Returns all external links found on the page.
 */
export async function externalLinks(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.external_links || []);
}

/**
 * Returns all Wiktionary term titles linked from this article.
 */
export async function internalLinks(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.page_links || []);
}

/**
 * Returns detailed audio objects with URLs and dialect labels.
 */
export async function audioGallery(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<Array<{ url: string; label?: string; filename: string }>>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.pronunciation?.audio_details || []);
}

/** @deprecated Use audioGallery instead. */
export const audioDetails = audioGallery;

/**
 * Returns structured usage examples (prose + metadata).
 */
export async function exampleDetails(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<any[]>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => {
        if (!lexeme.senses)
            return withExtractionSupport([], warnSensesList(lexeme, [], "Examples"));
        const examples: any[] = [];
        for (const sense of lexeme.senses) {
            if (sense.examples) {
                for (const ex of sense.examples) {
                    if (typeof ex === "object") examples.push(ex);
                }
            }
        }
        return withExtractionSupport(
            examples,
            examples.length > 0 ? undefined : warnSensesList(lexeme, [], "Examples"),
        );
    });
}

/**
 * Returns literary citations (entries using {{quote}} templates).
 */
export async function citations(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<any[]>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => {
        if (!lexeme.senses)
            return withExtractionSupport([], warnSensesList(lexeme, [], "Citations"));
        const examples: any[] = [];
        for (const sense of lexeme.senses) {
            if (sense.examples) {
                for (const ex of sense.examples) {
                    if (typeof ex === "object") examples.push(ex);
                }
            }
        }
        const cited = examples.filter(ex => ex.raw?.toLowerCase().includes("{{quote"));
        return withExtractionSupport(
            cited,
            cited.length > 0 ? undefined : warnSensesList(lexeme, [], "Citations"),
        );
    });
}

/**
 * Checks if a Wikidata item is an instance of a specific QID.
 */
export async function isInstance(query: string, qid: string, sourceLang: WikiLang = "Auto"): Promise<GroupedLexemeResults<boolean>> {
    const result = await wiktionary({ query, lang: sourceLang });
    return mapLexemes(result, lexeme =>
        (lexeme.wikidata?.instance_of || []).includes(qid)
    );
}

/**
 * Checks if a Wikidata item is a subclass of a specific QID (P279).
 */
export async function isSubclass(query: string, qid: string, sourceLang: WikiLang = "Auto"): Promise<GroupedLexemeResults<boolean>> {
    const result = await wiktionary({ query, lang: sourceLang });
    return mapLexemes(result, lexeme =>
        (lexeme.wikidata?.subclass_of || []).includes(qid)
    );
}

/**
 * Returns the transitivity of a verb.
 */
export async function transitivity(query: string, sourceLang: WikiLang = "Auto"): Promise<GroupedLexemeResults<"transitive" | "intransitive" | "both" | null>> {
    const lemmaStr = await lemma(query, sourceLang, "verb");
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos: "verb" });
    return mapLexemes(result, (lexeme) => {
        const t = lexeme.headword_morphology?.transitivity || null;
        return withExtractionSupport(t, warnTransitivity(lexeme, t));
    });
}

/**
 * Returns the alternative forms listed for a word.
 */
export async function alternativeForms(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<Array<{ term: string; qualifier?: string }>>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme =>
        (lexeme.alternative_forms || []).map(f => ({ term: f.term, qualifier: f.qualifier }))
    );
}

/**
 * Returns terms from the See also section.
 */
export async function seeAlso(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.see_also || []);
}

export async function anagrams(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.anagrams || []);
}

/**
 * Returns usage notes for the word.
 */
export async function usageNotes(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.usage_notes || []);
}

/**
 * Returns derived terms for the word.
 */
export async function derivedTerms(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<any[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.derived_terms?.items || []);
}

/** Semantic alias for {@link derivedTerms} (identical behavior and return type). */
export const derivations = derivedTerms;

/**
 * Returns related terms for the word.
 */
export async function relatedTerms(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<any[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.related_terms?.items || []);
}

/**
 * Returns descendants for the word.
 */
export async function descendants(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<any[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.descendants?.items || []);
}

/**
 * Returns references for the word.
 */
export async function referencesSection(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.references || []);
}

/**
 * Returns the etymology chain (ancestors).
 */
export async function etymologyChain(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<any[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const chain = lexeme.etymology?.chain || [];
        return withExtractionSupport(
            chain,
            warnLexemeArrayField(lexeme, chain, { label: "etymologyChain", templateNames: ["inh", "der", "bor", "cog"] }),
        );
    });
}

/**
 * Returns cognates extracted from etymology.
 */
export async function etymologyCognates(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<any[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const cogs = lexeme.etymology?.cognates || [];
        return withExtractionSupport(
            cogs,
            warnLexemeArrayField(lexeme, cogs, { label: "etymologyCognates", templateNames: ["cog"] }),
        );
    });
}

/**
 * Returns the raw etymology text.
 */
export async function etymologyText(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string | null>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.etymology?.raw_text || null);
}

/**
 * Returns categories for the word (filtered by language section).
 */
export async function categories(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.categories || []);
}

/**
 * Returns links to other Wiktionary editions.
 */
export async function langlinks(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<any[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.langlinks || []);
}

/**
 * Returns the name of the inflection template used for this word.
 */
export async function inflectionTableRef(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<{ template_name: string; raw: string } | null>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const ref = lexeme.inflection_table_ref || null;
        return withExtractionSupport(ref, warnInflectionTableRef(lexeme, ref));
    });
}
