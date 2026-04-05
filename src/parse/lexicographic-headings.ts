/**
 * Maps en.wiktionary `===` / `====` lexeme-class section headings to a stable
 * `{ family, section_slug, strict_pos }` triple. Inspired by the taxonomy in
 * https://github.com/LearnRomanian/wiktionary-scraper (README “Recognised parts of speech”).
 *
 * `strict_pos` is set only for grammatical parts of speech (narrow `PartOfSpeech` in `model/part-of-speech.ts`).
 * Morphological units, symbols, phraseology, CJK, policy-violating headings, etc. get
 * `strict_pos: null` and are classified via `lexicographic_family` + `lexicographic_section`.
 */

import type { Lexeme, LexicographicFamily, PartOfSpeech } from "../model";

export interface LexicographicHeadingResult {
  family: LexicographicFamily;
  section_slug: string;
  strict_pos: PartOfSpeech | null;
}

const lookup = new Map<string, LexicographicHeadingResult>();

function normHeading(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function add(
  headings: readonly string[],
  family: LexicographicFamily,
  section_slug: string,
  strict_pos: PartOfSpeech | null,
): void {
  const row: LexicographicHeadingResult = { family, section_slug, strict_pos };
  for (const raw of headings) {
    const k = normHeading(raw);
    if (!k) continue;
    lookup.set(k, row);
  }
}

// ── Strict PoS (family pos, strict_pos set) ─────────────────────────────────
add(["verb", "verbs"], "pos", "verb", "verb");
add(["noun", "nouns"], "pos", "noun", "noun");
add(["adjective", "adjectives"], "pos", "adjective", "adjective");
add(["adverb", "adverbs"], "pos", "adverb", "adverb");
add(["pronoun", "pronouns"], "pos", "pronoun", "pronoun");
add(["numeral", "numerals"], "pos", "numeral", "numeral");
add(["article", "articles"], "pos", "article", "article");
add(["determiner", "determiners"], "pos", "determiner", "determiner");
add(["conjunction", "conjunctions"], "pos", "conjunction", "conjunction");
add(["interjection", "interjections"], "pos", "interjection", "interjection");
add(["preposition", "prepositions"], "pos", "preposition", "preposition");
add(["particle", "particles"], "pos", "particle", "particle");
add(["participle", "participles"], "pos", "participle", "participle");
add(["proper noun", "proper nouns"], "pos", "proper_noun", "proper_noun");
add(["contraction", "contractions"], "pos", "contraction", "contraction");

// Grammar-adjacent PoS headings (attested on en.wiktionary; not in narrow PartOfSpeech)
add(["ambiposition"], "pos", "ambiposition", null);
add(["circumposition", "circumpositions"], "pos", "circumposition", null);
add(["classifier", "classifiers"], "pos", "classifier", null);
add(["counter", "counters"], "pos", "counter", null);
add(["ideophone", "ideophones"], "pos", "ideophone", null);
add(["postposition", "postpositions"], "pos", "postposition", null);

// ── Morphemes ───────────────────────────────────────────────────────────────
add(["circumfix", "circumfixes"], "morpheme", "circumfix", null);
add(["combining form", "combining forms"], "morpheme", "combining_form", null);
add(["infix", "infixes"], "morpheme", "infix", null);
add(["interfix", "interfixes"], "morpheme", "interfix", null);
add(["prefix", "prefixes"], "morpheme", "prefix", null);
add(["root", "roots"], "morpheme", "root", null);
add(["suffix", "suffixes"], "morpheme", "suffix", null);

// ── Symbols & letter-like ───────────────────────────────────────────────────
add(["diacritical mark", "diacritical marks"], "symbol", "diacritical_mark", null);
add(["letter", "letters"], "symbol", "letter", null);
add(["ligature", "ligatures"], "symbol", "ligature", null);
add(["number", "numbers"], "symbol", "number", null);
add(["punctuation mark", "punctuation marks"], "symbol", "punctuation_mark", null);
add(["syllable", "syllables"], "symbol", "syllable", null);
add(["symbol", "symbols"], "symbol", "symbol", null);

// ── Phraseology ─────────────────────────────────────────────────────────────
add(["phrase", "phrases"], "phraseology", "phrase", null);
add(["proverb", "proverbs"], "phraseology", "proverb", null);
add(["idiom", "idioms"], "phraseology", "idiom", null);
add(["prepositional phrase", "prepositional phrases"], "phraseology", "prepositional_phrase", null);
add(["phrasebook"], "phraseology", "phrasebook", null);

// ── Han / CJK character sections ────────────────────────────────────────────
add(["han character", "han characters"], "character", "han_character", null);
add(["hanzi"], "character", "hanzi", null);
add(["kanji"], "character", "kanji", null);
add(["hanja"], "character", "hanja", null);

// ── Numeral-like headings (often non-standard) ──────────────────────────────
add(["cardinal-number", "cardinal number", "cardinal numbers"], "numeral_kind", "cardinal_number", null);
add(["ordinal-number", "ordinal number", "ordinal numbers"], "numeral_kind", "ordinal_number", null);
add(["cardinal-numeral", "cardinal numeral"], "numeral_kind", "cardinal_numeral", null);
add(["ordinal-numeral", "ordinal numeral"], "numeral_kind", "ordinal_numeral", null);

// ── Other / meta-lexicographic ──────────────────────────────────────────────
add(["romanization", "romanisation"], "other", "romanization", null);
add(["logogram", "logograms"], "other", "logogram", null);
add(["determinative", "determinatives"], "other", "determinative", null);
add(["adposition", "adpositions"], "other", "adposition", null);
add(["affix", "affixes"], "other", "affix", null);
add(["character", "characters"], "other", "character", null);

// ── Policy-disallowed but still attested section titles ─────────────────────
add(["abbreviation", "abbreviations"], "disallowed_attested", "abbreviation", null);
add(["acronym", "acronyms"], "disallowed_attested", "acronym", null);
add(["initialism", "initialisms"], "disallowed_attested", "initialism", null);
add(["gerund", "gerunds"], "disallowed_attested", "gerund", null);
add(["clitic", "clitics"], "disallowed_attested", "clitic", null);

/** True when this heading opens a lexeme-class block (per `splitEtymologiesAndPOS`). */
export function isLexemeSectionHeading(heading: string): boolean {
  return lookup.has(normHeading(heading));
}

/** Map a section heading to taxonomy; `null` when not a registered lexeme-class heading. */
export function mapHeadingToLexicographic(heading: string): LexicographicHeadingResult | null {
  return lookup.get(normHeading(heading)) ?? null;
}

/**
 * When a pos block has a heading outside the registered set (should be rare), derive a slug
 * and bucket as `other` so `Lexeme` still has required taxonomy fields.
 */
export function fallbackLexicographicFromHeading(heading: string): Pick<
  LexicographicHeadingResult,
  "family" | "section_slug"
> {
  const m = mapHeadingToLexicographic(heading);
  if (m) return { family: m.family, section_slug: m.section_slug };
  const section_slug =
    heading
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "unknown";
  return { family: "other", section_slug };
}

/** Strict grammatical PoS only (subset of {@link mapHeadingToLexicographic}). */
export function mapHeadingToStrictPartOfSpeech(heading: string): PartOfSpeech | null {
  return mapHeadingToLexicographic(heading)?.strict_pos ?? null;
}

/** Count headings and rows per family (for `npm run report:lexicographic-taxonomy`). */
export function getLexicographicTaxonomyStats(): {
  heading_count: number;
  distinct_section_slugs: number;
  by_family: Record<LexicographicFamily, number>;
} {
  const by_family: Record<LexicographicFamily, number> = {
    pos: 0,
    morpheme: 0,
    symbol: 0,
    character: 0,
    phraseology: 0,
    numeral_kind: 0,
    other: 0,
    disallowed_attested: 0,
  };

  const sections = new Set<string>();
  for (const v of lookup.values()) {
    sections.add(v.section_slug);
  }
  for (const [, v] of lookup) {
    by_family[v.family]++;
  }

  return {
    heading_count: lookup.size,
    distinct_section_slugs: sections.size,
    by_family,
  };
}

/**
 * Whether a lexeme matches a user `pos` filter (`wiktionary({ pos })`) or `preferredPos`.
 * Accepts strict PoS slug, lexicographic section slug, or verbatim heading (case-insensitive).
 */
export function lexemeMatchesPosQuery(
  lex: Pick<Lexeme, "part_of_speech" | "lexicographic_section" | "part_of_speech_heading">,
  queryPos: string,
): boolean {
  const qRaw = queryPos.trim();
  if (!qRaw) return false;
  const q = qRaw.toLowerCase();
  const qSlug = q.replace(/\s+/g, "_");
  const headingLc = (lex.part_of_speech_heading || "").trim().toLowerCase();

  if (headingLc === q || headingLc === q.replace(/_/g, " ")) return true;
  if (lex.lexicographic_section === qSlug) return true;
  if (lex.part_of_speech && lex.part_of_speech === qSlug) return true;
  if (lex.part_of_speech && lex.part_of_speech.replace(/_/g, " ") === q) return true;
  return false;
}

/** Sort / display key: strict PoS if set, else lexicographic section slug. */
export function lexemePosSortKey(lex: Pick<Lexeme, "part_of_speech" | "lexicographic_section">): string {
  return lex.part_of_speech ?? lex.lexicographic_section ?? "";
}
