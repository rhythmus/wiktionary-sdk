import { wiktionary } from "./index";
import { mwFetchJson } from "./api";
import { stripWikiMarkup } from "./registry";
import { morphology as getMorphology, conjugate as runConjugate, decline as runDecline } from "./morphology";
import type { WikiLang, FetchResult, Entry, RichEntry } from "./types";
import type { ConjugateCriteria, DeclineCriteria, GrammarTraits } from "./morphology";

export interface TranslationOptions {
    /** 
     * "gloss" -> Returns mapped equivalents from en.wiktionary's Translations table (default).
     * "senses" -> Returns full prose definitions by hitting the target's native Wiktionary domain.
     */
    mode?: "gloss" | "senses";
}

/**
 * Helper to find the "Main" entry of a word result, skipping meta-entries like Pronunciation
 * or Etymology sections that don't carry primary definitions.
 */
export function getMainLexeme(result: FetchResult): Entry | null {
    if (!result.entries || result.entries.length === 0) return null;
    
    // 1. Priority: The first entry that has an explicit part_of_speech tag
    const posEntry = result.entries.find(e => e.part_of_speech !== undefined && e.part_of_speech !== null);
    if (posEntry) return posEntry;

    // 2. Secondary: The first LEXEME that isn't just a meta-heading
    const metaHeadings = ["pronunciation", "etymology", "references", "anagrams"];
    const mainLexeme = result.entries.find(e => 
        e.type === "LEXEME" && 
        !metaHeadings.includes((e.part_of_speech_heading || "").toLowerCase())
    );
    if (mainLexeme) return mainLexeme;

    // 3. Fallback: Take the first Lexeme or first exact form
    return result.entries.find(e => e.type === "LEXEME") || result.entries[0] || null;
}

/**
 * Returns the canonical dictionary form (lemma) of an inflected word.
 */
export async function lemma(query: string, sourceLang: WikiLang): Promise<string> {
    const result = await wiktionary({ query, lang: sourceLang });
    const exact = result.entries.find(e => e.form === query);
    
    if (exact?.type === "INFLECTED_FORM" && exact.form_of?.lemma) {
        return exact.form_of.lemma;
    }
    return query;
}

/**
 * Retrieves translations for a term in a specific target language.
 */
export async function translate(
    query: string,
    sourceLang: WikiLang,
    targetLang: string,
    options: TranslationOptions = { mode: "gloss" }
): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);

    if (options.mode === "senses") {
        if (targetLang === "en") {
            const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
            const lexeme = getMainLexeme(result);
            if (!lexeme || !lexeme.senses) return [];
            return lexeme.senses.map((s: any) => s.gloss);
        } else {
            return await getNativeSenses(lemmaStr, sourceLang, targetLang);
        }
    }

    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    if (!lexeme || !lexeme.translations) return [];

    const targetTranslations = lexeme.translations[targetLang] || [];
    return targetTranslations.map((tr: any) => tr.term);
}

/**
 * Retrieves synonyms for a term.
 */
export async function synonyms(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    if (!lexeme || !lexeme.semantic_relations?.synonyms) return [];
    return lexeme.semantic_relations.synonyms.map(s => s.term);
}

/**
 * Retrieves antonyms for a term.
 */
export async function antonyms(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    if (!lexeme || !lexeme.semantic_relations?.antonyms) return [];
    return lexeme.semantic_relations.antonyms.map(s => s.term);
}

/**
 * Retrieves hypernyms for a term.
 */
export async function hypernyms(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    if (!lexeme || !lexeme.semantic_relations?.hypernyms) return [];
    return lexeme.semantic_relations.hypernyms.map(h => h.term);
}

/**
 * Retrieves hyponyms for a term.
 */
export async function hyponyms(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    if (!lexeme || !lexeme.semantic_relations?.hyponyms) return [];
    return lexeme.semantic_relations.hyponyms.map(h => h.term);
}

/**
 * Retrieves derivations/derived terms.
 */
export async function derivedTerms(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    if (!lexeme || !lexeme.derived_terms?.items) return [];
    return lexeme.derived_terms.items.map(i => i.term);
}

/**
 * Retrieves related terms.
 */
export async function relatedTerms(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    if (!lexeme || !lexeme.related_terms?.items) return [];
    return lexeme.related_terms.items.map(i => i.term);
}

/**
 * Extracts the primary IPA transcription or audio file.
 */
export async function pronounce(query: string, sourceLang: WikiLang): Promise<string | null> {
    const result = await wiktionary({ query, lang: sourceLang });
    const lexeme = result.entries.find(e => e.pronunciation?.IPA || e.pronunciation?.audio);
    if (!lexeme) return null;
    return lexeme.pronunciation?.IPA || lexeme.pronunciation?.audio || null;
}

/**
 * Extracts the primary IPA transcription.
 */
export async function ipa(query: string, sourceLang: WikiLang): Promise<string | null> {
    const result = await wiktionary({ query, lang: sourceLang });
    const exact = result.entries.find(e => e.form === query && e.pronunciation?.IPA);
    if (exact) return exact.pronunciation!.IPA ?? null;
    
    const lexeme = result.entries.find(e => e.pronunciation?.IPA);
    return lexeme?.pronunciation?.IPA || null;
}

/**
 * Returns the hyphenation (syllables).
 */
export async function hyphenate(query: string, sourceLang: WikiLang): Promise<string[] | null> {
    const result = await wiktionary({ query, lang: sourceLang });
    const exact = result.entries.find(e => e.form === query && e.hyphenation?.syllables);
    if (exact) return exact.hyphenation!.syllables ?? null;

    const lexeme = result.entries.find(e => e.hyphenation?.syllables);
    return lexeme?.hyphenation?.syllables || null;
}

/**
 * Returns the normalized structural identifier (e.g., "verb", "noun").
 */
export async function partOfSpeech(query: string, sourceLang: WikiLang): Promise<string | null> {
    const result = await wiktionary({ query, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    return lexeme?.part_of_speech || lexeme?.part_of_speech_heading || null;
}

/**
 * Retrieves the morphology traits of the word.
 */
export async function morphology(query: string, sourceLang: WikiLang): Promise<Partial<GrammarTraits>> {
    return getMorphology(query, sourceLang);
}

/**
 * Conjugates a verb based on criteria. Returns null if the word is not a verb.
 * If no criteria are provided, returns the full conjugation table.
 */
export async function conjugate(query: string, sourceLang: WikiLang, criteria: Partial<ConjugateCriteria> = {}): Promise<string[] | Record<string, any> | null> {
    const pos = (await partOfSpeech(query, sourceLang))?.toLowerCase() || "";
    if (!pos.includes("verb") && !pos.includes("\u03c1\u03ae\u03bc\u03b1")) return null; // \u03c1\u03ae\u03bc\u03b1 = \u03c1\u03ae\u03bc\u03b1 (Greek for verb)
    return runConjugate(query, criteria, sourceLang);
}

/**
 * Declines a nominal (noun, adj, etc.) based on criteria. Returns null if not a nominal.
 * If no criteria are provided, returns the full declension table.
 */
export async function decline(query: string, sourceLang: WikiLang, criteria: Partial<DeclineCriteria> = {}): Promise<string[] | Record<string, any> | null> {
    const pos = (await partOfSpeech(query, sourceLang))?.toLowerCase() || "";
    const nominals = ["noun", "adjective", "proper_noun", "pronoun", "article", "numeral", "participle", "proper noun"];
    if (pos && !nominals.some(n => pos.includes(n))) return null;
    return runDecline(query, criteria, sourceLang);
}

/**
 * Produces a high-fidelity dictionary entry object containing all extracted 
 * linguistic data for a given term.
 */
export async function richEntry(query: string, lang: WikiLang = "el"): Promise<RichEntry | null> {
    const lemmaStr = await lemma(query, lang);
    const result = await wiktionary({ query: lemmaStr, lang });
    const lexeme = getMainLexeme(result);
    if (!lexeme) return null;

    const pos = (lexeme.part_of_speech || lexeme.part_of_speech_heading || "unknown").toLowerCase();

    // Optimize: Most data is already in lexeme. Just pull it.
    const morph = await morphology(query, lang);
    const etymStep = await etymology(query, lang); // This one still needs a helper or internal logic

    const syns = lexeme.semantic_relations?.synonyms?.map(s => ({ term: s.term })) || [];
    const ants = lexeme.semantic_relations?.antonyms?.map(a => ({ term: a.term })) || [];
    
    // For inflection, we still call the conjugates/decline as they handle DOM scraping
    let infl = null;
    if (pos === "verb") {
        infl = await runConjugate(query, {}, lang);
    } else if (["noun", "adjective", "proper noun"].some(p => pos.includes(p))) {
        infl = await runDecline(query, {}, lang);
    }

    return {
        headword: lexeme.form,
        pos: pos,
        morphology: morph,
        pronunciation: lexeme.pronunciation,
        hyphenation: lexeme.hyphenation,
        etymology: etymStep as any[],
        senses: lexeme.senses,
        relations: {
            synonyms: syns,
            antonyms: ants
        },
        derived_terms: lexeme.derived_terms?.items?.map(i => i.term) || [],
        related_terms: lexeme.related_terms?.items?.map(i => i.term) || [],
        inflection_table: infl as any,
        translations: lexeme.translations,
        wikidata: lexeme.wikidata,
        source: lexeme.source.wiktionary
    };
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

export async function etymology(query: string, sourceLang: WikiLang): Promise<EtymologyStep[] | null> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    if (!lexeme || !lexeme.etymology || !lexeme.etymology.links) return null;

    const output: EtymologyStep[] = [];
    for (const link of lexeme.etymology.links) {
        if (!link.term) continue;
        output.push({ lang: resolveLangCode(link.source_lang), form: link.term });
    }
    return output.length > 0 ? output : null;
}

export async function wikidataQid(query: string, sourceLang: WikiLang): Promise<string | null> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    return lexeme?.wikidata?.qid || null;
}

export async function image(query: string, sourceLang: WikiLang): Promise<string | null> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    return lexeme?.wikidata?.media?.thumbnail || null;
}

export async function wikipediaLink(query: string, sourceLang: WikiLang, targetWikiLang: WikiLang = "en"): Promise<string | null> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    if (!lexeme || !lexeme.wikidata?.sitelinks) return null;
    const sitelinkKey = targetWikiLang + "wiki";
    const link = (lexeme.wikidata.sitelinks as Record<string, any>)[sitelinkKey];
    return link?.url || null;
}

export async function usageNotes(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = getMainLexeme(result);
    return lexeme?.usage_notes || [];
}

async function getNativeSenses(query: string, sourceLang: WikiLang, targetLang: string): Promise<string[]> {
    // ... existing implementation ...
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
