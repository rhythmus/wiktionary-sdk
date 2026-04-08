import type { Lexeme, WikiLang } from "@engine/model";
import { stripCombiningMarksForPageTitle } from "@engine/index";
import { langToLanguageName, languageNameToLang } from "@engine/parse/parser";

// ---------------------------------------------------------------------------
// Canonical PoS sort order (academically grounded: European lexicographic
// convention + Wiktionary WT:ELE + capitalization-visibility)
// ---------------------------------------------------------------------------

const POS_SORT_RANK: Record<string, number> = Object.fromEntries([
  // 0 — Proper noun (capitalized, visually leads)
  ...["proper_noun", "name"].map((s) => [s, 0]),
  // 1 — Noun (most prototypical PoS)
  ...["noun"].map((s) => [s, 1]),
  // 2 — Verbal category
  ...[
    "verb", "transitive_verb", "intransitive_verb", "auxiliary_verb",
    "auxiliary", "copula",
    "v1", "v1_s", "v5aru", "v5b", "v5g", "v5k", "v5k_s", "v5m", "v5n",
    "v5r", "v5r_i", "v5s", "v5t", "v5u", "v5u_s", "v5uru",
    "v2a_s", "v2b_k", "v2b_s", "v2d_k", "v2d_s", "v2g_k", "v2g_s",
    "v2h_k", "v2h_s", "v2k_k", "v2k_s", "v2m_k", "v2m_s", "v2n_s",
    "v2r_k", "v2r_s", "v2s_s", "v2t_k", "v2t_s", "v2w_s", "v2y_k",
    "v2y_s", "v2z_s",
    "v4b", "v4g", "v4h", "v4k", "v4m", "v4n", "v4r", "v4s", "v4t",
    "vk", "vn", "vr", "vs", "vs_c", "vs_i", "vs_s", "vz",
  ].map((s) => [s, 2]),
  // 3 — Adjectival category
  ...[
    "adjective", "auxiliary_adjective",
    "adj_f", "adj_ix", "adj_kari", "adj_ku", "adj_na", "adj_nari",
    "adj_no", "adj_pn", "adj_shiku", "adj_t",
  ].map((s) => [s, 3]),
  // 4 — Adverbial
  ...["adverb", "adv_to"].map((s) => [s, 4]),
  // 5 — Pronominal
  ...["pronoun"].map((s) => [s, 5]),
  // 6 — Numerals
  ...["numeral", "numeric"].map((s) => [s, 6]),
  // 7 — Functional closed-class
  ...["determiner", "article"].map((s) => [s, 7]),
  // 8 — Adpositional
  ...["preposition", "postposition"].map((s) => [s, 8]),
  // 9 — Connective
  ...["conjunction", "coordinating_conjunction", "subordinating_conjunction"].map((s) => [s, 9]),
  // 10 — Interjection
  ...["interjection"].map((s) => [s, 10]),
  // 11 — Particle
  ...["particle"].map((s) => [s, 11]),
  // 12 — Verbal nominal
  ...["participle"].map((s) => [s, 12]),
  // 13 — Multi-word / phraseological
  ...[
    "phrase", "adjective_phrase", "adverbial_phrase", "prepositional_phrase",
    "expression", "proverb", "contraction",
  ].map((s) => [s, 13]),
  // 14 — Morphological (sub-word)
  ...["prefix", "suffix", "infix", "interfix", "circumfix", "affix", "adfix"].map((s) => [s, 14]),
  // 15 — Conventionalized reduction
  ...["abbreviation"].map((s) => [s, 15]),
  // 16 — Non-linguistic / semiotic
  ...["character", "symbol", "punctuation"].map((s) => [s, 16]),
  // 17 — Remaining Japanese specialty
  ...["n_adv", "n_pref", "n_suf", "n_t", "counter", "v_unspec"].map((s) => [s, 17]),
]);

function posSlugForRank(lex: Lexeme): string {
  return (
    (lex.part_of_speech && String(lex.part_of_speech).trim()) ||
    (lex.lexicographic_section && String(lex.lexicographic_section).trim()) ||
    ""
  ).toLowerCase().replace(/\s+/g, "_");
}

function posRank(lex: Lexeme): number {
  return POS_SORT_RANK[posSlugForRank(lex)] ?? 99;
}

// ---------------------------------------------------------------------------
// Canonical form-of sort order (morphological proximity to lemma)
// ---------------------------------------------------------------------------

const FORM_OF_SORT_RANK: Record<string, number> = Object.fromEntries([
  // 0 — Plural (most basic morphological relation)
  ...["plural of"].map((s) => [s, 0]),
  // 1 — Core inflection
  ...["inflection of", "infl of"].map((s) => [s, 1]),
  // 2 — Specific morphological categories
  ...[
    "verb form of", "noun form of", "adj form of",
    "participle of", "past tense of", "past participle of",
    "present participle of", "gerund of", "imperative of", "command of",
  ].map((s) => [s, 2]),
  // 3 — Lexical variant
  ...["alternative form of", "alt form", "alt form of", "altform", "form of"].map((s) => [s, 3]),
  // 4 — Case variant
  ...["alternative case form of", "altcase", "alt case"].map((s) => [s, 4]),
  // 5 — Spelling variant
  ...["alternative spelling of", "altsp"].map((s) => [s, 5]),
  // 6 — Derivational morphology
  ...["diminutive of", "augmentative of"].map((s) => [s, 6]),
  // 7 — Conventionalized reduction
  ...["abbreviation of", "short for", "clipping of"].map((s) => [s, 7]),
  // 8 — Error-based
  ...["misspelling of"].map((s) => [s, 8]),
  // 9 — Pragmatic reduction
  ...["ellipsis of"].map((s) => [s, 9]),
]);

function formOfRank(lex: Lexeme): number {
  const tpl = (lex.form_of?.template ?? "").trim().toLowerCase();
  if (FORM_OF_SORT_RANK[tpl] !== undefined) return FORM_OF_SORT_RANK[tpl];
  if (/^[a-z]{2,3}-(verb|noun|adj)\s+form\s+of$/i.test(tpl)) return 1;
  return 99;
}

// ---------------------------------------------------------------------------

/** Full language name for pills / labels (codes + section titles like "Latin"). */
export function langName(lang: string) {
  const s = String(lang).trim();
  if (!s) return "?";
  const fromCode = langToLanguageName(s as WikiLang);
  if (fromCode !== null) return fromCode;
  const code = languageNameToLang(s);
  if (code) {
    const full = langToLanguageName(code);
    if (full !== null) return full;
  }
  return s;
}

/** Strict PoS, else lexicographic section slug, else verbatim heading. */
export function posLabelForPill(r: Lexeme): string {
  const raw =
    (r.part_of_speech && String(r.part_of_speech).trim()) ||
    (r.lexicographic_section && String(r.lexicographic_section).trim()) ||
    r.part_of_speech_heading ||
    "?";
  return String(raw)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Group pills by language + PoS; the card stacks every lexeme in the active group. */
function lexemePillGroupKey(r: Lexeme): string {
  const lang = String(r.language ?? "").trim();
  const posRaw =
    (r.part_of_speech && String(r.part_of_speech).trim()) ||
    (r.lexicographic_section && String(r.lexicographic_section).trim()) ||
    r.part_of_speech_heading ||
    "";
  const posNorm = String(posRaw).toLowerCase().replace(/_/g, " ").trim();
  return `${lang}\u0000${posNorm}`;
}

export type LexemePillGroup = {
  key: string;
  /** Indices into the flat `results` array, in API order. */
  indices: number[];
  representative: Lexeme;
};

/** Sort flat indices by etymology section index for stable stacked display. */
function sortIndicesByEtymology(lexemes: Lexeme[], indices: number[]): number[] {
  return [...indices].sort((a, b) => {
    const ea = lexemes[a]?.etymology_index ?? 0;
    const eb = lexemes[b]?.etymology_index ?? 0;
    if (ea !== eb) return ea - eb;
    return a - b;
  });
}

/** One pill per (language, PoS); indices list all lexeme rows in that group (API order). */
export function buildLexemePillGroups(lexemes: Lexeme[]): LexemePillGroup[] {
  const map = new Map<string, number[]>();
  const keyOrder: string[] = [];
  for (let i = 0; i < lexemes.length; i++) {
    const key = lexemePillGroupKey(lexemes[i]);
    if (!map.has(key)) {
      map.set(key, []);
      keyOrder.push(key);
    }
    map.get(key)!.push(i);
  }
  return keyOrder.map((key) => {
    const indices = map.get(key)!;
    const sorted = sortIndicesByEtymology(lexemes, indices);
    return {
      key,
      indices: sorted,
      representative: lexemes[sorted[0]],
    };
  });
}

export function lexemeNeedsLemmaResolution(lex: Lexeme | undefined): boolean {
  return Boolean(
    lex &&
      (lex.type === "INFLECTED_FORM" || lex.type === "FORM_OF") &&
      lex.form_of?.lemma?.trim(),
  );
}

/**
 * Drop a standalone LEXEME from the merged hero card when another row in the same
 * (language + PoS) group is a form-of pointing at that surface form.
 */
function mergedStackOmitAsRedundantLemma(lex: Lexeme, othersInGroup: Lexeme[]): boolean {
  if (lex.type !== "LEXEME") return false;
  const form = (lex.form ?? "").trim();
  if (!form) return false;
  const formNorm = stripCombiningMarksForPageTitle(form);
  for (const o of othersInGroup) {
    if (o === lex) continue;
    if (o.type !== "INFLECTED_FORM" && o.type !== "FORM_OF") continue;
    const lemma = o.form_of?.lemma?.trim();
    if (!lemma) continue;
    const lemmaNorm = stripCombiningMarksForPageTitle(lemma);
    if (lemma === form || lemmaNorm === formNorm) return true;
  }
  return false;
}

export function filterMergedStackIndices(results: Lexeme[], indices: number[]): number[] {
  return indices.filter((i) => {
    const lex = results[i];
    if (!lex) return false;
    const others = indices
      .filter((j) => j !== i)
      .map((j) => results[j])
      .filter((x): x is Lexeme => Boolean(x));
    return !mergedStackOmitAsRedundantLemma(lex, others);
  });
}

// ---------------------------------------------------------------------------
// Language-level grouping (dictionary-style)
// ---------------------------------------------------------------------------

export type LanguagePillGroup = {
  language: string;
  indices: number[];
  representative: Lexeme;
};

/** One pill per language; indices list all lexeme rows for that language. */
export function buildLanguagePillGroups(lexemes: Lexeme[]): LanguagePillGroup[] {
  const map = new Map<string, number[]>();
  const langOrder: string[] = [];
  for (let i = 0; i < lexemes.length; i++) {
    const lang = String(lexemes[i].language ?? "").trim();
    if (!map.has(lang)) {
      map.set(lang, []);
      langOrder.push(lang);
    }
    map.get(lang)!.push(i);
  }
  return langOrder.map((lang) => {
    const indices = map.get(lang)!;
    return { language: lang, indices, representative: lexemes[indices[0]] };
  });
}

export type PosSubGroup = {
  form: string;
  posLabel: string;
  indices: number[];
};

/**
 * Within a language group, sub-group lexemes by (headword form, PoS) and sort
 * by form (alphabetical, capitals first), then PoS source order, then etymology.
 */
export function groupByPosWithinLanguage(
  lexemes: Lexeme[],
  indices: number[],
): PosSubGroup[] {
  const sorted = [...indices].sort((a, b) => {
    const la = lexemes[a], lb = lexemes[b];
    const fa = (la.form ?? "").trim();
    const fb = (lb.form ?? "").trim();
    if (fa !== fb) {
      const faLow = fa.toLowerCase(), fbLow = fb.toLowerCase();
      if (faLow !== fbLow) return faLow < fbLow ? -1 : 1;
      return fa < fb ? -1 : 1;
    }
    const pra = posRank(la), prb = posRank(lb);
    if (pra !== prb) return pra - prb;
    const pa = la.etymology_index ?? 0;
    const pb = lb.etymology_index ?? 0;
    if (pa !== pb) return pa - pb;
    return a - b;
  });

  const groups: PosSubGroup[] = [];
  for (const idx of sorted) {
    const lex = lexemes[idx];
    const form = (lex.form ?? "").trim();
    const pos = posLabelForPill(lex);
    const last = groups[groups.length - 1];
    if (last && last.form === form && last.posLabel === pos) {
      last.indices.push(idx);
    } else {
      groups.push({ form, posLabel: pos, indices: [idx] });
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Headword-grouped hierarchy (dictionary-style merging)
// ---------------------------------------------------------------------------

export type PosGroup = {
  posLabel: string;
  /** LEXEME entries to merge via homonym-group rendering (sorted by etymology_index) */
  lexemeIndices: number[];
  /** FORM_OF / INFLECTED_FORM entries rendered individually */
  formOfIndices: number[];
};

export type HeadwordGroup = {
  form: string;
  posGroups: PosGroup[];
};

function isFormOfType(lex: Lexeme): boolean {
  return (lex.type === "FORM_OF" || lex.type === "INFLECTED_FORM") && Boolean(lex.form_of?.lemma?.trim());
}

/** Alphabetical sort comparator: case-insensitive first, then capitals before lowercase. */
function formSortKey(a: string, b: string): number {
  const aLow = a.toLowerCase(), bLow = b.toLowerCase();
  if (aLow !== bLow) return aLow < bLow ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Build a hierarchical headword > PoS > etymology structure from flat lexeme indices.
 * Within each PoS group, LEXEME entries are separated from FORM_OF/INFLECTED_FORM
 * entries so the renderer can apply homonym-group merging to the former.
 */
export function buildHeadwordGroups(
  lexemes: Lexeme[],
  indices: number[],
): HeadwordGroup[] {
  const sorted = [...indices].sort((a, b) => {
    const la = lexemes[a], lb = lexemes[b];
    const fa = (la.form ?? "").trim();
    const fb = (lb.form ?? "").trim();
    const formCmp = formSortKey(fa, fb);
    if (formCmp !== 0) return formCmp;
    const aIsFormOf = isFormOfType(la) ? 1 : 0;
    const bIsFormOf = isFormOfType(lb) ? 1 : 0;
    if (aIsFormOf !== bIsFormOf) return aIsFormOf - bIsFormOf;
    const pra = posRank(la), prb = posRank(lb);
    if (pra !== prb) return pra - prb;
    const ea = la.etymology_index ?? 0;
    const eb = lb.etymology_index ?? 0;
    if (ea !== eb) return ea - eb;
    if (aIsFormOf && bIsFormOf) {
      const fra = formOfRank(la), frb = formOfRank(lb);
      if (fra !== frb) return fra - frb;
    }
    return a - b;
  });

  const headwordMap = new Map<string, Map<string, { lexemeIndices: number[]; formOfIndices: number[] }>>();
  const headwordOrder: string[] = [];

  for (const idx of sorted) {
    const lex = lexemes[idx];
    const form = (lex.form ?? "").trim();
    const pos = posLabelForPill(lex);

    if (!headwordMap.has(form)) {
      headwordMap.set(form, new Map());
      headwordOrder.push(form);
    }
    const posMap = headwordMap.get(form)!;
    if (!posMap.has(pos)) {
      posMap.set(pos, { lexemeIndices: [], formOfIndices: [] });
    }
    const bucket = posMap.get(pos)!;
    if (isFormOfType(lex)) {
      bucket.formOfIndices.push(idx);
    } else {
      bucket.lexemeIndices.push(idx);
    }
  }

  return headwordOrder.map((form) => {
    const posMap = headwordMap.get(form)!;
    const posGroups: PosGroup[] = [];
    for (const [posLabel, bucket] of posMap) {
      posGroups.push({
        posLabel,
        lexemeIndices: bucket.lexemeIndices,
        formOfIndices: bucket.formOfIndices,
      });
    }
    posGroups.sort((a, b) => {
      const ra = a.lexemeIndices[0] ?? a.formOfIndices[0];
      const rb = b.lexemeIndices[0] ?? b.formOfIndices[0];
      if (ra == null || rb == null) return 0;
      const pra = posRank(lexemes[ra]), prb = posRank(lexemes[rb]);
      if (pra !== prb) return pra - prb;
      const sa = posSlugForRank(lexemes[ra]), sb = posSlugForRank(lexemes[rb]);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
    return { form, posGroups };
  });
}
