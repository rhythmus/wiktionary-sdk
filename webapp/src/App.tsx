import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { Search, ChevronRight, Image as ImageIcon, Loader2, AlertCircle, Languages, Bug, Columns2, X, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import yaml from 'js-yaml';
import {
  wiktionary, lemma, ipa, pronounce, hyphenate, synonyms, antonyms,
  etymology, stem, morphology, conjugate, decline, hypernyms, hyponyms,
  derivedTerms, relatedTerms, wikidataQid, wikipediaLink, image,
  partOfSpeech, usageNotes, translate, richEntry,
  rhymes, homophones, syllableCount, allImages, audioGallery, audioDetails, exampleDetails,
  externalLinks, internalLinks, isInstance, isSubclass, alternativeForms, seeAlso, anagrams,
  citations, descendants, referencesSection, etymologyChain, etymologyCognates, etymologyText,
  categories, langlinks, inflectionTableRef, gender, transitivity
} from '@engine/index';
import { ENTRY_CSS } from '@engine/templates/templates';
function langName(lang: string) {
  const m: Record<string, string> = { el: 'Greek', grc: 'Ancient Greek', en: 'English', nl: 'Dutch', de: 'German', fr: 'French' };
  return m[lang] || lang;
}
import type { Lexeme, WikiLang, DecoderDebugEvent } from '@engine/types';
import { format } from '@engine/formatter';

// ── SDK method registry ──────────────────────────────────────────────────────
const API_METHODS: Record<string, any> = {
  // Core / Senses
  richEntry, translate, partOfSpeech, usageNotes,
  // Phonology & Morphology
  lemma, ipa, pronounce, hyphenate, rhymes, homophones, syllableCount,
  stem, morphology, conjugate, decline, gender, transitivity,
  // Relations & Connectivity
  synonyms, antonyms, hypernyms, hyponyms,
  derivedTerms, relatedTerms, descendants,
  alternativeForms, seeAlso, anagrams,
  internalLinks, externalLinks,
  // Media & Metadata
  image, allImages, audioGallery, audioDetails, exampleDetails, citations,
  // Wikidata & Global
  wikidataQid, wikipediaLink, isInstance, isSubclass,
  categories, langlinks, inflectionTableRef,
  referencesSection, etymologyChain, etymologyCognates, etymologyText,
  etymology
};

/**
 * Semantic grouping for the Target Wrapper dropdown.
 * Mirrors the organization in README.md and the v2 Schema.
 */
const API_GROUPS = [
  { label: 'Identity & Senses', methods: ['richEntry', 'lemma', 'partOfSpeech', 'usageNotes'] },
  { label: 'Pronunciation', methods: ['ipa', 'pronounce', 'rhymes', 'homophones', 'audioGallery'] },
  { label: 'Morphology', methods: ['stem', 'morphology', 'conjugate', 'decline', 'gender', 'transitivity', 'inflectionTableRef'] },
  { label: 'Hyphenation', methods: ['hyphenate', 'syllableCount'] },
  { label: 'Etymology', methods: ['etymology', 'etymologyChain', 'etymologyCognates', 'etymologyText'] },
  { label: 'Relations', methods: ['synonyms', 'antonyms', 'hypernyms', 'hyponyms', 'derivedTerms', 'relatedTerms', 'descendants', 'alternativeForms', 'seeAlso', 'anagrams'] },
  { label: 'Media & Connections', methods: ['image', 'allImages', 'internalLinks', 'externalLinks', 'exampleDetails', 'citations'] },
  { label: 'Wikidata & Global', methods: ['wikidataQid', 'isInstance', 'isSubclass', 'wikipediaLink', 'translate', 'categories', 'langlinks', 'referencesSection'] },
];

// ── Dynamic prop pills per method ────────────────────────────────────────────
const SUGGESTED_PROPS: Record<string, string[]> = {
  conjugate: ['{"tense":"present"}', '{"tense":"past"}', '{"voice":"passive"}', '{"mood":"subjunctive"}'],
  decline: ['{"case":"nominative"}', '{"case":"genitive"}', '{"number":"plural"}'],
  translate: ['{"target":"en"}', '{"target":"nl"}', '{"target":"fr"}'],
  hyphenate: ['{}', '{"dot":true}'],
  morphology: ['{}'],
  richEntry: ['{}'],
  wikipediaLink: ['{"target":"en"}', '{"target":"el"}'],
  isInstance: ['{"qid":"Q5"}', '{"qid":"Q1084"}'],
};
const DEFAULT_PILLS = ['{}'];

// ── Static data ──────────────────────────────────────────────────────────────
const LANGUAGES = [
  { value: 'Auto', label: 'Auto', flag: '🌍', narrow: '🌍' },
  { value: 'el', label: 'Greek', flag: '🇬🇷', narrow: '🇬🇷' },
  { value: 'grc', label: 'Anc. Greek', flag: '🏛️', narrow: '🏛️' },
  { value: 'en', label: 'English', flag: '🇬🇧', narrow: '🇬🇧' },
  { value: 'nl', label: 'Dutch', flag: '🇳🇱', narrow: '🇳🇱' },
  { value: 'de', label: 'German', flag: '🇩🇪', narrow: '🇩🇪' },
  { value: 'fr', label: 'French', flag: '🇫🇷', narrow: '🇫🇷' },
] as const;

const POS_OPTIONS = [
  { value: 'Auto', label: 'Auto', narrow: '·' },
  { value: 'verb', label: 'Verb', narrow: 'V' },
  { value: 'noun', label: 'Noun', narrow: 'N' },
  { value: 'adjective', label: 'Adjective', narrow: 'Adj' },
  { value: 'pronoun', label: 'Pronoun', narrow: 'Pr' },
  { value: 'numeral', label: 'Numeral', narrow: '#' },
  { value: 'adverb', label: 'Adverb', narrow: 'Adv' },
] as const;

// Removed duplicate langName helper

// ── Types ────────────────────────────────────────────────────────────────────
interface DecoderMatch {
  decoderId: string;
  templateName: string;
  raw: string;
  fieldsProduced: string[];
}

function extractDecoderMatches(entry: Lexeme): DecoderMatch[] {
  const matches: DecoderMatch[] = [];
  for (const [tplName, tplInstances] of Object.entries(entry.templates || {})) {
    const fp: string[] = [];
    if (['IPA', 'el-IPA'].includes(tplName)) fp.push('pronunciation.IPA');
    if (tplName === 'audio') fp.push('pronunciation.audio');
    if (tplName === 'hyphenation') fp.push('hyphenation');
    if (tplName.startsWith('el-')) fp.push('part_of_speech');
    if (['inflection of', 'infl of', 'form of', 'alternative form of'].includes(tplName)) fp.push('type', 'form_of');
    if (['syn', 'ant', 'hyper', 'hypo'].includes(tplName)) fp.push('semantic_relations');
    if (['inh', 'der', 'bor', 'cog'].includes(tplName)) fp.push('etymology');
    if (['t', 't+', 'tt', 'tt+', 't-simple'].includes(tplName)) fp.push('translations');
    for (const inst of (tplInstances as { raw: string }[])) {
      matches.push({ decoderId: tplName, templateName: tplName, raw: inst.raw, fieldsProduced: fp.length ? fp : ['templates'] });
    }
  }
  return matches;
}

/** README-style TypeScript sample for the selected Target Wrapper + playground fields. */
function playgroundTypescriptSnippet(
  method: string,
  query: string,
  lang: WikiLang,
  prefPos: string,
  apiPropsRaw: string,
): string {
  let props: Record<string, unknown> | undefined;
  let propsInvalid = false;
  if (apiPropsRaw.trim()) {
    try {
      props = JSON.parse(apiPropsRaw) as Record<string, unknown>;
    } catch {
      propsInvalid = true;
      props = undefined;
    }
  }

  const q = JSON.stringify(query || '');
  const langLit = JSON.stringify(lang);
  const posLit = JSON.stringify(prefPos);

  const fmtObj = (o: Record<string, unknown>) => {
    const s = JSON.stringify(o, null, 2);
    return s.length > 72 ? s : JSON.stringify(o);
  };

  const importLine = `import { ${method} } from "wiktionary-sdk";`;

  if (propsInvalid) {
    return `${importLine}\n\n// Invalid JSON in Props / Criteria — fix to preview the call\nawait ${method}(${q}, ${langLit}, ${posLit});`;
  }

  let call: string;
  if (method === 'conjugate' || method === 'decline') {
    if (props && Object.keys(props).length > 0) {
      call = `await ${method}(${q}, ${langLit}, ${fmtObj(props)});`;
    } else {
      call = `await ${method}(${q}, ${langLit});`;
    }
  } else if (method === 'translate') {
    const target = props && props.target != null ? String(props.target) : 'en';
    const targetLit = JSON.stringify(target);
    const opts = props ? { ...props } : {};
    delete opts.target;
    const optKeys = Object.keys(opts);
    const fourth =
      optKeys.length > 0 ? fmtObj(opts as Record<string, unknown>) : '{ mode: "gloss" }';
    call = `await translate(${q}, ${langLit}, ${targetLit}, ${fourth}, ${posLit});`;
  } else if (method === 'wikipediaLink') {
    const tw = props && props.target != null ? String(props.target) : 'en';
    call = `await wikipediaLink(${q}, ${langLit}, ${JSON.stringify(tw)}, ${posLit});`;
  } else if (method === 'isInstance' || method === 'isSubclass') {
    const qid = props && props.qid != null ? String(props.qid) : 'Q5';
    call = `await ${method}(${q}, ${JSON.stringify(qid)}, ${langLit});`;
  } else if (method === 'hyphenate') {
    if (props && Object.keys(props).length > 0) {
      call = `await hyphenate(${q}, ${langLit}, ${fmtObj(props)}, ${posLit});`;
    } else {
      call = `await hyphenate(${q}, ${langLit}, {}, ${posLit});`;
    }
  } else {
    call = `await ${method}(${q}, ${langLit}, ${posLit});`;
  }

  return `${importLine}\n\n${call}`;
}

const TS_KEYWORDS = new Set([
  'import', 'from', 'await', 'const', 'let', 'var', 'new', 'typeof', 'async',
  'true', 'false', 'null', 'undefined', 'return', 'function', 'class', 'extends',
]);

const MAX_PLAYGROUND_COMMENT_LEN = 720;

function serializeValueForPlaygroundComment(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  try {
    let s = JSON.stringify(value, null, 2);
    if (s.length > MAX_PLAYGROUND_COMMENT_LEN) {
      s = `${s.slice(0, MAX_PLAYGROUND_COMMENT_LEN)}\n// … (truncated)`;
    }
    return s;
  } catch {
    return String(value);
  }
}

function playgroundResultAppendix(apiResult: unknown, apiLoading: boolean): string {
  if (apiLoading) return '// …running';
  if (apiResult && typeof apiResult === 'object' && apiResult !== null && '__uninitialized' in apiResult) {
    return '// Run Execute to preview output';
  }
  if (
    apiResult &&
    typeof apiResult === 'object' &&
    apiResult !== null &&
    'error' in apiResult &&
    (apiResult as { error?: unknown }).error != null
  ) {
    return `// Error: ${String((apiResult as { error: unknown }).error)}`;
  }
  const body = serializeValueForPlaygroundComment(apiResult);
  return body
    .split('\n')
    .map((line) => `// ${line}`)
    .join('\n');
}

function buildPlaygroundTsSource(
  method: string,
  query: string,
  lang: WikiLang,
  prefPos: string,
  apiProps: string,
  apiResult: unknown,
  apiLoading: boolean,
): string {
  const base = playgroundTypescriptSnippet(method, query, lang, prefPos, apiProps);
  return `${base}\n\n${playgroundResultAppendix(apiResult, apiLoading)}`;
}

function buildPlaygroundCurlSnippet(
  method: string,
  query: string,
  lang: WikiLang,
  prefPos: string,
  apiProps: string,
): string {
  const base = 'http://localhost:3000/api/fetch';
  const params = new URLSearchParams();
  params.set('query', query || '…');
  if (lang && lang !== 'Auto') params.set('lang', lang);
  if (prefPos && prefPos !== 'Auto') params.set('pos', prefPos);
  if (method && method !== 'wiktionary') params.set('extract', method);

  if (apiProps.trim()) {
    try {
      const p = JSON.parse(apiProps) as Record<string, unknown>;
      for (const [k, v] of Object.entries(p)) {
        if (v != null) params.set(k, String(v));
      }
    } catch { /* ignore invalid JSON */ }
  }

  const encodedUrl = `${base}?${params.toString()}`;
  const displayUrl = (() => {
    try {
      // Mirror browser address-bar behavior: keep a valid URL, but show Unicode.
      return decodeURI(encodedUrl);
    } catch {
      return encodedUrl;
    }
  })();

  return `curl "${displayUrl}"`;
}

function highlightTsLine(line: string): ReactNode {
  const t = line.trimStart();
  if (t.startsWith('//')) {
    return <span className="ts-comment">{line}</span>;
  }

  const nodes: ReactNode[] = [];
  let i = 0;
  let k = 0;
  const push = (cls: string, text: string) => {
    if (text) nodes.push(<span key={k++} className={cls}>{text}</span>);
  };

  while (i < line.length) {
    const rest = line.slice(i);
    const ws = rest.match(/^\s+/);
    if (ws) {
      push('ts-plain', ws[0]);
      i += ws[0].length;
      continue;
    }
    const dq = rest.match(/^"(?:[^"\\]|\\.)*"/);
    if (dq) {
      push('ts-string', dq[0]);
      i += dq[0].length;
      continue;
    }
    const num = rest.match(/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?(?![\w$])/);
    if (num) {
      push('ts-number', num[0]);
      i += num[0].length;
      continue;
    }
    const w = rest.match(/^[\w$]+/);
    if (w) {
      const word = w[0];
      let j = i + word.length;
      while (j < line.length && line[j] === ' ') j++;
      const isCallee = line[j] === '(';
      if (TS_KEYWORDS.has(word)) push('ts-keyword', word);
      else if (isCallee) push('ts-callee', word);
      else push('ts-plain', word);
      i += word.length;
      continue;
    }
    push('ts-punct', line[i]);
    i += 1;
  }
  return <>{nodes}</>;
}

function highlightPlaygroundTs(code: string): ReactNode {
  const lines = code.split('\n');
  return (
    <>
      {lines.map((line, li) => (
        <span key={li}>
          {li > 0 ? '\n' : null}
          {highlightTsLine(line)}
        </span>
      ))}
    </>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  // Search & results state
  const [query, setQuery] = useState('γράφω');
  const [lang, setLang] = useState<WikiLang>('Auto');
  const [prefPos, setPrefPos] = useState('Auto');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Lexeme[]>([]);
  const [rawBlock, setRawBlock] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedEntryIdx, setSelectedEntryIdx] = useState(0);

  // Debug state
  const [debugMode, setDebugMode] = useState(false);
  const [debugEvents, setDebugEvents] = useState<DecoderDebugEvent[][]>([]);
  const [highlightedTemplate, setHighlightedTemplate] = useState<string | null>(null);

  // Compare state
  const [compareMode, setCompareMode] = useState(false);
  const [compareLang, setCompareLang] = useState<WikiLang>('grc');
  const [compareResults, setCompareResults] = useState<Lexeme[]>([]);
  const [compareRawBlock, setCompareRawBlock] = useState('');
  const [compareLoading, setCompareLoading] = useState(false);

  // API Playground state
  const [apiMethod, setApiMethod] = useState('stem');
  const [apiProps, setApiProps] = useState('');
  const [apiResult, setApiResult] = useState<any>({ __uninitialized: true });
  const [apiFormatted, setApiFormatted] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  // Inspector collapse state
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const [narrowSearchBar, setNarrowSearchBar] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 560px)');
    const sync = () => setNarrowSearchBar(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleMethodChange = (method: string) => {
    setApiMethod(method);
    setApiProps('');
    setApiResult({ __uninitialized: true });
    setApiFormatted(null);
  };

  const handleApiExecute = useCallback(async () => {
    setApiLoading(true);
    try {
      let propsObj: Record<string, unknown> | undefined = undefined;
      if (apiProps.trim()) {
        try { propsObj = JSON.parse(apiProps); }
        catch { setApiResult({ error: 'Invalid JSON' }); setApiFormatted(null); setApiLoading(false); return; }
      }
      const fn = API_METHODS[apiMethod];
      let res;
      if (apiMethod === 'translate') {
        const targetLang = String((propsObj as any)?.target ?? 'en');
        res = await fn(query, lang, targetLang, propsObj ?? { mode: 'gloss' }, prefPos);
      } else if (apiMethod === 'wikipediaLink') {
        const targetWiki = String((propsObj as any)?.target ?? 'en');
        res = await fn(query, lang, targetWiki as WikiLang, prefPos);
      } else if (['conjugate', 'decline'].includes(apiMethod)) {
        res = await fn(query, lang, propsObj ?? {});
      } else if (['isInstance', 'isSubclass'].includes(apiMethod)) {
        res = await fn(query, (propsObj as any)?.qid || "Q5", lang);
      } else if (['hyphenate'].includes(apiMethod)) {
        res = await fn(query, lang, propsObj, prefPos);
      } else {
        // Most functions now support (query, lang, pos)
        res = await fn(query, lang, prefPos);
      }
      setApiResult(res);
      // Format for the terminal using the colour-coded terminal-html style
      try {
        const html = format(res, { mode: 'terminal-html' });
        setApiFormatted(html);
      } catch {
        setApiFormatted(null); // fallback to raw
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setApiResult({ error: msg });
      setApiFormatted(`<span style="color:#f87171">Error: ${msg}</span>`);
    }
    setApiLoading(false);
  }, [apiMethod, apiProps, query, lang, prefPos]);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedEntryIdx(0);
    try {
      const res = await wiktionary({ query: query.trim(), lang, pos: prefPos, enrich: true, debugDecoders: debugMode });
      setResults(res.lexemes);
      setRawBlock(res.rawLanguageBlock);
      setDebugEvents(res.debug ?? []);
      if (res.notes.length > 0 && res.lexemes.length === 0) setError(res.notes[0]);

      if (compareMode) {
        setCompareLoading(true);
        try {
          const cRes = await wiktionary({ query: query.trim(), lang: compareLang, pos: prefPos, enrich: false });
          setCompareResults(cRes.lexemes);
          setCompareRawBlock(cRes.rawLanguageBlock);
        } catch { setCompareResults([]); setCompareRawBlock(''); }
        finally { setCompareLoading(false); }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [query, lang, prefPos, compareMode, compareLang, debugMode]);

  // Initial fetch on mount
  useEffect(() => { 
    handleSearch(); 
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── YAML rendering helpers ───────────────────────────────────────────────
  const formatYaml = (data: any) => {
    try { return yaml.dump(data, { indent: 2, lineWidth: -1, noRefs: true, sortKeys: false }); }
    catch { return JSON.stringify(data, null, 2); }
  };

  const highlightValue = (val: string) => {
    const v = val.trim();
    if (!v) return val;
    if (v.match(/^"(.*)"$/)) return <span className="yaml-string">{val}</span>;
    if (v.match(/^'(.*)'$/)) return <span className="yaml-string">{val}</span>;
    if (v.match(/^(true|false|null)$/)) return <span className="yaml-bool">{val}</span>;
    if (v.match(/^-?\d+(\.\d+)?$/)) return <span className="yaml-number">{val}</span>;
    return <span className="yaml-string">{val}</span>;
  };

  const highlightYaml = (text: string) =>
    text.split('\n').map((line, i) => {
      const km = line.match(/^(\s*)([^:]+):/);
      const handleClick = () => {
        const rm = line.match(/raw:\s*'([^']+)'/);
        if (rm) { setHighlightedTemplate(rm[1].slice(0, 40)); return; }
        const tk = line.match(/^\s{4}(\S+):$/);
        if (tk) { setHighlightedTemplate(`{{${tk[1]}`); }
      };
      if (km) {
        const indent = km[1], key = km[2], rest = line.slice(km[0].length);
        return (
          <div key={i} className="whitespace-pre cursor-pointer hover:bg-white/5 transition-colors" onClick={handleClick}>
            {indent}<span className="yaml-key">{key}</span>:{highlightValue(rest)}
          </div>
        );
      }
      return <div key={i} className="whitespace-pre cursor-pointer hover:bg-white/5 transition-colors" onClick={handleClick}>{line}</div>;
    });

  const renderWikitext = (text: string) => {
    if (!text) return <span style={{ color: 'var(--dk-muted)' }}>No wikitext loaded.</span>;
    return text.split('\n').map((line, i) => {
      const hl = highlightedTemplate && line.includes(highlightedTemplate);
      return (
        <div key={i} className={`whitespace-pre-wrap transition-colors ${hl ? 'bg-amber-500/20 border-l-2 border-amber-400 pl-2 -ml-2' : ''}`}>
          {line}
        </div>
      );
    });
  };

  // ── Decoder matches ──────────────────────────────────────────────────────
  const decoderMatches = useMemo(() => {
    if (!debugMode || results.length === 0) return [];
    const events = debugEvents[selectedEntryIdx] ?? debugEvents[0];
    if (events?.length > 0) {
      return events.flatMap((e) => {
        const tpls = e.matchedTemplates ?? [];
        if (!tpls.length) return [{ decoderId: e.decoderId, templateName: e.decoderId, raw: '', fieldsProduced: e.fieldsProduced ?? [] }];
        return tpls.map((t) => ({ decoderId: e.decoderId, templateName: t.name, raw: t.raw, fieldsProduced: (e.fieldsProduced as string[]) ?? [] }));
      });
    }
    const entry = results[selectedEntryIdx] || results[0];
    return extractDecoderMatches(entry);
  }, [debugMode, results, selectedEntryIdx, debugEvents]);

  const currentEntry = results[selectedEntryIdx] || results[0];

  // Render high-fidelity HTML for the current entry (Gold Standard v2.4.0)
  const highFidelityHtml = useMemo(() => {
    if (!currentEntry) return '';
    try {
      // For INFLECTED_FORM, we want to "borrow" the lemma case
      let renderContext = currentEntry;
      if (currentEntry.type === 'INFLECTED_FORM' && currentEntry.form_of?.lemma) {
        // Find the corresponding lemma in the current results
        const lemmaEntry = results.find(e => 
          e.form === currentEntry.form_of?.lemma && 
          e.type === 'LEXEME' &&
          (e.part_of_speech === currentEntry.part_of_speech || !currentEntry.part_of_speech)
        );
        if (lemmaEntry) {
          // Merge: use lemma's senses/etym but preserve inflected form's analysis
          renderContext = {
            ...lemmaEntry,
            ...currentEntry,
            headword: currentEntry.form, // The query term
            // Ensure we use lemma's rich data if inflected form is sparse
            senses: currentEntry.senses?.length ? currentEntry.senses : lemmaEntry.senses,
            etymology: currentEntry.etymology?.chain?.length ? currentEntry.etymology : lemmaEntry.etymology,
            semantic_relations: lemmaEntry.semantic_relations,
            inflection_table: lemmaEntry.inflection_table_ref ? lemmaEntry.inflection_table_ref : (currentEntry as any).inflection_table,
          } as any;
        }
      }

      // Use 'html-fragment' to avoid the full <html>/<body> wrapper
      return format(renderContext, { mode: 'html-fragment' });
    } catch (e) {
      console.error("Format error:", e);
      return '';
    }
  }, [currentEntry, results]);

  const pills = SUGGESTED_PROPS[apiMethod] ?? DEFAULT_PILLS;

  const playgroundTsSource = useMemo(
    () => buildPlaygroundTsSource(apiMethod, query, lang, prefPos, apiProps, apiResult, apiLoading),
    [apiMethod, query, lang, prefPos, apiProps, apiResult, apiLoading],
  );

  const playgroundCurlSource = useMemo(
    () => buildPlaygroundCurlSnippet(apiMethod, query, lang, prefPos, apiProps),
    [apiMethod, query, lang, prefPos, apiProps],
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1.5rem 4rem' }}>
      <style>{ENTRY_CSS}</style>

      {/* ── GitHub Corner ── */}
      <a href="https://github.com/rhythmus/wiktionary-sdk" className="github-corner" aria-label="View source on GitHub" target="_blank" rel="noopener noreferrer">
        <svg width="80" height="80" viewBox="0 0 250 250" aria-hidden="true" style={{ fill: '#151513', position: 'absolute', top: 0, right: 0, border: 0 }}>
          <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z" />
          <path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.9,78.5 120.9,78.5 C119.2,72.0 123.4,76.9 123.4,76.9 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" style={{ transformOrigin: '130px 106px' }} className="octo-arm" />
          <path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" className="octo-body" />
        </svg>
      </a>

      <div style={{ padding: '3.5rem 0 2rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>

        {/* Title — salve-style: left-aligned, sans-serif, bold name + rest inline */}
        <div style={{ marginBottom: results.length || loading ? '1.5rem' : '1.75rem' }}>
          <h1
            className="app-hero-title"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: results.length || loading ? '1.45rem' : '1.85rem',
              fontWeight: 400,
              color: '#111',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            <strong style={{ fontWeight: 700 }}>Wiktionary SDK</strong>
            {' '}— extraction, normalization and formatting
          </h1>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.78rem',
            fontWeight: 400,
            color: '#6b7280',
            marginTop: '0.3rem',
            lineHeight: 1.5,
          }}>
            Get structured lexicographic data from Wiktionary, Wikidata, Wikipedia and Wikimedia
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="google-bar" style={{ width: '100%' }}>
          <Search size={17} style={{ color: '#9ca3af', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a term, e.g. γράφω…"
          />
          <span className="bar-divider" />
          <select
            className="bar-select-lang"
            aria-label="Dictionary language"
            value={lang}
            onChange={(e) => setLang(e.target.value as WikiLang)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {narrowSearchBar ? l.narrow : `${l.flag} ${l.label}`}
              </option>
            ))}
          </select>
          <select
            className="bar-select-pos"
            aria-label="Part of speech filter"
            value={prefPos}
            onChange={(e) => setPrefPos(e.target.value)}
          >
            {POS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {narrowSearchBar ? o.narrow : o.label}
              </option>
            ))}
          </select>
          <button type="submit" className="fetch-btn" disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : null}
            {loading ? 'Loading…' : 'Fetch'}
          </button>
        </form>

      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, marginBottom: '1rem', color: '#ef4444', fontSize: '0.875rem' }}
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dictionary result card */}
      <AnimatePresence>
        {currentEntry && (
          <motion.div
            key={currentEntry.form + selectedEntryIdx}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="dict-card"
            style={{ marginBottom: '1.5rem' }}
          >
            {/* Render handle-bars based high-fidelity output */}
            <div dangerouslySetInnerHTML={{ __html: highFidelityHtml }} />

            {/* Lexeme switcher pills */}
            {results.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '2rem', borderTop: '1px solid var(--page-border)', paddingTop: '1.25rem' }}>
                {results.map((r, i) => (
                  <button key={i} className={`dict-entry-pill${i === selectedEntryIdx ? ' active' : ''}`} onClick={() => setSelectedEntryIdx(i)}>
                    Lexeme {i + 1}: {langName(r.language)} · {r.part_of_speech_heading || r.part_of_speech || '?'}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════
          DARK ISLAND — Playground + Debug Inspector
      ════════════════════════════════════════════════ */}
      <div className="dark-island">

        {/* ── Live API Playground ──────────────────── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="dk-section-title" style={{ marginBottom: '1.25rem' }}>
            <Terminal size={13} style={{ color: 'var(--dk-fuchsia)' }} />
            Live API Playground
          </div>

          {/* Labels row */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.35rem' }}>
            <div style={{ flexShrink: 0, width: 170 }}>
              <label style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--dk-muted)' }}>
                Target Wrapper
              </label>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--dk-muted)' }}>
                Props / Criteria (JSON)
              </label>
            </div>
            <div className="dk-execute-spacer" aria-hidden />
          </div>

          {/* Controls row — all three on the exact same flex line */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select className="dk-select" style={{ flexShrink: 0, width: 170 }} value={apiMethod} onChange={(e) => handleMethodChange(e.target.value)}>
              {API_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.methods.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input
              type="text"
              className="dk-input font-mono"
              style={{ flex: 1, minWidth: 0 }}
              value={apiProps}
              onChange={(e) => setApiProps(e.target.value)}
              placeholder='e.g. {"tense":"present"}'
            />
            <button
              type="button"
              className="dk-execute-btn"
              style={{ flexShrink: 0 }}
              onClick={handleApiExecute}
              disabled={apiLoading}
              aria-label={apiLoading ? 'Running' : 'Execute'}
              title={apiLoading ? 'Running…' : 'Execute'}
            >
              {apiLoading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Terminal size={14} aria-hidden />}
              <span className="dk-execute-label">{apiLoading ? 'Running…' : 'Execute'}</span>
            </button>
          </div>

          {/* Prop pills below the controls row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
            {pills.map((pill) => (
              <button key={pill} className={`dk-pill${apiProps === pill ? ' active' : ''}`} onClick={() => setApiProps(pill)}>
                {pill}
              </button>
            ))}
          </div>

          {/* README-style TypeScript sample for the selected wrapper */}
          <div className="dk-code-window" style={{ marginTop: '1rem' }}>
            {/* Windows-style title bar */}
            <div
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '0 0 0 12px',
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(0,0,0,0.22)',
                height: 32,
              }}
            >
              <span
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  fontSize: '0.69rem',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  flex: 1,
                }}
              >
                TypeScript
              </span>
              <span style={{ display: 'flex', alignItems: 'stretch', height: '100%', flexShrink: 0 }}>
                {['─', '☐', '✕'].map((sym, i) => (
                  <span
                    key={i}
                    aria-hidden
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 40,
                      height: '100%',
                      color: 'rgba(255,255,255,0.35)',
                      fontSize: i === 2 ? '0.8rem' : '0.75rem',
                      fontFamily: 'system-ui, sans-serif',
                    }}
                  >
                    {sym}
                  </span>
                ))}
              </span>
            </div>
            <pre>
              <code>{highlightPlaygroundTs(playgroundTsSource)}</code>
            </pre>
          </div>

          {/* Terminal output well */}
          <div className="dk-well" style={{ marginTop: '0.65rem' }}>
            {/* macOS-style title bar */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(0,0,0,0.22)', height: 32 }}>
              {/* Traffic-light dots */}
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
              </span>
              <span
                style={{
                  color: 'rgba(255,255,255,0.35)',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  flex: 1,
                  textAlign: 'left',
                }}
              >
                CLI
              </span>
            </div>
            {/* Output */}
            <div style={{ padding: '1rem', fontSize: '0.8125rem', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.7, color: 'var(--dk-secondary)', maxHeight: 380, overflow: 'auto' }}>
              {/* CLI prompt line — always shown */}
              <div style={{ marginBottom: apiResult?.__uninitialized ? 0 : '0.35rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.28)' }}>~</span>
                {' '}
                <span style={{ color: '#c4b5fd' }}>wiktionary-sdk</span>
                {' '}
                <span style={{ color: '#fbbf24' }}>{query || '…'}</span>
                {' '}
                <span style={{ color: '#94a3b8' }}>--lang {lang}</span>
                {apiMethod !== 'wiktionary' && (
                  <span style={{ color: '#94a3b8' }}> --extract {apiMethod.replace('()', '')}</span>
                )}
                {apiProps && ['conjugate', 'decline', 'hyphenate'].includes(apiMethod.replace('()', '')) && (
                  <span style={{ color: '#94a3b8' }}> --props <span style={{ color: '#4ade80' }}>'{apiProps}'</span></span>
                )}
                {apiProps && apiMethod.replace('()', '') === 'translate' && (() => { try { const p = JSON.parse(apiProps); return p.target ? <span style={{ color: '#94a3b8' }}> --target <span style={{ color: '#4ade80' }}>{p.target}</span></span> : null; } catch { return null; } })()}
              </div>
              {/* Result output */}
              {!apiResult?.__uninitialized && (
                apiFormatted ? (
                  <div dangerouslySetInnerHTML={{ __html: apiFormatted }} />
                ) : typeof apiResult === 'undefined' ? (
                  <span style={{ color: '#f59e0b' }}>undefined</span>
                ) : apiResult === null ? (
                  <span style={{ color: '#f59e0b' }}>null</span>
                ) : typeof apiResult === 'string' ? (
                  <span style={{ color: '#34d399' }}>"{apiResult}"</span>
                ) : (
                  <span style={{ color: '#94a3b8' }}>{JSON.stringify(apiResult, null, 2)}</span>
                )
              )}
            </div>
          </div>

          {/* REST API — Linux/Ubuntu-style terminal window */}
          <div className="dk-well" style={{ marginTop: '0.65rem' }}>
            <div style={{
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              padding: '0 0 0 14px',
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.22)',
              height: 32,
            }}>
              <span style={{
                color: 'rgba(255,255,255,0.4)',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: '0.75rem',
                fontWeight: 700,
                flex: 1,
                textAlign: 'left',
              }}>
                REST API
              </span>
              <span style={{ display: 'flex', alignItems: 'stretch', height: '100%', flexShrink: 0 }}>
                {['▽', '△', '✕'].map((sym, i) => (
                  <span
                    key={i}
                    aria-hidden
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: '100%',
                      color: 'rgba(255,255,255,0.3)',
                      fontSize: '0.65rem',
                      fontFamily: 'system-ui, sans-serif',
                    }}
                  >
                    {sym}
                  </span>
                ))}
              </span>
            </div>
            <div style={{ padding: '1rem', fontSize: '0.8125rem', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.7, color: 'var(--dk-secondary)', maxHeight: 380, overflow: 'auto' }}>
              <div>
                <span style={{ color: '#4ade80' }}>user@sdk</span>
                <span style={{ color: 'rgba(255,255,255,0.28)' }}>:</span>
                <span style={{ color: '#60a5fa' }}>~</span>
                <span style={{ color: 'rgba(255,255,255,0.28)' }}>$ </span>
                <span style={{ color: '#e2e8f0' }}>{playgroundCurlSource}</span>
              </div>
              {!apiResult?.__uninitialized && (
                <div style={{ marginTop: '0.35rem' }}>
                  {apiLoading ? (
                    <span style={{ color: '#94a3b8' }}>{'  % Total    % Received    Time     Elapsed\n  …waiting'}</span>
                  ) : apiResult && typeof apiResult === 'object' && apiResult !== null && 'error' in apiResult ? (
                    <span style={{ color: '#f87171' }}>{'{ "error": '}{JSON.stringify((apiResult as { error: unknown }).error)}{'}'}</span>
                  ) : (
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#94a3b8' }}>
                      {JSON.stringify(apiResult, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Debug Inspector (collapsible) ────────── */}
        <div>
          {/* Collapse toggle + Debug/Compare buttons in same row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="dk-toggle" onClick={() => setInspectorOpen((v) => !v)}>
              <motion.span animate={{ rotate: inspectorOpen ? 90 : 0 }} style={{ display: 'flex' }}>
                <ChevronRight size={14} />
              </motion.span>
              <span className="dk-section-title">Debug Inspector</span>
            </button>

            {/* Debug toggle — lives HERE, not in the dict card */}
            <button
              className={`dk-icon-btn${debugMode ? ' active-amber' : ''}`}
              onClick={() => { setDebugMode((v) => !v); if (query.trim()) setTimeout(() => handleSearch(), 0); }}
              title="Toggle decoder debug mode"
            >
              <Bug size={11} /> Debug
            </button>

            {/* Compare toggle — lives HERE too */}
            <button
              className={`dk-icon-btn${compareMode ? ' active-emerald' : ''}`}
              onClick={() => { setCompareMode((v) => !v); if (!compareMode && results.length > 0) handleSearch(); }}
              title="Toggle comparison view"
            >
              <Columns2 size={11} /> Compare
            </button>

            {compareMode && (
              <select
                className="dk-select"
                style={{ maxWidth: 150, padding: '3px 8px', fontSize: '0.75rem' }}
                value={compareLang}
                onChange={(e) => setCompareLang(e.target.value as WikiLang)}
              >
                {LANGUAGES.filter((l) => l.value !== lang).map((l) => (
                  <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                ))}
              </select>
            )}

          </div>


          <AnimatePresence>
            {inspectorOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ paddingTop: '1.25rem' }}>

                  {/* Highlighted template badge */}
                  {highlightedTemplate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#f59e0b', marginBottom: '0.75rem' }}>
                      <span>Highlighting: <code style={{ background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 4 }}>{highlightedTemplate}</code></span>
                      <button onClick={() => setHighlightedTemplate(null)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>
                    </div>
                  )}

                  {/* Raw Wikitext + Normalized YAML panels */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: compareMode ? '1fr 1fr 1fr' : '1fr 1fr',
                      gap: '1rem',
                      alignItems: 'stretch',
                    }}
                  >

                    {/* Raw Wikitext */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.75rem',
                          color: 'var(--dk-secondary)',
                          minHeight: 44,
                          flexShrink: 0,
                        }}
                      >
                        <Languages size={14} style={{ color: '#60a5fa' }} /> Raw Wikitext
                      </div>
                      <div
                        className="dk-panel"
                        style={{
                          flex: 1,
                          minHeight: 520,
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ borderBottom: '1px solid var(--dk-border)', padding: '5px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--dk-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                          <span>Section: {langName(lang)}</span>
                          <span>{rawBlock.length} chars</span>
                        </div>
                        <pre style={{ flex: 1, padding: '1rem', overflow: 'auto', fontSize: '0.78rem', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6, color: 'var(--dk-secondary)', minHeight: 0 }}>
                          {renderWikitext(rawBlock)}
                        </pre>
                      </div>
                    </div>

                    {/* Normalized YAML */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          flexWrap: 'nowrap',
                          minHeight: 44,
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--dk-secondary)', minWidth: 0 }}>
                          <ChevronRight size={14} style={{ color: '#818cf8', flexShrink: 0 }} /> Normalized YAML
                        </div>
                        {results.length > 1 && (
                          <select
                            className="dk-select"
                            style={{ maxWidth: 160, padding: '2px 6px', fontSize: '0.7rem', flexShrink: 0 }}
                            value={selectedEntryIdx}
                            onChange={(e) => setSelectedEntryIdx(Number(e.target.value))}
                          >
                            {results.map((r, i) => <option key={i} value={i}>Lexeme {i + 1}: {r.type}</option>)}
                          </select>
                        )}
                      </div>
                      <div
                        className="dk-panel"
                        style={{
                          flex: 1,
                          minHeight: 520,
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ borderBottom: '1px solid var(--dk-border)', padding: '5px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--dk-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                          <span>Entries: {results.length}</span>
                          <span>Schema v1.0.0{debugMode ? ' | Debug ON' : ''}</span>
                        </div>
                        <div style={{ flex: 1, padding: '1rem', overflow: 'auto', fontSize: '0.78rem', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6, minHeight: 0 }}>
                          {loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--dk-muted)' }}>
                              <Loader2 size={18} className="animate-spin" /> Processing…
                            </div>
                          ) : results.length > 0 ? (
                            highlightYaml(formatYaml({ lexemes: results }))
                          ) : (
                            <span style={{ color: 'var(--dk-muted)' }}>No results.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Compare panel */}
                    {compareMode && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.75rem',
                            color: 'var(--dk-secondary)',
                            minHeight: 44,
                            flexShrink: 0,
                          }}
                        >
                          <Columns2 size={14} style={{ color: '#34d399' }} /> {langName(compareLang)}
                        </div>
                        <div
                          className="dk-panel"
                          style={{
                            flex: 1,
                            minHeight: 520,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            borderColor: 'rgba(16,185,129,0.2)',
                          }}
                        >
                          <div style={{ borderBottom: '1px solid rgba(16,185,129,0.15)', padding: '5px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--dk-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                            <span>Entries: {compareResults.length}</span>
                            <span>{compareRawBlock.length} chars</span>
                          </div>
                          <div style={{ flex: 1, padding: '1rem', overflow: 'auto', fontSize: '0.78rem', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6, minHeight: 0 }}>
                            {compareLoading ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--dk-muted)' }}>
                                <Loader2 size={18} className="animate-spin" /> Fetching…
                              </div>
                            ) : compareResults.length > 0 ? (
                              highlightYaml(formatYaml({ lexemes: compareResults }))
                            ) : (
                              <span style={{ color: 'var(--dk-muted)' }}>No results in {langName(compareLang)}.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Decoder matches table */}
                  {debugMode && decoderMatches.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--dk-secondary)', marginBottom: '0.75rem' }}>
                        <Bug size={14} style={{ color: '#f59e0b' }} /> Decoder Matches — Lexeme {selectedEntryIdx + 1}
                      </div>
                      <div className="dk-panel" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.78rem', textAlign: 'left', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--dk-border)', color: 'var(--dk-muted)' }}>
                              {['Decoder', 'Template', 'Raw', 'Fields Produced'].map((h) => <th key={h} style={{ padding: '8px 12px', fontWeight: 600 }}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {decoderMatches.map((m, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                                onClick={() => m.raw && setHighlightedTemplate(m.raw.slice(0, 40))}>
                                <td style={{ padding: '7px 12px', color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace" }}>{m.decoderId}</td>
                                <td style={{ padding: '7px 12px', color: '#60a5fa', fontFamily: "'JetBrains Mono', monospace" }}>{m.templateName ? `{{${m.templateName}}}` : '–'}</td>
                                <td style={{ padding: '7px 12px', color: 'var(--dk-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem' }}>{m.raw}</td>
                                <td style={{ padding: '7px 12px' }}>
                                  {m.fieldsProduced.map((f: string) => (
                                    <span key={f} style={{ display: 'inline-block', background: 'rgba(129,140,248,0.15)', color: '#a5b4fc', fontSize: '0.68rem', padding: '2px 7px', borderRadius: 999, marginRight: 4, marginBottom: 2 }}>{f}</span>
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Wikidata media */}
                  {results.some((r) => r.wikidata?.media?.thumbnail) && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--dk-secondary)', marginBottom: '0.75rem' }}>
                        <ImageIcon size={14} style={{ color: '#34d399' }} /> Wikidata Media
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                        {results.map((r, i) => r.wikidata?.media?.thumbnail ? (
                          <div key={i} className="dk-panel" style={{ width: 200 }}>
                            <img src={r.wikidata.media.thumbnail} alt={r.form} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: '11px 11px 0 0' }} />
                            <div style={{ padding: '0.5rem 0.75rem' }}>
                              <p style={{ fontSize: '0.8rem', fontWeight: 500 }}>{r.form}</p>
                              <p style={{ fontSize: '0.7rem', color: 'var(--dk-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.wikidata.media.P18}</p>
                            </div>
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  )}

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────── */}
      <footer style={{ marginTop: '3rem', textAlign: 'center', fontSize: '0.72rem', color: '#9ca3af', fontFamily: "'Inter', sans-serif" }}>
        Copyright © 2026 <a href="https://wso.art">Dr Wouter Soudan</a>. All rights reserved.
      </footer>
    </div>
  );
};

export default App;
