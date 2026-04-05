import type { Lexeme } from "./lexeme";

export interface DecoderDebugEvent {
  decoderId: string;
  matchedTemplates: Array<{ raw: string; name: string }>;
  fieldsProduced: string[];
}

/**
 * Tagged per-lexeme result returned by convenience wrappers.
 * Each element in the array corresponds to one lexeme found for the query,
 * carrying both the extracted value and enough identity metadata for the
 * caller to know which lexeme produced it.
 */
export interface LexemeResult<T> {
  lexeme_id: string;
  language: string;
  pos: string;
  etymology_index?: number;
  value: T;
  /** When `value` is empty or partial because SDK decoders do not cover the relevant wikitext yet (or parse failed). */
  support_warning?: string;
}

/** Top-level result returned by {@link wiktionary}. */
export interface FetchResult {
  schema_version: string;
  rawLanguageBlock: string;
  lexemes: Lexeme[];
  notes: string[];
  /** Present when debugDecoders option is true. debug[i] corresponds to lexemes[i]. */
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
