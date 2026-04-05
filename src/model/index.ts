export { SCHEMA_VERSION } from "./schema-version";
export type { LexicographicFamily } from "./lexicographic";
export {
  PART_OF_SPEECH_VALUES,
  type PartOfSpeech,
  isPartOfSpeech,
} from "./part-of-speech";
export type { WikiLang, LexemeType } from "./primitives";
export type {
  Pronunciation,
  Hyphenation,
  WiktionarySource,
  WikidataEnrichment,
} from "./source-media";
export type { Example, OnlyUsedIn, Sense } from "./sense";
export type { SemanticRelation, SemanticRelations } from "./relations";
export type {
  EtymologyLink,
  EtymologyData,
  EtymologyStep,
  LegacyEtymologyLinks,
} from "./etymology";
export type { SectionLinkItem, SectionWithLinks } from "./sections";
export type { Lexeme } from "./lexeme";
export type { InflectionTable, RichEntry } from "./rich-entry";
export type { DecoderDebugEvent, LexemeResult, FetchResult } from "./fetch-result";
export type { TemplateCall, DecodeContext, TemplateDecoder } from "./templates-decode";
