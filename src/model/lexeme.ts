import type { WikiLang, LexemeType } from "./primitives";
import type { LexicographicFamily } from "./lexicographic";
import type { PartOfSpeech } from "./part-of-speech";
import type { Pronunciation, Hyphenation, WikidataEnrichment, WiktionarySource } from "./source-media";
import type { Sense } from "./sense";
import type { SemanticRelations } from "./relations";
import type { EtymologyData } from "./etymology";
import type { SectionWithLinks } from "./sections";

/**
 * A single normalized lexeme produced by the extraction pipeline.
 * Each lexeme represents a unique (language + PoS + etymology) slice,
 * fully traceable to its source wikitext section.
 */
export interface Lexeme {
  id: string;
  language: WikiLang;
  query: string;
  type: LexemeType;
  form: string;
  etymology_index: number;
  part_of_speech_heading: string;
  /** Stable slug for the section kind (PoS, morpheme, symbol, …). */
  lexicographic_section: string;
  /** Taxonomic bucket for `lexicographic_section`. */
  lexicographic_family: LexicographicFamily;
  /** Set only for strict grammatical PoS (from heading or headword templates). */
  part_of_speech?: PartOfSpeech | null;
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
    /**
     * Inflection gloss lines from MediaWiki parse of the definition line (Lua output for
     * per-lang form-of templates such as {{es-verb form of|…}}, {{de-noun form of|…}}), when
     * not present as ## wikitext subsenses.
     */
    display_morph_lines?: string[];
    display_morph_lines_source?: "mediawiki_parse";
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
  /** When this lemma lexeme was fetched after an inflected form, the `Lexeme.id` of that `INFLECTED_FORM` row. */
  lemma_triggered_by_lexeme_id?: string;
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
