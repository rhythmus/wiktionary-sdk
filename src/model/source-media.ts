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
  /** Present when enrichment failed after a QID was known (best-effort diagnostics). */
  wikidata_error?: string;
}
