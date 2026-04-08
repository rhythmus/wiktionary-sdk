export interface Example {
  text: string;
  translation?: string;
  transliteration?: string;
  author?: string;
  year?: string;
  source?: string;
  raw?: string;
}

/** Decoded from {{only used in|lang|term(s)}} definition lines (en.wiktionary form-of family). */
export interface OnlyUsedIn {
  /** Language code of the linked expression(s), e.g. "nl". */
  lang: string;
  /** Phrase(s) this lemma is restricted to; from |2=, comma-separated without spaces after commas. */
  terms: string[];
  /** Optional gloss from |t= / |4= / |gloss=. */
  t_gloss?: string;
  /** Verbatim template invocation for traceability. */
  raw: string;
}

export interface Sense {
  id: string;
  gloss: string;
  gloss_raw?: string;
  /** When present, prefer structured HTML over plain gloss (see OnlyUsedIn). */
  only_used_in?: OnlyUsedIn;
  /** Parenthetical qualifier after the main gloss, e.g. "for traffic violations". */
  qualifier?: string;
  /** Labels from {{lb|...}} templates, e.g. ["colloquial", "figurative"]. */
  labels?: string[];
  /** Topic domains from {{lb|...}}, e.g. ["law", "art"]. */
  topics?: string[];
  examples?: Array<string | Example>;
  subsenses?: Sense[];
  /** Wikidata QID resolved for this specific sense (from disambiguation matching). */
  wikidata_qid?: string;
}
