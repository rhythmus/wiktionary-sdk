import { wiktionary } from "../pipeline/wiktionary-core";
import type { WikiLang } from "../model";
import { lemma } from "./lemma-translate";
import { mapLexemes, type GroupedLexemeResults } from "./grouped-results";

/** Retrieves synonyms for a term. */
export async function synonyms(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => lexeme.semantic_relations?.synonyms?.map((s) => s.term) || []);
}

/** Retrieves antonyms for a term. */
export async function antonyms(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => lexeme.semantic_relations?.antonyms?.map((s) => s.term) || []);
}

/** Retrieves hypernyms for a term. */
export async function hypernyms(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => lexeme.semantic_relations?.hypernyms?.map((h) => h.term) || []);
}

/** Retrieves hyponyms for a term. */
export async function hyponyms(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => lexeme.semantic_relations?.hyponyms?.map((h) => h.term) || []);
}

/**
 * Retrieves comeronyms (same semantic field) from the `====Comeronyms====` section.
 */
export async function comeronyms(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => lexeme.semantic_relations?.comeronyms?.map((c) => c.term) || []);
}

/**
 * Retrieves parasynonyms from the `====Parasynonyms====` section.
 */
export async function parasynonyms(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => lexeme.semantic_relations?.parasynonyms?.map((p) => p.term) || []);
}

/**
 * Retrieves collocations from the `====Collocations====` section.
 */
export async function collocations(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => lexeme.semantic_relations?.collocations?.map((c) => c.term) || []);
}
