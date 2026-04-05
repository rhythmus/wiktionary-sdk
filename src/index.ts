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
export type { WikiLang, LexemeType, Lexeme, LexemeResult, FetchResult, RichEntry, OnlyUsedIn, EtymologyStep } from "./types";
export {
    registerAllDecoders,
    isFormOfTemplateName,
    isVariantFormOfTemplateName,
} from "./registry";
