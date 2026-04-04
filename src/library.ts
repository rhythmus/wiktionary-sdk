import { wiktionary } from "./index";
import { mwFetchJson } from "./api";
import { stripWikiMarkup } from "./registry";
import { morphology as getMorphology, conjugate as runConjugate, decline as runDecline } from "./morphology";
import { commonsThumbUrl } from "./utils";
import type { WikiLang, FetchResult, Lexeme, LexemeResult, RichEntry } from "./types";
import type { ConjugateCriteria, DeclineCriteria, GrammarTraits } from "./morphology";

export interface GroupedLexemeResults<T> extends Array<LexemeResult<T>> {
    order: string[];
    lexemes: Record<string, {
        language: string;
        pos: string;
        etymology_index: number;
        value: T;
    }>;
}

function groupRows<T>(rows: LexemeResult<T>[]): GroupedLexemeResults<T> {
    const out = rows as GroupedLexemeResults<T>;
    out.order = [];
    out.lexemes = {};
    rows.forEach((row) => {
        out.order.push(row.lexeme_id);
        out.lexemes[row.lexeme_id] = {
            language: String(row.language),
            pos: row.pos,
            etymology_index: row.etymology_index ?? 0,
            value: row.value,
        };
    });
    return out;
}

/** Convenience accessor for grouped wrapper output. */
export function asLexemeMap<T>(grouped: GroupedLexemeResults<T>) {
    return grouped.lexemes;
}

/** Row-oriented view (ordered) over grouped wrapper output. */
export function asLexemeRows<T>(grouped: GroupedLexemeResults<T>): LexemeResult<T>[] {
    return grouped.order.map((id) => {
        const item = grouped.lexemes[id];
        return {
            lexeme_id: id,
            language: item.language,
            pos: item.pos,
            etymology_index: item.etymology_index,
            value: item.value,
        };
    });
}

/**
 * Maps over all lexemes in a FetchResult, applying an extractor to each
 * and tagging the output with lexeme identity metadata.
 */
export function mapLexemes<T>(
    result: FetchResult,
    extractor: (lexeme: Lexeme) => T
): GroupedLexemeResults<T> {
    const rows: LexemeResult<T>[] = result.lexemes.map(lexeme => ({
        lexeme_id: lexeme.id,
        language: lexeme.language,
        pos: lexeme.part_of_speech_heading || lexeme.part_of_speech || "unknown",
        etymology_index: lexeme.etymology_index,
        value: extractor(lexeme),
    }));
    return groupRows(rows);
}

export interface TranslationOptions {
    /** 
     * "gloss" -> Returns mapped equivalents from en.wiktionary's Translations table (default).
     * "senses" -> Returns full prose definitions by hitting the target's native Wiktionary domain.
     */
    mode?: "gloss" | "senses";
}

/**
 * Helper to find the primary lexeme of a word result.
 * Kept as a public utility for callers who explicitly want single-lexeme shortcutting.
 */
export function getMainLexeme(result: FetchResult): Lexeme | null {
    if (!result.lexemes || result.lexemes.length === 0) return null;
    
    const posLexeme = result.lexemes.find(e => e.part_of_speech !== undefined && e.part_of_speech !== null);
    if (posLexeme) return posLexeme;

    const metaHeadings = ["pronunciation", "etymology", "references", "anagrams"];
    const mainLexeme = result.lexemes.find(e => 
        e.type === "LEXEME" && 
        !metaHeadings.includes((e.part_of_speech_heading || "").toLowerCase())
    );
    if (mainLexeme) return mainLexeme;

    return result.lexemes.find(e => e.type === "LEXEME") || result.lexemes[0] || null;
}

/**
 * Returns the canonical dictionary form (lemma) of an inflected word.
 * Stays scalar — this is a form-resolution utility, not a data-extraction wrapper.
 */
export async function lemma(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<string> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    const normalizeTerm = (v: string) => v.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
    const queryNorm = normalizeTerm(query);
    
    const metaHeadings = ["pronunciation", "etymology", "references", "anagrams", "alternative forms"];
    const highPriorityLexeme = result.lexemes.find(e => 
        e.type === "LEXEME" && 
        e.form === query && 
        (e.language === "el" || e.language === "grc" || e.language === "en") &&
        !metaHeadings.includes((e.part_of_speech_heading || "").toLowerCase())
    );
    if (highPriorityLexeme) return query;

    const anyLexeme = result.lexemes.find(e => 
        e.type === "LEXEME" && 
        e.form === query &&
        !metaHeadings.includes((e.part_of_speech_heading || "").toLowerCase())
    );
    if (anyLexeme) return query;

    const diacriticInsensitiveLexeme = result.lexemes.find(e =>
        e.type === "LEXEME" &&
        normalizeTerm(e.form) === queryNorm &&
        !metaHeadings.includes((e.part_of_speech_heading || "").toLowerCase())
    );
    if (diacriticInsensitiveLexeme) return query;

    const inflected = result.lexemes.find(e => e.type === "INFLECTED_FORM" && e.form === query);
    if (inflected && inflected.form_of?.lemma) return inflected.form_of.lemma;

    return query;
}

/**
 * Retrieves translations for a term in a specific target language.
 */
export async function translate(
    query: string,
    sourceLang: WikiLang = "Auto",
    targetLang: string = "en",
    options: TranslationOptions = { mode: "gloss" },
    pos: string = "Auto"
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);

    if (options.mode === "senses") {
        if (targetLang === "en") {
            const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
            return mapLexemes(result, lexeme =>
                lexeme.senses?.map((s: any) => s.gloss) || []
            );
        } else {
            const senses = await getNativeSenses(lemmaStr, sourceLang, targetLang);
            return groupRows([{
                lexeme_id: "native-senses",
                language: sourceLang,
                pos: "unknown",
                etymology_index: 0,
                value: senses,
            }]);
        }
    }

    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => {
        const targetTranslations = lexeme.translations?.[targetLang] || [];
        return targetTranslations.map((tr: any) => tr.term);
    });
}

/**
 * Retrieves synonyms for a term.
 */
export async function synonyms(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme =>
        lexeme.semantic_relations?.synonyms?.map(s => s.term) || []
    );
}

/**
 * Retrieves antonyms for a term.
 */
export async function antonyms(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme =>
        lexeme.semantic_relations?.antonyms?.map(s => s.term) || []
    );
}

/**
 * Retrieves hypernyms for a term.
 */
export async function hypernyms(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme =>
        lexeme.semantic_relations?.hypernyms?.map(h => h.term) || []
    );
}

/**
 * Retrieves hyponyms for a term.
 */
export async function hyponyms(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme =>
        lexeme.semantic_relations?.hyponyms?.map(h => h.term) || []
    );
}

/**
 * Extracts the primary IPA transcription or audio file.
 */
export async function pronounce(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string | null>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme =>
        lexeme.pronunciation?.audio_url || lexeme.pronunciation?.audio || lexeme.pronunciation?.IPA || null
    );
}

/**
 * Extracts the primary IPA transcription.
 */
export async function ipa(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string | null>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme =>
        lexeme.pronunciation?.IPA || null
    );
}

export const phonetic = ipa;

/**
 * Returns the hyphenation (syllables).
 */
export async function hyphenate(query: string, sourceLang: WikiLang = "Auto", options: { separator?: string, format?: "string" | "array" } = {}, pos: string = "Auto"): Promise<GroupedLexemeResults<any>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => {
        const syllables = lexeme.hyphenation?.syllables || null;
        if (!syllables) return null;
        if (options.format === "array") return syllables;
        if (options.separator || options.format === "string") return syllables.join(options.separator || "-");
        return syllables;
    });
}

/**
 * Returns the number of syllables.
 */
export async function syllableCount(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<number>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => {
        const syllables = lexeme.hyphenation?.syllables;
        return syllables ? syllables.length : 0;
    });
}

/**
 * Returns the normalized structural identifier (e.g., "verb", "noun").
 */
export async function partOfSpeech(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string | null>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => {
        const s = (lexeme.part_of_speech || lexeme.part_of_speech_heading)?.replace(/_/g, " ");
        return s ?? null;
    });
}

/**
 * Retrieves the morphology traits of the word.
 */
export async function morphology(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<Partial<GrammarTraits>>> {
    return getMorphology(query, sourceLang, pos);
}

/**
 * Conjugates a verb based on criteria. Returns null if the word is not a verb.
 * If no criteria are provided, returns the full conjugation table.
 */
export async function conjugate(query: string, sourceLang: WikiLang = "Auto", criteria: Partial<ConjugateCriteria> = {}): Promise<GroupedLexemeResults<string[] | Record<string, any> | null>> {
    return runConjugate(query, criteria, sourceLang);
}

/**
 * Declines a nominal (noun, adj, etc.) based on criteria. Returns null if not a nominal.
 * If no criteria are provided, returns the full declension table.
 */
export async function decline(query: string, sourceLang: WikiLang = "Auto", criteria: Partial<DeclineCriteria> = {}): Promise<GroupedLexemeResults<string[] | Record<string, any> | null>> {
    return runDecline(query, criteria, sourceLang);
}

/**
 * Produces a high-fidelity dictionary entry object containing all extracted 
 * linguistic data for a given term.
 */
export async function richEntry(query: string, lang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<RichEntry | null>> {
    const originalResult = await wiktionary({ query, lang, pos });
    
    const inflectedSource = originalResult.lexemes.find(e => e.type === "INFLECTED_FORM" && e.form === query);
    const resolvedTriggeredId = inflectedSource
        ? originalResult.lexemes.find(e => e.lemma_triggered_by_lexeme_id === inflectedSource.id)?.id
        : undefined;

    const lemmaStr = await lemma(query, lang, pos);
    const result = await wiktionary({ query: lemmaStr, lang, pos });

    return mapLexemes(result, lexeme => {
        const entryPos = (lexeme.part_of_speech || lexeme.part_of_speech_heading || "unknown").toLowerCase();

        const inflectedForLexeme = resolvedTriggeredId && lexeme.id === resolvedTriggeredId ? inflectedSource : undefined;

        return {
            headword: inflectedForLexeme ? query : lexeme.form,
            type: inflectedForLexeme ? "INFLECTED_FORM" as const : (lexeme.type === "FORM_OF" ? "FORM_OF" as const : "LEXEME" as const),
            form_of: inflectedForLexeme?.form_of,
            pos: entryPos,
            morphology: {
                aspect: lexeme.headword_morphology?.aspect,
                voice: lexeme.headword_morphology?.voice,
            },
            headword_morphology: lexeme.headword_morphology,
            pronunciation: lexeme.pronunciation,
            hyphenation: lexeme.hyphenation,
            etymology: lexeme.etymology,
            senses: lexeme.senses,
            relations: {
                synonyms: lexeme.semantic_relations?.synonyms?.map(s => ({ term: s.term })) || [],
                antonyms: lexeme.semantic_relations?.antonyms?.map(a => ({ term: a.term })) || [],
                hypernyms: lexeme.semantic_relations?.hypernyms?.map(h => ({ term: h.term })),
                hyponyms: lexeme.semantic_relations?.hyponyms?.map(h => ({ term: h.term })),
                coordinate_terms: lexeme.semantic_relations?.coordinate_terms?.map(c => ({ term: c.term })),
                holonyms: lexeme.semantic_relations?.holonyms?.map(h => ({ term: h.term })),
                meronyms: lexeme.semantic_relations?.meronyms?.map(m => ({ term: m.term })),
                troponyms: lexeme.semantic_relations?.troponyms?.map(t => ({ term: t.term })),
            },
            derived_terms: lexeme.derived_terms,
            related_terms: lexeme.related_terms,
            descendants: lexeme.descendants,
            usage_notes: lexeme.usage_notes,
            references: lexeme.references,
            inflection_table: null as any,
            translations: lexeme.translations,
            wikidata: lexeme.wikidata ? {
                ...lexeme.wikidata,
                subclass_of: lexeme.wikidata.subclass_of,
            } : undefined,
            images: lexeme.images,
            source: lexeme.source.wiktionary
        };
    });
}

export interface EtymologyStep {
    lang: string;
    form: string;
}

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
    const links = (lexeme.etymology as any).chain || (lexeme.etymology as any).links;
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
    return mapLexemes(result, extractEtymologySteps);
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
    return mapLexemes(result, lexeme => lexeme.headword_morphology?.principal_parts || null);
}

/**
 * Returns the grammatical gender of a nominal (noun, adjective, etc.).
 */
export async function gender(query: string, sourceLang: WikiLang = "Auto"): Promise<GroupedLexemeResults<"masculine" | "feminine" | "neuter" | null>> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    return mapLexemes(result, lexeme => lexeme.headword_morphology?.gender || null);
}

/**
 * Returns all rhyming words listed for the term.
 */
export async function rhymes(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.pronunciation?.rhymes || []);
}

/**
 * Returns all homophones listed for the term.
 */
export async function homophones(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<string[]>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.pronunciation?.homophones || []);
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
        if (!lexeme.senses) return [];
        const examples: any[] = [];
        for (const sense of lexeme.senses) {
            if (sense.examples) {
                for (const ex of sense.examples) {
                    if (typeof ex === "object") examples.push(ex);
                }
            }
        }
        return examples;
    });
}

/**
 * Returns literary citations (entries using {{quote}} templates).
 */
export async function citations(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<any[]>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => {
        if (!lexeme.senses) return [];
        const examples: any[] = [];
        for (const sense of lexeme.senses) {
            if (sense.examples) {
                for (const ex of sense.examples) {
                    if (typeof ex === "object") examples.push(ex);
                }
            }
        }
        return examples.filter(ex => ex.raw?.toLowerCase().includes("{{quote"));
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
    return mapLexemes(result, lexeme => lexeme.headword_morphology?.transitivity || null);
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
    return mapLexemes(result, lexeme => lexeme.etymology?.chain || []);
}

/**
 * Returns cognates extracted from etymology.
 */
export async function etymologyCognates(query: string, sourceLang: WikiLang = "Auto", pos: string = "Auto"): Promise<GroupedLexemeResults<any[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, lexeme => lexeme.etymology?.cognates || []);
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
    return mapLexemes(result, lexeme => lexeme.inflection_table_ref || null);
}

async function getNativeSenses(query: string, sourceLang: WikiLang, targetLang: string): Promise<string[]> {
    try {
        const origin = `https://${targetLang}.wiktionary.org/w/api.php`;
        const j = await mwFetchJson(origin, {
            action: "query", format: "json", formatversion: "2", origin: "*",
            prop: "revisions", rvprop: "content", rvslots: "main", redirects: "1", titles: query,
        });
        const page = j?.query?.pages?.[0];
        if (page?.missing) return [];
        const wikitext = page?.revisions?.[0]?.slots?.main?.content ?? "";
        if (!wikitext) return [];
        let inSection = false;
        const out: string[] = [];
        const langHeaders = {
            fr: ["== {{langue|el}} ==", "== Grec ==", "== Grec ancien =="],
            nl: ["{{=ell=}}", "{{=grc=}}"],
            de: ["== Griechisch ==", "== Altgriechisch =="],
            es: ["== {{inflect.es|el}} ==", "== Griego =="],
            it: ["== {{-el-}} ==", "== Greco =="]
        };
        const headers = (langHeaders as any)[targetLang] || [`== ${sourceLang} ==`];
        const lines = wikitext.split("\n");
        for (const line of lines) {
            if (headers.some((h: string) => line.trim().startsWith(h))) { inSection = true; continue; }
            if (inSection && /^(==|{{=).+/.test(line.trim()) && !/^===/.test(line.trim())) break;
            if (inSection && line.trim().startsWith("#") && !line.trim().startsWith("#:")) {
                const raw = line.replace(/^#+\s*/, "").trim();
                const stripped = stripWikiMarkup(raw);
                if (stripped) {
                    let s = stripped.trim().replace(/[.\s]+$/, "");
                    if (targetLang !== "de" && s.length > 0) s = s.charAt(0).toLowerCase() + s.slice(1);
                    out.push(s);
                }
            }
        }
        return out;
    } catch (e) {
        console.error(`[lightweight-scraper] Failed to fetch native senses for ${query} on ${targetLang}.wiktionary:`, e);
        return [];
    }
}
