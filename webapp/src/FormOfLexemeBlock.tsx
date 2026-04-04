import { useState, useEffect, useMemo, type FC } from 'react';
import { Loader2 } from 'lucide-react';
import { wiktionary } from '@engine/index';
import type { Lexeme } from '@engine/types';
import { normalizeWikiLangArg } from '@engine/parser';
import { format, formatInflectedFormHeadline } from '@engine/formatter';
import { parseMorphologyTags } from '@engine/morphology';
import { pickLemmaLexemeFromSecondFetch } from './pick-lemma-lexeme';

/** One inflected/form-of row: own lemma fetch + nested lemma HTML (for merged group cards). */
export const FormOfLexemeBlock: FC<{
  lexeme: Lexeme;
  debugMode: boolean;
  matchMode: 'strict' | 'fuzzy';
}> = ({ lexeme, debugMode, matchMode }) => {
  const [lemmaResolveEntry, setLemmaResolveEntry] = useState<Lexeme | null>(null);
  const [lemmaResolveLoading, setLemmaResolveLoading] = useState(false);
  const [lemmaResolveError, setLemmaResolveError] = useState<string | null>(null);

  useEffect(() => {
    const lemmaQuery = lexeme.form_of!.lemma!.trim();
    const lang = normalizeWikiLangArg(lexeme.language);
    const preferredPos =
      lexeme.part_of_speech && lexeme.part_of_speech !== 'Auto'
        ? lexeme.part_of_speech
        : undefined;

    let cancelled = false;
    setLemmaResolveLoading(true);
    setLemmaResolveError(null);
    setLemmaResolveEntry(null);

    wiktionary({
      query: lemmaQuery,
      lang,
      pos: 'Auto',
      enrich: true,
      debugDecoders: debugMode,
      matchMode,
    })
      .then((res) => {
        if (cancelled) return;
        const picked = pickLemmaLexemeFromSecondFetch(res, lemmaQuery, preferredPos);
        if (!picked) {
          const noise = /retried without combining marks/i;
          const meaningful = res.notes.find((n) => !noise.test(n));
          setLemmaResolveError(
            meaningful ??
              (res.lexemes.length === 0
                ? 'No lexemes for this lemma page (language section or PoS filter).'
                : 'No lemma lexeme in the API response for this page.'),
          );
          setLemmaResolveEntry(null);
        } else {
          setLemmaResolveEntry(picked);
          setLemmaResolveError(null);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLemmaResolveError(e instanceof Error ? e.message : String(e));
        setLemmaResolveEntry(null);
      })
      .finally(() => {
        if (!cancelled) setLemmaResolveLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    lexeme.id,
    lexeme.form_of?.lemma,
    lexeme.language,
    lexeme.part_of_speech,
    lexeme.type,
    debugMode,
    matchMode,
  ]);

  const inflectedFormHeadlineHtml = useMemo(() => formatInflectedFormHeadline(lexeme), [lexeme]);

  const nestedLemmaEntryHtml = useMemo(() => {
    if (!lemmaResolveEntry) return '';
    const fromForm = parseMorphologyTags((lexeme.form_of?.tags ?? []).map(String));
    const lemmaGender = lemmaResolveEntry.headword_morphology?.gender;
    const mergedGender = lemmaGender ?? fromForm.gender;
    const entryForDisplay =
      mergedGender && !lemmaGender
        ? {
            ...lemmaResolveEntry,
            headword_morphology: {
              ...lemmaResolveEntry.headword_morphology,
              gender: mergedGender,
            },
          }
        : lemmaResolveEntry;
    return format(entryForDisplay, { mode: 'html-fragment' });
  }, [lemmaResolveEntry, lexeme]);

  return (
    <div className="dict-merged-lexeme-block dict-entry-form-of-wrap">
      <div dangerouslySetInnerHTML={{ __html: inflectedFormHeadlineHtml }} />
      <div className="dict-entry-nested-row">
        <span className="dict-entry-nested-arrow" aria-hidden="true">→</span>
        <div className="dict-entry-nested-body">
          {lemmaResolveLoading && (
            <div className="dict-entry-lemma-nested dict-entry-lemma-loading">
              <Loader2 size={20} className="animate-spin" aria-hidden />
              <span> Loading lemma…</span>
            </div>
          )}
          {!lemmaResolveLoading && lemmaResolveError && (
            <div className="dict-entry-lemma-nested dict-entry-lemma-error" role="alert">
              {lemmaResolveError}
            </div>
          )}
          {!lemmaResolveLoading && lemmaResolveEntry && (
            <div className="dict-entry-lemma-nested" dangerouslySetInnerHTML={{ __html: nestedLemmaEntryHtml }} />
          )}
        </div>
      </div>
    </div>
  );
};
