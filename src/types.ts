/** Current version of the normalized output schema. See VERSIONING.md. */
export const SCHEMA_VERSION = "1.0.0";

/** BCP-47-style language code. Common values: `el`, `grc`, `en`, `nl`, `de`, `fr`. */
export type WikiLang = "el" | "grc" | "en" | "nl" | "de" | "fr" | string;

/** Discriminator for the kind of dictionary entry. */
export type EntryType = "LEXEME" | "INFLECTED_FORM" | "FORM_OF" | string;

export interface Pronunciation {
  IPA?: string;
  audio?: string;
}

export interface Hyphenation {
  syllables?: string[];
  raw: string;
}

export interface WiktionarySource {
  site: string;
  title: string;
  language_section: string;
  etymology_index: number;
  pos_heading: string;
}

export interface WikidataEnrichment {
  qid: string;
  labels?: Record<string, { language: string; value: string }>;
  descriptions?: Record<string, { language: string; value: string }>;
  sitelinks?: Record<string, { site: string; title: string; url?: string }>;
  media?: {
    P18?: string;
    commons_file?: string;
    thumbnail?: string;
  };
}

export interface Sense {
  id: string;
  gloss: string;
  examples?: string[];
  subsenses?: Sense[];
}

export interface SemanticRelation {
  term: string;
  sense_id?: string;
  qualifier?: string;
}

export interface SemanticRelations {
  synonyms?: SemanticRelation[];
  antonyms?: SemanticRelation[];
  hypernyms?: SemanticRelation[];
  hyponyms?: SemanticRelation[];
}

export interface EtymologyLink {
  template: string;
  source_lang: string;
  source_lang_name?: string;
  term?: string;
  gloss?: string;
  raw: string;
}

export interface EtymologyData {
  links?: EtymologyLink[];
  raw_text?: string;
}

/**
 * A single normalized dictionary entry produced by the extraction pipeline.
 * Each entry is fully traceable to its source wikitext section.
 */
export interface Entry {
  id: string;
  language: WikiLang;
  query: string;
  type: EntryType;
  form: string;
  etymology_index: number;
  part_of_speech_heading: string;
  part_of_speech?: string | null;
  pronunciation?: Pronunciation;
  hyphenation?: Hyphenation;
  form_of?: {
    template: string;
    lemma: string | null;
    lang: string;
    tags: string[];
    named: Record<string, string>;
  };
  translations?: Record<string, Array<{
    gloss: string;
    sense: string | null;
    template: string;
    raw: string;
    params: any;
  }>>;
  templates: Record<string, Array<{
    params: {
      positional: string[];
      named: Record<string, string>;
    };
    raw: string;
  }>>;
  senses?: Sense[];
  semantic_relations?: SemanticRelations;
  etymology?: EtymologyData;
  usage_notes?: string[];
  wikidata?: WikidataEnrichment;
  resolved_for_query?: string;
  preferred?: boolean;
  source: {
    wiktionary: WiktionarySource;
  };
}

/** Top-level result returned by {@link fetchWiktionary}. */
export interface FetchResult {
  rawLanguageBlock: string;
  entries: Entry[];
  notes: string[];
}

export interface TemplateCall {
  name: string;
  raw: string;
  params: {
    positional: string[];
    named: Record<string, string>;
  };
}

export interface DecodeContext {
  lang: WikiLang;
  query: string;
  page: {
    exists: boolean;
    title: string;
    wikitext: string;
    pageprops: Record<string, any>;
    pageid: number | null;
  };
  languageBlock: string;
  etymology: {
    idx: number;
    title: string;
    posBlocks: any[];
  };
  posBlock: {
    posHeading: string;
    wikitext: string;
  };
  posBlockWikitext: string;
  templates: TemplateCall[];
  lines: string[];
}

export interface TemplateDecoder {
  id: string;
  matches(ctx: DecodeContext): boolean;
  decode(ctx: DecodeContext): any;
}
