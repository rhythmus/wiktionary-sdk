/**
 * High-level bucket for a lexeme-class section (see `src/lexicographic-headings.ts`).
 * Mirrored in `schema/normalized-entry.schema.json` `$defs.LexicographicFamily`.
 */
export type LexicographicFamily =
  | "pos"
  | "morpheme"
  | "symbol"
  | "character"
  | "phraseology"
  | "numeral_kind"
  | "other"
  | "disallowed_attested";
