import { wiktionary } from "../pipeline/wiktionary-core";
import type { RichEntry, WikiLang } from "../model";
import { lemma } from "./lemma-translate";
import { mapLexemes, type GroupedLexemeResults } from "./grouped-results";

/**
 * Produces a high-fidelity dictionary entry object containing all extracted
 * linguistic data for a given term.
 */
export async function richEntry(
    query: string,
    lang: WikiLang = "Auto",
    pos: string = "Auto",
): Promise<GroupedLexemeResults<RichEntry | null>> {
    const originalResult = await wiktionary({ query, lang, pos });

    const inflectedSource = originalResult.lexemes.find((e) => e.type === "INFLECTED_FORM" && e.form === query);
    const resolvedTriggeredId = inflectedSource
        ? originalResult.lexemes.find((e) => e.lemma_triggered_by_lexeme_id === inflectedSource.id)?.id
        : undefined;

    const lemmaStr = await lemma(query, lang, pos);
    const result = await wiktionary({ query: lemmaStr, lang, pos });

    return mapLexemes(result, (lexeme) => {
        const entryPos = (
            lexeme.part_of_speech ||
            lexeme.lexicographic_section ||
            lexeme.part_of_speech_heading ||
            "unknown"
        ).toLowerCase();

        const inflectedForLexeme =
            resolvedTriggeredId && lexeme.id === resolvedTriggeredId ? inflectedSource : undefined;

        return {
            headword: inflectedForLexeme ? query : lexeme.form,
            type: inflectedForLexeme
                ? ("INFLECTED_FORM" as const)
                : lexeme.type === "FORM_OF"
                  ? ("FORM_OF" as const)
                  : ("LEXEME" as const),
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
                synonyms: lexeme.semantic_relations?.synonyms?.map((s) => ({ term: s.term })) || [],
                antonyms: lexeme.semantic_relations?.antonyms?.map((a) => ({ term: a.term })) || [],
                hypernyms: lexeme.semantic_relations?.hypernyms?.map((h) => ({ term: h.term })),
                hyponyms: lexeme.semantic_relations?.hyponyms?.map((h) => ({ term: h.term })),
                coordinate_terms: lexeme.semantic_relations?.coordinate_terms?.map((c) => ({ term: c.term })),
                holonyms: lexeme.semantic_relations?.holonyms?.map((h) => ({ term: h.term })),
                meronyms: lexeme.semantic_relations?.meronyms?.map((m) => ({ term: m.term })),
                troponyms: lexeme.semantic_relations?.troponyms?.map((t) => ({ term: t.term })),
                comeronyms: lexeme.semantic_relations?.comeronyms?.map((c) => ({ term: c.term })),
                parasynonyms: lexeme.semantic_relations?.parasynonyms?.map((p) => ({ term: p.term })),
                collocations: lexeme.semantic_relations?.collocations?.map((c) => ({ term: c.term })),
            },
            derived_terms: lexeme.derived_terms,
            related_terms: lexeme.related_terms,
            descendants: lexeme.descendants,
            usage_notes: lexeme.usage_notes,
            references: lexeme.references,
            inflection_table: null as any,
            translations: lexeme.translations,
            wikidata: lexeme.wikidata
                ? {
                      ...lexeme.wikidata,
                      subclass_of: lexeme.wikidata.subclass_of,
                  }
                : undefined,
            images: lexeme.images,
            source: lexeme.source.wiktionary,
        };
    });
}
