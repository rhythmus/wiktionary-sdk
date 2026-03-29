/**
 * The canonical version of the normalized output schema.
 * Follows Semantic Versioning (SemVer) principles.
 */
export const SCHEMA_VERSION = "2.4.0";


/** BCP-47-style language code. Common values: `el`, `grc`, `en`, `nl`, `de`, `fr`. */
export type WikiLang = "el" | "grc" | "en" | "nl" | "de" | "fr" | string;

/** Discriminator for the kind of dictionary entry. Matches schema enum. */
export type EntryType = "LEXEME" | "INFLECTED_FORM" | "FORM_OF";

export interface Pronunciation {
  IPA?: string;
  audio?: string;
  /** Resolved Wikimedia Commons download URL for the audio file. */
  audio_url?: string;
  /** Detailed audio resources with dialect/location labels. */
  audio_details?: Array<{ url: string; label?: string; filename: string }>;
  /** Romanized form of the headword (e.g. "gráfo" for γράφω). */
  romanization?: string;
  /** Rhyming words or sounds. */
  rhymes?: string[];
  /** Words that sound the same but have different meanings/spellings. */
  homophones?: string[];
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
  /** The MediaWiki revision ID at time of fetch. Use for reproducibility/cache-busting. */
  revision_id?: number;
  /** ISO 8601 timestamp of the last page edit (from API `info.touched`). */
  last_modified?: string;
  /** Numeric page ID from the MediaWiki API. */
  pageid?: number | null;
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
  /** Wikidata P31 'Instance Of' claims (e.g. ['Q1084', 'Q215380']). */
  instance_of?: string[];
  /** Wikidata P279 'Subclass Of' claims (e.g. ['Q34770']). */
  subclass_of?: string[];
}

export interface Example {
  text: string;
  translation?: string;
  transliteration?: string;
  author?: string;
  year?: string;
  source?: string;
  raw?: string;
}

export interface Sense {
  id: string;
  gloss: string;
  gloss_raw?: string;
  /** Parenthetical qualifier after the main gloss, e.g. "for traffic violations". */
  qualifier?: string;
  /** Labels from {{lb|...}} templates, e.g. ["colloquial", "figurative"]. */
  labels?: string[];
  /** Topic domains from {{lb|...}}, e.g. ["law", "art"]. */
  topics?: string[];
  examples?: Array<string | Example>;
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
  /** Terms that are peers at the same level (e.g. days of the week together). */
  coordinate_terms?: SemanticRelation[];
  /** Wholes that contain this term as a part (meronymy inverse). */
  holonyms?: SemanticRelation[];
  /** Parts that make up this term. */
  meronyms?: SemanticRelation[];
  /** For verbs: manner-of-action subtypes (e.g. "sprint" is a troponym of "run"). */
  troponyms?: SemanticRelation[];
}


export interface EtymologyLink {
  template: string;
  /** The semantic relation: "inherited", "borrowed", "derived", or "cognate". */
  relation: "inherited" | "borrowed" | "derived" | "cognate" | string;
  source_lang: string;
  source_lang_name?: string;
  term?: string;
  gloss?: string;
  raw: string;
}

export interface EtymologyData {
  /** A structured chain of ancestor/cognate links parsed from etymology templates. */
  chain?: EtymologyLink[];
  /** Separately extracted cognates ({{cog}} templates). */
  cognates?: EtymologyLink[];
  /** The full human-readable prose text of the etymology section. */
  raw_text?: string;
}

/** @deprecated Use EtymologyData.chain instead. */
export type LegacyEtymologyLinks = EtymologyLink[];

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
    /** The specific subclass of form-of (e.g. "misspelling", "abbreviation", "plural"). */
    subclass?: string;
    /** Human-readable label rendered from the tag array, e.g. "1st pers. singular perfective past". */
    label?: string;
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
  /** Grammatical traits extracted from headword templates (gender, transitivity, principal parts, etc.). */
  headword_morphology?: {
    /** For verbs: "transitive" | "intransitive" | "both" | null. */
    transitivity?: "transitive" | "intransitive" | "both" | null;
    /** For verbs: "perfective" | "imperfective" | null. */
    aspect?: "perfective" | "imperfective" | null;
    /** For verbs: "active" | "passive" | "mediopassive" | null. */
    voice?: "active" | "passive" | "mediopassive" | null;
    /** For nouns/adjectives: "masculine" | "feminine" | "neuter" | null. */
    gender?: "masculine" | "feminine" | "neuter" | null;
    /** For verbs: principal inflection paradigm forms keyed by slot name. */
    principal_parts?: Record<string, string>;
  };
  /** Entries from the ====Alternative forms==== section. */
  alternative_forms?: Array<{ 
    term: string; 
    qualifier?: string; 
    raw: string;
    /** The specific type of alternative form (e.g. "polytonic", "archaic"). */
    type?: string;
    /** Labels associated with the variant (e.g. ["rare", "poetic"]). */
    labels?: string[];
  }>;
  /** Terms from the ====See also==== section. */
  see_also?: string[];
  /** Anagrams of this word. */
  anagrams?: string[];
  /** References section content. */
  references?: string[];
  /** Reference to the inflection template used (e.g. "el-conj-γράφω"). */
  inflection_table_ref?: {
    template_name: string;
    raw: string;
  };

  /** All external links extracted from the page. */
  external_links?: string[];
  /** All Wiktionary page titles linked from this article. */
  page_links?: string[];
  /** List of image filenames/URLs found on the page (from MW prop=images). */
  images?: string[];

  wikidata?: WikidataEnrichment;
  resolved_for_query?: string;
  /** When this lemma was resolved for an inflected form, the entry id that triggered it */
  lemma_triggered_by_entry_id?: string;
  preferred?: boolean;
  source: {
    wiktionary: WiktionarySource;
  };
  /** Categories this entry belongs to (filtered by language). */
  categories?: string[];
  /** Links to other Wiktionary editions for this term. */
  langlinks?: Array<{ lang: string; title: string }>;
  /** Page-level metadata from the API. */
  metadata?: {
    last_modified?: string;
    length?: number;
    pageid?: number | null;
    lastrevid?: number;
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
  type?: EntryType;
  form_of?: Entry["form_of"];
  morphology?: any;
  headword_morphology?: Entry["headword_morphology"];
  pronunciation?: Pronunciation;
  hyphenation?: Hyphenation;
  etymology?: EtymologyData;
  senses?: Sense[];
  relations?: SemanticRelations;
  derived_terms?: SectionWithLinks;
  related_terms?: SectionWithLinks;
  descendants?: SectionWithLinks;
  usage_notes?: string[];
  references?: string[];
  inflection_table?: InflectionTable;
  translations?: Entry["translations"];
  wikidata?: WikidataEnrichment;
  images?: string[];
  source: WiktionarySource;
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
  /** Global metadata for the page. */
  metadata?: {
    categories: string[];
    langlinks: Array<{ lang: string; title: string }>;
    info: {
      last_modified?: string;
      length?: number;
      pageid?: number | null;
      lastrevid?: number;
    };
  };
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
    /** Raw prose text of the Etymology section (above the template chain). */
    etymology_raw_text?: string;
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
