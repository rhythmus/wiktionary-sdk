import type { Lexeme, WikiLang } from "@engine/model";
import { stripCombiningMarksForPageTitle } from "@engine/index";
import { langToLanguageName, languageNameToLang } from "@engine/parse/parser";

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
