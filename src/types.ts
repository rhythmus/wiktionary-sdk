/** Current version of the normalized output schema. See VERSIONING.md. */
export const SCHEMA_VERSION = "1.0.0";

/** BCP-47-style language code. Common values: `el`, `grc`, `en`, `nl`, `de`, `fr`. */
export type WikiLang = "el" | "grc" | "en" | "nl" | "de" | "fr" | string;

/** Discriminator for the kind of dictionary entry. Matches schema enum. */
export type EntryType = "LEXEME" | "INFLECTED_FORM" | "FORM_OF";

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
  gloss_raw?: string;
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

/** Single item from {{l}}/{{link}} in Derived/Related/Descendants sections. */
export interface SectionLinkItem {
  term: string;
  lang: string;
  gloss?: string;
  alt?: string;
  template: string;
  raw: string;
}

/** Section with structured items and verbatim raw text. */
export interface SectionWithLinks {
  raw_text: string;
  items: SectionLinkItem[];
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
    term: string;
    gloss?: string;
    transliteration?: string;
    gender?: string;
    alt?: string;
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
  /** From {{l}}/{{link}} in ====Derived terms==== section. */
  derived_terms?: SectionWithLinks;
  /** From {{l}}/{{link}} in ====Related terms==== section. */
  related_terms?: SectionWithLinks;
  /** From {{l}}/{{link}} in ====Descendants==== section. */
  descendants?: SectionWithLinks;
  usage_notes?: string[];
  wikidata?: WikidataEnrichment;
  resolved_for_query?: string;
  /** When this lemma was resolved for an inflected form, the entry id that triggered it */
  lemma_triggered_by_entry_id?: string;
  preferred?: boolean;
  source: {
    wiktionary: WiktionarySource;
  };
  templates_all?: Array<{
    name: string;
    raw: string;
    params: { positional: string[]; named: Record<string, string> };
    start?: number;
    end?: number;
    line?: number;
  }>;
}

export interface DecoderDebugEvent {
  decoderId: string;
  matchedTemplates: Array<{ raw: string; name: string }>;
  fieldsProduced: string[];
}

/** Top-level result returned by {@link wiktionary}. */
export interface FetchResult {
  schema_version: string;
  rawLanguageBlock: string;
  entries: Entry[];
  notes: string[];
  /** Present when debugDecoders option is true. debug[i] corresponds to entries[i]. */
  debug?: DecoderDebugEvent[][];
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
  handlesTemplates?: string[];
  matches(ctx: DecodeContext): boolean;
  decode(ctx: DecodeContext): any;
}
