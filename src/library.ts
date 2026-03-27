import { wiktionary } from "./index";
import { mwFetchJson } from "./api";
import { stripWikiMarkup } from "./registry";
import type { WikiLang } from "./types";

export interface TranslationOptions {
    /** 
     * "gloss" -> Returns mapped equivalents from en.wiktionary's Translations table (default).
     * "senses" -> Returns full prose definitions by hitting the target's native Wiktionary domain.
     */
    mode?: "gloss" | "senses";
}

/**
 * Convenience function to fetch translations for a term in a specific target language.
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
            // For English, the senses are already in en.wiktionary
            const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
            const lexeme = result.entries.find(e => e.type === "LEXEME");
            if (!lexeme || !lexeme.senses) return [];
            return lexeme.senses.map((s: any) => s.gloss);
        } else {
            return await getNativeSenses(lemmaStr, sourceLang, targetLang);
        }
    }

    // Default "gloss" mode
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    if (!lexeme || !lexeme.translations) {
        return [];
    }

    const targetTranslations = lexeme.translations[targetLang] || [];
    return targetTranslations.map((tr: any) => tr.term);
}

/**
 * Lowercases the first letter (except for German where nouns are capitalized)
 * and strips trailing punctuation.
 */
function normalizeGloss(gloss: string, lang: string): string {
    let s = gloss.trim().replace(/[.\s]+$/, "");
    if (lang !== "de" && s.length > 0) {
        s = s.charAt(0).toLowerCase() + s.slice(1);
    }
    return s;
}

/**
 * A lightweight fallback scraper that bypasses the strict `registry` to extract
 * prose definitions directly from foreign Wiktionary domains.
 */
async function getNativeSenses(query: string, sourceLang: WikiLang, targetLang: string): Promise<string[]> {
    try {
        const origin = `https://${targetLang}.wiktionary.org/w/api.php`;
        const j = await mwFetchJson(origin, {
            action: "query",
            format: "json",
            formatversion: "2",
            origin: "*",
            prop: "revisions",
            rvprop: "content",
            rvslots: "main",
            redirects: "1",
            titles: query,
        });

        const page = j?.query?.pages?.[0];
        if (page?.missing) return [];
        
        const wikitext = page?.revisions?.[0]?.slots?.main?.content ?? "";
        if (!wikitext) return [];

        // Dynamic header matching based on target language conventions
        let inSection = false;
        const out: string[] = [];

        // Standardized mapped headers for other top languages looking up Greek
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
            // Did we hit our source language boundary?
            if (headers.some((h: string) => line.trim().startsWith(h))) {
                inSection = true;
                continue;
            }
            // Did we hit a new language boundary?
            if (inSection && /^(==|{{=).+/.test(line.trim()) && !/^===/.test(line.trim())) {
                break;
            }
            
            if (inSection && line.trim().startsWith("#") && !line.trim().startsWith("#:")) {
                const raw = line.replace(/^#+\s*/, "").trim();
                const stripped = stripWikiMarkup(raw);
                if (stripped) {
                    const gloss = normalizeGloss(stripped, targetLang);
                    out.push(gloss);
                }
            }
        }

        return out;
    } catch (e) {
        console.error(`[lightweight-scraper] Failed to fetch native senses for ${query} on ${targetLang}.wiktionary:`, e);
        return [];
    }
}

/**
 * Returns the canonical dictionary form (lemma) of an inflected word.
 * If the query is already the lemma, it silently returns the query itself.
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
 * Retrieves the synonyms for a term in the source language.
 */
export async function synonyms(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    if (!lexeme || !lexeme.semantic_relations?.synonyms) return [];
    return lexeme.semantic_relations.synonyms.map(s => s.term);
}

/**
 * Retrieves the antonyms for a term in the source language.
 */
export async function antonyms(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    if (!lexeme || !lexeme.semantic_relations?.antonyms) return [];
    return lexeme.semantic_relations.antonyms.map(s => s.term);
}

/**
 * Retrieves derivations/derived terms for a term.
 */
export async function derivations(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    if (!lexeme || !lexeme.derived_terms?.items) return [];
    return lexeme.derived_terms.items.map(i => i.term);
}

/**
 * Extracts the primary IPA phonetic transcription for a term.
 */
export async function phonetic(query: string, sourceLang: WikiLang): Promise<string | null> {
    const result = await wiktionary({ query, lang: sourceLang });
    
    const exact = result.entries.find(e => e.form === query && e.pronunciation?.IPA);
    if (exact) return exact.pronunciation!.IPA ?? null;
    
    // Fallback to LEXEME if exact form doesn't carry pronunciation
    const lexeme = result.entries.find(e => e.type === "LEXEME" && e.pronunciation?.IPA);
    return lexeme && lexeme.pronunciation?.IPA ? lexeme.pronunciation.IPA : null;
}

export interface HyphenateOptions {
    /** Whether to return the raw array of syllables, or a joined string. Defaults to "string" */
    format?: "array" | "string";
    /** The character used to join syllables when format="string". Defaults to "-" */
    separator?: string;
}

/**
 * Returns the hyphenation/segmentation of the exact query term.
 */
export async function hyphenate(
    query: string, 
    sourceLang: WikiLang, 
    options: HyphenateOptions = {}
): Promise<string | string[] | null> {
    const format = options.format || "string";
    const separator = options.separator ?? "-";

    const result = await wiktionary({ query, lang: sourceLang });
    const exact = result.entries.find(e => e.form === query && e.hyphenation?.syllables);

    if (!exact || !exact.hyphenation?.syllables) return null;

    if (format === "array") return exact.hyphenation.syllables;
    return exact.hyphenation.syllables.join(separator);
}

export interface EtymologyStep {
    lang: string;
    form: string;
}

const WIKTIONARY_LANG_MACROS: Record<string, string> = {
    "ine-pro": "PIE",
    "grk-pro": "Proto-Greek",
    "gem-pro": "Proto-Germanic",
    "itc-pro": "Proto-Italic",
    "sla-pro": "Proto-Slavic",
    "cel-pro": "Proto-Celtic",
    "iir-pro": "Proto-Indo-Iranian",
    "trk-pro": "Proto-Turkic",
    "ira-pro": "Proto-Iranian",
    "sem-pro": "Proto-Semitic",
    "urj-pro": "Proto-Uralic",
    "gkm": "Medieval Greek",
};

/**
 * Normalizes Wiktionary pseudo-codes into standardized BCP 47 tags or English terminology.
 */
function resolveLangCode(code: string): string {
    if (WIKTIONARY_LANG_MACROS[code]) return WIKTIONARY_LANG_MACROS[code];
    if (code.endsWith("-pro")) {
        const base = code.replace("-pro", "");
        return "Proto-" + base.charAt(0).toUpperCase() + base.slice(1);
    }
    return code; // Fallback to verbatim BCP-47 tag provided by Wiktionary
}

/**
 * Returns a structured lineage graph mapping step integers to etymological origins.
 */
export async function etymology(query: string, sourceLang: WikiLang): Promise<Record<number, EtymologyStep> | null> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    if (!lexeme || !lexeme.etymology || !lexeme.etymology.links) {
        return null;
    }

    const output: Record<number, EtymologyStep> = {};
    let step = 1;

    for (const link of lexeme.etymology.links) {
        if (!link.term) continue; // skip pure language mentions without forms
        output[step] = {
            lang: resolveLangCode(link.source_lang),
            form: link.term
        };
        step++;
    }

    return Object.keys(output).length > 0 ? output : null;
}

// ==========================================
// SEMANTIC NETWORK EXPANSION
// ==========================================

/**
 * Retrieves the hypernyms (broader terms) for a term.
 */
export async function hypernyms(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    if (!lexeme || !lexeme.semantic_relations?.hypernyms) return [];
    return lexeme.semantic_relations.hypernyms.map(s => s.term);
}

/**
 * Retrieves the hyponyms (narrower terms) for a term.
 */
export async function hyponyms(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    if (!lexeme || !lexeme.semantic_relations?.hyponyms) return [];
    return lexeme.semantic_relations.hyponyms.map(s => s.term);
}

/**
 * Retrieves derived terms for a term. Same as derivations(), kept for explicit semantics mapping.
 */
export async function derivedTerms(query: string, sourceLang: WikiLang): Promise<string[]> {
    return derivations(query, sourceLang);
}

/**
 * Retrieves related terms explicitly listed by Wiktionary editors.
 */
export async function relatedTerms(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    if (!lexeme || !lexeme.related_terms?.items) return [];
    return lexeme.related_terms.items.map(i => i.term);
}

// ==========================================
// PHONETICS & MEDIA
// ==========================================

export const ipa = phonetic; // Alias for exact semantic clarity

/**
 * Returns the absolute URL string pointing to the Wikimedia Commons audio pronunciation file, if available.
 */
export async function pronounce(query: string, sourceLang: WikiLang): Promise<string | null> {
    const result = await wiktionary({ query, lang: sourceLang });
    const exact = result.entries.find(e => e.form === query && e.pronunciation?.audio);
    if (exact && exact.pronunciation?.audio) return exact.pronunciation.audio;
    
    // Fallback to LEXEME
    const lexeme = result.entries.find(e => e.type === "LEXEME" && e.pronunciation?.audio);
    return lexeme && lexeme.pronunciation?.audio ? lexeme.pronunciation.audio : null;
}

// ==========================================
// ONTOLOGICAL WIKIDATA HOOKS
// ==========================================

/**
 * Returns the exact Wikidata QID (e.g. "Q458") identifying the concept represented by the word.
 */
export async function wikidataQid(query: string, sourceLang: WikiLang): Promise<string | null> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    if (!lexeme || !lexeme.wikidata?.qid) return null;
    return lexeme.wikidata.qid;
}

/**
 * Returns a Wikimedia Commons thumbnail URI specifically resolved from the P18 item property.
 */
export async function image(query: string, sourceLang: WikiLang): Promise<string | null> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    if (!lexeme || !lexeme.wikidata?.media?.thumbnail) return null;
    return lexeme.wikidata.media.thumbnail;
}

/**
 * Translates the abstract lexical dictionary entry directly into a Wikipedia encyclopedic article URL.
 */
export async function wikipediaLink(query: string, sourceLang: WikiLang, targetWikiLang: WikiLang = "en"): Promise<string | null> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    if (!lexeme || !lexeme.wikidata?.sitelinks) return null;
    
    const sitelinkKey = targetWikiLang + "wiki";
    const link = (lexeme.wikidata.sitelinks as Record<string, any>)[sitelinkKey];
    if (link && link.url) return link.url;
    return null;
}

// ==========================================
// LEXICOGRAPHER CONTEXT
// ==========================================

/**
 * Returns the normalized structural identifier (e.g., "noun", "verb").
 */
export async function partOfSpeech(query: string, sourceLang: WikiLang): Promise<string | null> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    return lexeme?.part_of_speech || lexeme?.part_of_speech_heading || null;
}

/**
 * Returns a string array of explicit editorial caveats (usage notes).
 */
export async function usageNotes(query: string, sourceLang: WikiLang): Promise<string[]> {
    const lemmaStr = await lemma(query, sourceLang);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang });
    const lexeme = result.entries.find(e => e.type === "LEXEME");
    if (!lexeme || !lexeme.usage_notes) return [];
    return lexeme.usage_notes;
}

