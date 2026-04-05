import {
    morphology as getMorphology,
    conjugate as runConjugate,
    decline as runDecline,
    type ConjugateCriteria,
    type DeclineCriteria,
    type GrammarTraits,
} from "./morphology";
import { wiktionary } from "../pipeline/wiktionary-core";
import type { LexicographicFamily, PartOfSpeech, WikiLang } from "../model";
import { mapLexemes, type GroupedLexemeResults } from "./grouped-results";

/**
 * Extracts the primary IPA transcription or audio file.
 */
export async function pronounce(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string | null>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(
        result,
        (lexeme) => lexeme.pronunciation?.audio_url || lexeme.pronunciation?.audio || lexeme.pronunciation?.IPA || null,
    );
}

/** Extracts the primary IPA transcription. */
export async function ipa(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string | null>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => lexeme.pronunciation?.IPA || null);
}

export const phonetic = ipa;

/**
 * Returns the hyphenation (syllables).
 */
export async function hyphenate(
    query: string,
    sourceLang: WikiLang = "Auto",
    options: { separator?: string; format?: "string" | "array" } = {},
    pos: string = "Auto",
): Promise<GroupedLexemeResults<any>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const syllables = lexeme.hyphenation?.syllables || null;
        if (!syllables) return null;
        if (options.format === "array") return syllables;
        if (options.separator || options.format === "string") return syllables.join(options.separator || "-");
        return syllables;
    });
}

/** Returns the number of syllables. */
export async function syllableCount(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<number>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const syllables = lexeme.hyphenation?.syllables;
        return syllables ? syllables.length : 0;
    });
}

/**
 * Returns the strict grammatical part of speech when known (e.g. verb, noun); otherwise null.
 * Use {@link lexicographicClass} for section slug and family (morpheme, symbol, phraseology, …).
 */
export async function partOfSpeech(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<PartOfSpeech | null>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => lexeme.part_of_speech ?? null);
}

export interface LexicographicClass {
    lexicographic_section: string;
    lexicographic_family: LexicographicFamily;
    part_of_speech: PartOfSpeech | null;
}

/**
 * Full lexeme-class taxonomy: section slug, family bucket, and strict PoS (if any).
 */
export async function lexicographicClass(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<LexicographicClass>> {
    const result = await wiktionary({ query, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => ({
        lexicographic_section: lexeme.lexicographic_section,
        lexicographic_family: lexeme.lexicographic_family,
        part_of_speech: lexeme.part_of_speech ?? null,
    }));
}

/** Retrieves the morphology traits of the word. */
export async function morphology(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<Partial<GrammarTraits>>> {
    return getMorphology(query, sourceLang, pos);
}

/**
 * Conjugates a verb based on criteria. Returns null if the word is not a verb.
 * If no criteria are provided, returns the full conjugation table.
 */
export async function conjugate(
    query: string,
    sourceLang: WikiLang = "Auto",
    criteria: Partial<ConjugateCriteria> = {},
): Promise<GroupedLexemeResults<string[] | Record<string, any> | null>> {
    return runConjugate(query, criteria, sourceLang);
}

/**
 * Declines a nominal (noun, adj, etc.) based on criteria. Returns null if not a nominal.
 * If no criteria are provided, returns the full declension table.
 */
export async function decline(
    query: string,
    sourceLang: WikiLang = "Auto",
    criteria: Partial<DeclineCriteria> = {},
): Promise<GroupedLexemeResults<string[] | Record<string, any> | null>> {
    return runDecline(query, criteria, sourceLang);
}
