export { wiktionary, wiktionaryRecursive, stripCombiningMarksForPageTitle } from "./wiktionary-core";

export {
    LANG_PRIORITY,
    SERVER_DEFAULT_WIKI_LANG,
    DEFAULT_CACHE_TTL_MS,
    DEFAULT_RATE_LIMIT_MIN_INTERVAL_MS,
} from "./constants";
export * from "./library";
export * from "./formatter";
export * from "./lexeme-display-groups";
export * from "./stem";
export * from "./wrapper-invoke";
export type { GrammarTraits, ConjugateCriteria, DeclineCriteria } from "./morphology";
export type {
  WikiLang,
  LexemeType,
  Lexeme,
  LexemeResult,
  FetchResult,
  RichEntry,
  OnlyUsedIn,
  EtymologyStep,
  PartOfSpeech,
  LexicographicFamily,
} from "./types";
export {
  PART_OF_SPEECH_VALUES,
  isPartOfSpeech,
  SCHEMA_VERSION,
} from "./types";
export {
  mapHeadingToLexicographic,
  mapHeadingToStrictPartOfSpeech,
  isLexemeSectionHeading,
  fallbackLexicographicFromHeading,
  lexemeMatchesPosQuery,
  lexemePosSortKey,
  getLexicographicTaxonomyStats,
} from "./parse/lexicographic-headings";
export type { LexicographicHeadingResult } from "./parse/lexicographic-headings";
export {
    registerAllDecoders,
    isFormOfTemplateName,
    isVariantFormOfTemplateName,
} from "./decode/registry";
