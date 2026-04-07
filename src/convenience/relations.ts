import { wiktionary } from "../pipeline/wiktionary-core";
import type { WikiLang, SemanticRelation, SemanticRelations, SemanticRelationsBySense } from "../model";
import { lemma } from "./lemma-translate";
import { mapLexemes, type GroupedLexemeResults } from "./grouped-results";
import { warnSemanticRelationList, withExtractionSupport } from "./extraction-support";

type RelationFamily = keyof SemanticRelations;

function extractRelationTerms(
    family: RelationFamily,
    relations: SemanticRelations | undefined,
): string[] {
    return (relations?.[family] ?? []).map((r: SemanticRelation) => r.term);
}

function extractRelationsBySense(
    family: RelationFamily,
    bySense: SemanticRelationsBySense | undefined,
): Record<string, SemanticRelation[]> {
    if (!bySense) return {};
    const out: Record<string, SemanticRelation[]> = {};
    for (const [senseId, rels] of Object.entries(bySense)) {
        const items = rels[family];
        if (items && items.length > 0) out[senseId] = items;
    }
    return out;
}

/** Retrieves synonyms for a term. */
export async function synonyms(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const terms = extractRelationTerms("synonyms", lexeme.semantic_relations);
        return withExtractionSupport(terms, warnSemanticRelationList(lexeme, "synonyms", terms));
    });
}

/** Retrieves synonyms grouped by sense. */
export async function synonymsBySense(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<Record<string, SemanticRelation[]>>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) =>
        extractRelationsBySense("synonyms", lexeme.semantic_relations_by_sense),
    );
}

/** Retrieves antonyms for a term. */
export async function antonyms(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const terms = extractRelationTerms("antonyms", lexeme.semantic_relations);
        return withExtractionSupport(terms, warnSemanticRelationList(lexeme, "antonyms", terms));
    });
}

/** Retrieves antonyms grouped by sense. */
export async function antonymsBySense(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<Record<string, SemanticRelation[]>>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) =>
        extractRelationsBySense("antonyms", lexeme.semantic_relations_by_sense),
    );
}

/** Retrieves hypernyms for a term. */
export async function hypernyms(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const terms = extractRelationTerms("hypernyms", lexeme.semantic_relations);
        return withExtractionSupport(terms, warnSemanticRelationList(lexeme, "hypernyms", terms));
    });
}

/** Retrieves hyponyms for a term. */
export async function hyponyms(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => {
        const terms = extractRelationTerms("hyponyms", lexeme.semantic_relations);
        return withExtractionSupport(terms, warnSemanticRelationList(lexeme, "hyponyms", terms));
    });
}

/** Retrieves comeronyms (same semantic field). */
export async function comeronyms(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => extractRelationTerms("comeronyms", lexeme.semantic_relations));
}

/** Retrieves parasynonyms. */
export async function parasynonyms(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => extractRelationTerms("parasynonyms", lexeme.semantic_relations));
}

/** Retrieves collocations. */
export async function collocations(
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<string[]>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) => extractRelationTerms("collocations", lexeme.semantic_relations));
}

/** Generic sense-grouped accessor for any relation family. */
export async function relationsBySense(
    family: RelationFamily,
    query: string,
    sourceLang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<Record<string, SemanticRelation[]>>> {
    const lemmaStr = await lemma(query, sourceLang, pos);
    const result = await wiktionary({ query: lemmaStr, lang: sourceLang, pos });
    return mapLexemes(result, (lexeme) =>
        extractRelationsBySense(family, lexeme.semantic_relations_by_sense),
    );
}
