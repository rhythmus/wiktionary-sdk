export { wiktionary, wiktionaryRecursive, stripCombiningMarksForPageTitle } from "./pipeline/wiktionary-core";
export type { LexemeSortOption, LexemeSortStrategy } from "./pipeline/wiktionary-core";

export {
    LANG_PRIORITY,
    SERVER_DEFAULT_WIKI_LANG,
    DEFAULT_CACHE_TTL_MS,
    DEFAULT_RATE_LIMIT_MIN_INTERVAL_MS,
} from "./infra/constants";
export { configureSdk, configureRateLimiter, configureCache } from "./ingress/configure";
export type { SdkConfig, RateLimiterConfig, CacheAdapter } from "./ingress/configure";
export * from "./convenience";
export * from "./present/formatter";
export * from "./present/lexeme-display-groups";
export type { GrammarTraits, ConjugateCriteria, DeclineCriteria } from "./convenience/morphology";
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
} from "./model";
export {
  PART_OF_SPEECH_VALUES,
  isPartOfSpeech,
  SCHEMA_VERSION,
} from "./model";
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
