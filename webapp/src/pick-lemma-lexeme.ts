import { stripCombiningMarksForPageTitle } from '@engine/index';
import { lexemeMatchesPosQuery } from '@engine/lexicographic-headings';
import type { FetchResult, Lexeme } from '@engine/types';

/**
 * Pick the lemma LEXEME from a second wiktionary() response. Uses only API fields:
 * page title match (`form` === lemma query from {{… of}}) and optional PoS tie-break
 * from the inflected lexeme’s decoded part_of_speech (not guessed elsewhere).
 */
export function pickLemmaLexemeFromSecondFetch(
  res: FetchResult,
  lemmaQuery: string,
  preferredPos: string | undefined,
): Lexeme | null {
  const q = lemmaQuery.trim();
  const qNorm = stripCombiningMarksForPageTitle(q);
  const candidates = res.lexemes.filter((l) => {
    if (l.type !== 'LEXEME') return false;
    const f = (l.form ?? '').trim();
    if (f === q) return true;
    return stripCombiningMarksForPageTitle(f) === qNorm;
  });
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  if (preferredPos && preferredPos !== 'Auto') {
    const byPos = candidates.find((l) => lexemeMatchesPosQuery(l, preferredPos));
    if (byPos) return byPos;
  }
  return candidates[0];
}
