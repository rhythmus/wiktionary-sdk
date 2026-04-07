import type { LexemeType } from "./primitives";
import type { Lexeme } from "./lexeme";
import type { Pronunciation, Hyphenation, WikidataEnrichment, WiktionarySource } from "./source-media";
import type { EtymologyData } from "./etymology";
import type { Sense } from "./sense";
import type { SemanticRelations, SemanticRelationsBySense } from "./relations";
import type { SectionWithLinks } from "./sections";

/**
 * A highly structured, hierarchical representation of an inflectional paradigm
 * (e.g., all forms of a verb across mood, tense, and voice).
 */
export interface InflectionTable {
  [dimension: string]: string | string[] | InflectionTable;
}

/**
 * A comprehensive, aggregate representation of a linguistic term, combining
 * lemma-level metadata with its full inflectional and semantic profile.
 */
export interface RichEntry {
  headword: string;
  pos: string;
  type?: LexemeType;
  form_of?: Lexeme["form_of"];
  morphology?: any;
  headword_morphology?: Lexeme["headword_morphology"];
  pronunciation?: Pronunciation;
  hyphenation?: Hyphenation;
  etymology?: EtymologyData;
  senses?: Sense[];
  relations?: SemanticRelations;
  relations_by_sense?: SemanticRelationsBySense;
  derived_terms?: SectionWithLinks;
  related_terms?: SectionWithLinks;
  descendants?: SectionWithLinks;
  usage_notes?: string[];
  references?: string[];
  inflection_table?: InflectionTable;
  translations?: Lexeme["translations"];
  wikidata?: WikidataEnrichment;
  images?: string[];
  source: WiktionarySource;
}
