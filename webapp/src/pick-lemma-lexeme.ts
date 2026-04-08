import { stripCombiningMarksForPageTitle } from '@engine/index';
import { lexemeMatchesPosQuery } from '@engine/parse/lexicographic-headings';
import type { FetchResult, Lexeme } from '@engine/model';

export type PickLemmaResult =
  | { kind: 'found'; lexeme: Lexeme }
  | { kind: 'chain'; formOfLexeme: Lexeme; chainTarget: string }
  | { kind: 'not-found'; reason: string };

function formMatchesQuery(form: string, q: string, qNorm: string): boolean {
  const f = form.trim();
  if (f === q) return true;
  return stripCombiningMarksForPageTitle(f) === qNorm;
}

/**
 * Pick the lemma LEXEME from a second wiktionary() response.
 *
 * When no LEXEME-type match exists but a FORM_OF/INFLECTED_FORM is found, returns
 * a `chain` result so the caller can surface a descriptive message about the
 * form-of chain rather than a misleading "No page found" error.
 */
export function pickLemmaLexemeFromSecondFetch(
  res: FetchResult,
  lemmaQuery: string,
  preferredPos: string | undefined,
): PickLemmaResult {
  const q = lemmaQuery.trim();
  const qNorm = stripCombiningMarksForPageTitle(q);

  const lexemeCandidates = res.lexemes.filter(
    (l) => l.type === 'LEXEME' && formMatchesQuery(l.form ?? '', q, qNorm),
  );

  if (lexemeCandidates.length === 1) return { kind: 'found', lexeme: lexemeCandidates[0] };
  if (lexemeCandidates.length > 1) {
    if (preferredPos && preferredPos !== 'Auto') {
      const byPos = lexemeCandidates.find((l) => lexemeMatchesPosQuery(l, preferredPos));
      if (byPos) return { kind: 'found', lexeme: byPos };
    }
    return { kind: 'found', lexeme: lexemeCandidates[0] };
  }

  const formOfCandidates = res.lexemes.filter(
    (l) => (l.type === 'FORM_OF' || l.type === 'INFLECTED_FORM') && l.form_of?.lemma,
  );
  if (formOfCandidates.length > 0) {
    const best = formOfCandidates[0];
    return {
      kind: 'chain',
      formOfLexeme: best,
      chainTarget: best.form_of!.lemma!,
    };
  }

  if (res.lexemes.length === 0) {
    return { kind: 'not-found', reason: 'No lexemes found on the lemma page.' };
  }
  return { kind: 'not-found', reason: 'No matching lemma lexeme in the API response for this page.' };
}
