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
  /**
   * @deprecated Legacy alias for `chain`. Prefer `chain`; kept for compatibility with
   * older payloads and defensive reads in `extractEtymologySteps` (`convenience/page-enrichment.ts`).
   */
  links?: EtymologyLink[];
  /** Separately extracted cognates ({{cog}} templates). */
  cognates?: EtymologyLink[];
  /** The full human-readable prose text of the etymology section. */
  raw_text?: string;
}

/** One step in the `etymology()` convenience API lineage: resolved language code + attested form. */
export interface EtymologyStep {
  lang: string;
  form: string;
}

/** @deprecated Use EtymologyData.chain instead. */
export type LegacyEtymologyLinks = EtymologyLink[];
