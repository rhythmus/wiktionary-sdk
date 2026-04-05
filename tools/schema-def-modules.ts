/**
 * Maps modular YAML files under schema/src/defs/ to $defs keys.
 * Each key must appear exactly once across all modules.
 */
export const SCHEMA_DEF_MODULES: Record<string, readonly string[]> = {
  "01-vocabulary.yaml": [
    "schemaVersion",
    "WikiLang",
    "LexemeType",
    "LexicographicFamily",
    "LexicographicSectionSlug",
    "PartOfSpeech",
  ],
  "02-provenance-and-media.yaml": [
    "WiktionaryLanglink",
    "PageMetadataInfo",
    "WiktionarySource",
    "WikidataMedia",
    "LabelValue",
    "SitelinkValue",
    "WikidataEnrichment",
  ],
  "03-debug-and-library.yaml": [
    "MatchedTemplateRef",
    "DecoderDebugEvent",
    "ConjugateCriteria",
    "DeclineCriteria",
    "GrammarTraits",
    "LexemeResult",
    "GroupedLexemeMapValue",
  ],
  "04-pronunciation-and-templates.yaml": [
    "Pronunciation",
    "Hyphenation",
    "TemplateParams",
    "StoredTemplate",
    "StoredTemplateInstance",
    "FormOf",
    "TranslationItem",
    "HeadwordMorphology",
  ],
  "05-senses.yaml": ["Example", "AlternativeForm", "OnlyUsedIn", "Sense"],
  "06-relations.yaml": ["SemanticRelation", "SemanticRelations"],
  "07-etymology.yaml": ["EtymologyLink", "EtymologyData"],
  "08-sections-and-paradigm.yaml": ["SectionLinkItem", "SectionWithLinks", "InflectionTable"],
  "90-rich-entry.yaml": ["RichEntry"],
  "91-lexeme.yaml": ["Lexeme"],
} as const;

export function allExpectedDefKeys(): string[] {
  const keys: string[] = [];
  for (const k of Object.values(SCHEMA_DEF_MODULES)) keys.push(...k);
  return keys;
}
