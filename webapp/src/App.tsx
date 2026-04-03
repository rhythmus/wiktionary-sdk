import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
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
  categories, langlinks, inflectionTableRef, gender, transitivity, invokeWrapperMethod,
  stripCombiningMarksForPageTitle,
} from '@engine/index';
import { ENTRY_CSS } from '@engine/templates/templates';
import { SHARED_COPY } from './shared-copy.generated';
import type { Lexeme, WikiLang, DecoderDebugEvent, FetchResult } from '@engine/types';
import { normalizeWikiLangArg, langToLanguageName, languageNameToLang } from '@engine/parser';
import { format, formatInflectedFormHeadline } from '@engine/formatter';

/** Full language name for pills / labels (codes + section titles like "Latin"). */
function langName(lang: string) {
  const s = String(lang).trim();
  if (!s) return '?';
  const fromCode = langToLanguageName(s as WikiLang);
  if (fromCode !== null) return fromCode;
  const code = languageNameToLang(s);
  if (code) {
    const full = langToLanguageName(code);
    if (full !== null) return full;
  }
  return s;
}

/** Prefer decoder `part_of_speech` over raw section heading when both exist (headword vs heading mismatch). */
function posLabelForPill(r: Lexeme): string {
  const raw =
    (r.part_of_speech && String(r.part_of_speech).trim()) ||
    r.part_of_speech_heading ||
    r.part_of_speech ||
    '?';
  return String(raw)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Pick the lemma LEXEME from a second wiktionary() response. Uses only API fields:
 * page title match (`form` === lemma query from {{… of}}) and optional PoS tie-break
 * from the inflected lexeme’s decoded part_of_speech (not guessed elsewhere).
 */
function pickLemmaLexemeFromSecondFetch(
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
    const byPos = candidates.find((l) => l.part_of_speech === preferredPos);
    if (byPos) return byPos;
  }
  return candidates[0];
}

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
  { value: 'Auto', label: 'All languages', flag: '🌍', narrow: '🌍' },
  { value: 'el', label: 'Greek', flag: '🇬🇷', narrow: '🇬🇷' },
  { value: 'grc', label: 'Anc. Greek', flag: '🏛️', narrow: '🏛️' },
  { value: 'en', label: 'English', flag: '🇬🇧', narrow: '🇬🇧' },
  { value: 'es', label: 'Spanish', flag: '🇪🇸', narrow: '🇪🇸' },
  { value: 'la', label: 'Latin', flag: 'LA', narrow: 'La' },
  { value: 'af', label: 'Afrikaans', flag: '🇿🇦', narrow: '🇿🇦' },
  { value: 'da', label: 'Danish', flag: '🇩🇰', narrow: '🇩🇰' },
  { value: 'ja', label: 'Japanese', flag: '🇯🇵', narrow: '🇯🇵' },
  { value: 'ar', label: 'Arabic', flag: '🇸🇦', narrow: '🇸🇦' },
  { value: 'ru', label: 'Russian', flag: '🇷🇺', narrow: '🇷🇺' },
  { value: 'it', label: 'Italian', flag: '🇮🇹', narrow: '🇮🇹' },
  { value: 'pt', label: 'Portuguese', flag: '🇵🇹', narrow: '🇵🇹' },
  { value: 'nl', label: 'Dutch', flag: '🇳🇱', narrow: '🇳🇱' },
  { value: 'de', label: 'German', flag: '🇩🇪', narrow: '🇩🇪' },
  { value: 'fr', label: 'French', flag: '🇫🇷', narrow: '🇫🇷' },
] as const;

const POS_OPTIONS = [
  { value: 'Auto', label: 'All word classes', narrow: '·' },
  { value: 'verb', label: 'Verb', narrow: 'V' },
  { value: 'noun', label: 'Noun', narrow: 'N' },
  { value: 'adjective', label: 'Adjective', narrow: 'Adj' },
  { value: 'pronoun', label: 'Pronoun', narrow: 'Pr' },
  { value: 'numeral', label: 'Numeral', narrow: '#' },
  { value: 'adverb', label: 'Adverb', narrow: 'Adv' },
] as const;

const MATCH_OPTIONS = [
  { value: 'fuzzy', label: 'Fuzzy match', narrow: 'Fz' },
  { value: 'strict', label: 'Strict match', narrow: 'St' },
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

function serializeValueForPlaygroundComment(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  try {
    return JSON.stringify(value, null, 2);
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
  const getQueryFromUrl = () => {
    if (typeof window === 'undefined') return '';
    const raw = new URLSearchParams(window.location.search).get('q');
    return (raw ?? '').trim();
  };

  // Search & results state
  const [query, setQuery] = useState(() => getQueryFromUrl() || 'γράφω');
  const [lang, setLang] = useState<WikiLang>('Auto');
  const [prefPos, setPrefPos] = useState('Auto');
  const [matchMode, setMatchMode] = useState<'strict' | 'fuzzy'>('fuzzy');
  /** Second fetch for non-lemma → lemma resolution (explicit API; no in-result guessing). */
  const [lemmaResolveEntry, setLemmaResolveEntry] = useState<Lexeme | null>(null);
  const [lemmaResolveLoading, setLemmaResolveLoading] = useState(false);
  const [lemmaResolveError, setLemmaResolveError] = useState<string | null>(null);
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
  const [restoredWindowHeights, setRestoredWindowHeights] = useState<{ ts?: number; cli?: number; rest?: number }>({});
  const baselineWindowHeightsRef = useRef<{ ts?: number; cli?: number; rest?: number }>({});
  const tsWindowRef = useRef<HTMLDivElement | null>(null);
  const cliWindowRef = useRef<HTMLDivElement | null>(null);
  const restWindowRef = useRef<HTMLDivElement | null>(null);

  // Inspector collapse state
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const [narrowSearchBar, setNarrowSearchBar] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const sync = () => setNarrowSearchBar(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────
  const syncUrlQuery = useCallback((nextQuery: string, mode: 'push' | 'replace' = 'push') => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const q = nextQuery.trim();
    if (q) url.searchParams.set('q', q);
    else url.searchParams.delete('q');
    if (mode === 'push') window.history.pushState({}, '', url);
    else window.history.replaceState({}, '', url);
  }, []);

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
      const res = await invokeWrapperMethod(apiMethod, fn, query, {
        sourceLang: lang,
        preferredPos: prefPos,
        props: propsObj,
      });
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
    const triggeredFromFormSubmit = Boolean(e);
    if (e) e.preventDefault();
    if (!query.trim()) return;
    syncUrlQuery(query, e ? 'push' : 'replace');
    setLoading(true);
    setError(null);
    setSelectedEntryIdx(0);
    try {
      const res = await wiktionary({ query: query.trim(), lang, pos: prefPos, enrich: true, debugDecoders: debugMode, matchMode });
      setResults(res.lexemes);
      setRawBlock(res.rawLanguageBlock);
      setDebugEvents(res.debug ?? []);
      if (res.notes.length > 0 && res.lexemes.length === 0) setError(res.notes[0]);

      if (compareMode) {
        setCompareLoading(true);
        try {
          const cRes = await wiktionary({ query: query.trim(), lang: compareLang, pos: prefPos, enrich: false, matchMode });
          setCompareResults(cRes.lexemes);
          setCompareRawBlock(cRes.rawLanguageBlock);
        } catch { setCompareResults([]); setCompareRawBlock(''); }
        finally { setCompareLoading(false); }
      }

      // Keep hero-search and playground in sync: when the user submits the
      // search form, auto-run the currently selected wrapper immediately.
      if (triggeredFromFormSubmit) {
        await handleApiExecute();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [query, lang, prefPos, matchMode, compareMode, compareLang, debugMode, syncUrlQuery, handleApiExecute]);

  // Initial fetch on mount
  useEffect(() => { 
    handleSearch(); 
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPopState = () => {
      const q = getQueryFromUrl();
      setQuery(q || 'γράφω');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const captureBaseline = (key: 'ts' | 'cli' | 'rest', ref: React.RefObject<HTMLDivElement | null>) => {
      if (baselineWindowHeightsRef.current[key]) return;
      const h = ref.current?.getBoundingClientRect().height ?? 0;
      if (h > 0) baselineWindowHeightsRef.current[key] = Math.round(h);
    };
    captureBaseline('ts', tsWindowRef);
    captureBaseline('cli', cliWindowRef);
    captureBaseline('rest', restWindowRef);
  }, [apiResult, apiLoading, apiMethod, apiProps, query, lang, prefPos]);

  const restoreWindowHeight = useCallback((key: 'ts' | 'cli' | 'rest') => {
    const baseline = baselineWindowHeightsRef.current[key];
    if (!baseline) return;
    setRestoredWindowHeights((prev) => ({ ...prev, [key]: baseline }));
  }, []);

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

  const needsLemmaResolution = useMemo(
    () =>
      Boolean(
        currentEntry &&
          (currentEntry.type === 'INFLECTED_FORM' || currentEntry.type === 'FORM_OF') &&
          currentEntry.form_of?.lemma?.trim(),
      ),
    [currentEntry],
  );

  useEffect(() => {
    if (!needsLemmaResolution || !currentEntry?.form_of?.lemma?.trim()) {
      setLemmaResolveEntry(null);
      setLemmaResolveLoading(false);
      setLemmaResolveError(null);
      return;
    }

    const lemmaQuery = currentEntry.form_of!.lemma!.trim();
    const lang = normalizeWikiLangArg(currentEntry.language);
    const preferredPos =
      currentEntry.part_of_speech && currentEntry.part_of_speech !== 'Auto'
        ? currentEntry.part_of_speech
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
    needsLemmaResolution,
    currentEntry?.id,
    currentEntry?.form_of?.lemma,
    currentEntry?.language,
    currentEntry?.part_of_speech,
    currentEntry?.type,
    debugMode,
    matchMode,
  ]);

  const inflectedFormHeadlineHtml = useMemo(() => {
    if (!needsLemmaResolution || !currentEntry) return '';
    return formatInflectedFormHeadline(currentEntry);
  }, [needsLemmaResolution, currentEntry]);

  const nestedLemmaEntryHtml = useMemo(() => {
    if (!lemmaResolveEntry) return '';
    return format(lemmaResolveEntry, { mode: 'html-fragment' });
  }, [lemmaResolveEntry]);

  // Render high-fidelity HTML for the current entry (Gold Standard v2.4.0)
  const highFidelityHtml = useMemo(() => {
    if (!currentEntry) return '';
    if (needsLemmaResolution) return '';
    try {
      return format(currentEntry, { mode: 'html-fragment' });
    } catch (e) {
      console.error("Format error:", e);
      return '';
    }
  }, [currentEntry, needsLemmaResolution]);

  const pills = SUGGESTED_PROPS[apiMethod] ?? DEFAULT_PILLS;

  const playgroundTsSource = useMemo(
    () => buildPlaygroundTsSource(apiMethod, query, lang, prefPos, apiProps, apiResult, apiLoading),
    [apiMethod, query, lang, prefPos, apiProps, apiResult, apiLoading],
  );

  const playgroundCurlSource = useMemo(
    () => buildPlaygroundCurlSnippet(apiMethod, query, lang, prefPos, apiProps),
    [apiMethod, query, lang, prefPos, apiProps],
  );

  // Release restored/fixed heights when new content arrives so windows can
  // auto-grow again up to CSS max-height.
  useEffect(() => {
    setRestoredWindowHeights((prev) => (prev.ts ? { ...prev, ts: undefined } : prev));
  }, [playgroundTsSource]);

  useEffect(() => {
    setRestoredWindowHeights((prev) => (prev.cli ? { ...prev, cli: undefined } : prev));
  }, [apiFormatted, apiResult, apiLoading, query, lang, apiMethod]);

  useEffect(() => {
    setRestoredWindowHeights((prev) => (prev.rest ? { ...prev, rest: undefined } : prev));
  }, [playgroundCurlSource, apiResult, apiLoading]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <style>{ENTRY_CSS}</style>

      {/* ── GitHub Corner ── */}
      <a href="https://github.com/rhythmus/wiktionary-sdk" className="github-corner" aria-label="View source on GitHub" target="_blank" rel="noopener noreferrer">
        <svg width="80" height="80" viewBox="0 0 250 250" aria-hidden="true" style={{ fill: '#151513', position: 'absolute', top: 0, right: 0, border: 0 }}>
          <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z" />
          <path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.9,78.5 120.9,78.5 C119.2,72.0 123.4,76.9 123.4,76.9 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" style={{ transformOrigin: '130px 106px' }} className="octo-arm" />
          <path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" className="octo-body" />
        </svg>
      </a>

      <div className="app-hero-wrap">

        {/* Title — salve-style: left-aligned, sans-serif, bold name + rest inline */}
        <div className={`app-hero-block${results.length || loading ? ' has-results' : ''}`}>
          <h1
            className={`app-hero-title${results.length || loading ? ' compact' : ''}`}
          >
            <strong className="app-hero-title-strong">{SHARED_COPY.heroTitle.split(' — ')[0]}</strong>
            {' '}— {SHARED_COPY.heroTitle.split(' — ').slice(1).join(' — ')}
          </h1>
          <p className="app-hero-tagline app-body-paragraph">
            {SHARED_COPY.heroTagline}
          </p>
          
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="google-bar app-search-form">
          {!narrowSearchBar && <Search size={17} className="app-search-icon" />}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a term, e.g. γράφω…"
          />
          {!narrowSearchBar && (
            <div className="bar-filters">
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
              <select
                className="bar-select-match"
                aria-label="Match mode"
                value={matchMode}
                onChange={(e) => setMatchMode(e.target.value as 'strict' | 'fuzzy')}
              >
                {MATCH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {narrowSearchBar ? m.narrow : m.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className="fetch-btn" disabled={loading}>
            {loading ? <Loader2 size={13} className="fetch-spinner animate-spin" aria-hidden /> : <Search size={14} className="fetch-icon" aria-hidden />}
            <span className="fetch-label">{loading ? 'Loading…' : 'Fetch'}</span>
          </button>
        </form>
        {narrowSearchBar && (
          <div className="bar-filters-outside">
            <select
              className="bar-select-lang"
              aria-label="Dictionary language"
              value={lang}
              onChange={(e) => setLang(e.target.value as WikiLang)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {`${l.flag} ${l.label}`}
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
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="bar-select-match"
              aria-label="Match mode"
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as 'strict' | 'fuzzy')}
            >
              {MATCH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}

      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="app-error-banner"
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="app-hero-intro app-body-paragraph">
            <a href={SHARED_COPY.wiktionaryUrl} target="_blank" rel="noreferrer">Wiktionary</a> {SHARED_COPY.introLead.replace(/^Wiktionary\s+/, "")}{" "}
            <a
              href={`/?q=${encodeURIComponent(SHARED_COPY.pitaQuery)}`}
              onClick={(e) => {
                e.preventDefault();
                const next = SHARED_COPY.pitaQuery;
                setQuery(next);
                syncUrlQuery(next, 'push');
              }}
              className="app-inline-link"
            >
              pita
            </a>
            . {SHARED_COPY.introTail}
          </p>

      {/* Dictionary result card */}
      <AnimatePresence>
        {currentEntry && (
          <motion.div
            key={currentEntry.form + selectedEntryIdx}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="dict-card app-dict-card"
          >
            {/* Inflected/form-of: headline from first query; lemma body from second wiktionary() (decoded lemma + lang + pos). */}
            {needsLemmaResolution ? (
              <div className="dict-entry-form-of-wrap">
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
            ) : (
              <div dangerouslySetInnerHTML={{ __html: highFidelityHtml }} />
            )}

            {/* Lexeme switcher pills */}
            {results.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '2rem', borderTop: '1px solid var(--page-border)', paddingTop: '1.25rem' }}>
                {results.map((r, i) => (
                  <button key={i} className={`dict-entry-pill${i === selectedEntryIdx ? ' active' : ''}`} onClick={() => setSelectedEntryIdx(i)}>
                    Lexeme {i + 1}: {langName(r.language)} · {posLabelForPill(r)}
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
        <div className="app-playground-block">
          <div className="dk-section-title" style={{ marginBottom: '1.25rem' }}>
            <Terminal size={13} style={{ color: 'var(--dk-fuchsia)' }} />
            Live API Playground
          </div>

          {/* Labels row */}
          <div className="dk-controls-labels" style={{ gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.35rem' }}>
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
          <div className="dk-controls-row">
            <select className="dk-select dk-method-select" value={apiMethod} onChange={(e) => handleMethodChange(e.target.value)}>
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
              className="dk-input font-mono dk-props-input"
              value={apiProps}
              onChange={(e) => setApiProps(e.target.value)}
              placeholder='e.g. {"tense":"present"}'
            />
            <button
              type="button"
              className="dk-execute-btn dk-controls-execute"
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
          <div className="dk-pills-row">
            {pills.map((pill) => (
              <button key={pill} className={`dk-pill${apiProps === pill ? ' active' : ''}`} onClick={() => setApiProps(pill)}>
                {pill}
              </button>
            ))}
          </div>

          {/* README-style TypeScript sample for the selected wrapper */}
          <div
            ref={tsWindowRef}
            className="dk-code-window dk-block-gap-md"
            style={restoredWindowHeights.ts ? { height: `${restoredWindowHeights.ts}px` } : undefined}
          >
            {/* Windows-style title bar */}
            <div className="dk-window-titlebar dk-window-titlebar-win">
              <span className="dk-window-title dk-window-title-win">
                TypeScript
              </span>
              <span className="dk-window-controls dk-window-controls-win">
                {['─', '☐', '✕'].map((sym, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className={`dk-window-control dk-window-control-win${i === 2 ? ' is-close' : ''}`}
                    onClick={i === 1 ? () => restoreWindowHeight('ts') : undefined}
                  >
                    {sym}
                  </span>
                ))}
              </span>
            </div>
            <pre style={restoredWindowHeights.ts ? { maxHeight: `${Math.max(120, restoredWindowHeights.ts - 32)}px` } : undefined}>
              <code>{highlightPlaygroundTs(playgroundTsSource)}</code>
            </pre>
          </div>

          {/* Terminal output well */}
          <div
            ref={cliWindowRef}
            className="dk-well dk-block-gap-sm"
            style={restoredWindowHeights.cli ? { height: `${restoredWindowHeights.cli}px` } : undefined}
          >
            {/* macOS-style title bar */}
            <div className="dk-window-titlebar dk-window-titlebar-mac">
              {/* Traffic-light dots */}
              <span className="dk-traffic-lights">
                <span className="dk-dot dk-dot-red" />
                <span className="dk-dot dk-dot-amber" />
                <span className="dk-dot dk-dot-green" onClick={() => restoreWindowHeight('cli')} />
              </span>
              <span className="dk-window-title dk-window-title-mac">
                CLI
              </span>
            </div>
            {/* Output */}
            <div
              className="dk-well-output"
              style={restoredWindowHeights.cli ? { maxHeight: `${Math.max(120, restoredWindowHeights.cli - 32)}px` } : undefined}
            >
              {/* CLI prompt line — always shown */}
              <div className={`dk-cli-prompt${apiResult?.__uninitialized ? '' : ' has-output'}`}>
                <span className="dk-c-dim">~</span>
                {' '}
                <span className="dk-c-violet">wiktionary-sdk</span>
                {' '}
                <span className="dk-c-amber">{query || '…'}</span>
                {' '}
                <span className="dk-c-muted">--lang {lang}</span>
                {apiMethod !== 'wiktionary' && (
                  <span className="dk-c-muted"> --extract {apiMethod.replace('()', '')}</span>
                )}
                {apiProps && ['conjugate', 'decline', 'hyphenate'].includes(apiMethod.replace('()', '')) && (
                  <span className="dk-c-muted"> --props <span className="dk-c-green">'{apiProps}'</span></span>
                )}
                {apiProps && apiMethod.replace('()', '') === 'translate' && (() => { try { const p = JSON.parse(apiProps); return p.target ? <span className="dk-c-muted"> --target <span className="dk-c-green">{p.target}</span></span> : null; } catch { return null; } })()}
              </div>
              {/* Result output */}
              {!apiResult?.__uninitialized && (
                apiFormatted ? (
                  <div dangerouslySetInnerHTML={{ __html: apiFormatted }} />
                ) : typeof apiResult === 'undefined' ? (
                  <span className="dk-c-warn">undefined</span>
                ) : apiResult === null ? (
                  <span className="dk-c-warn">null</span>
                ) : typeof apiResult === 'string' ? (
                  <span className="dk-c-green">"{apiResult}"</span>
                ) : (
                  <span className="dk-c-muted">{JSON.stringify(apiResult, null, 2)}</span>
                )
              )}
            </div>
          </div>

          {/* REST API — Linux/Ubuntu-style terminal window */}
          <div
            ref={restWindowRef}
            className="dk-well dk-block-gap-sm"
            style={restoredWindowHeights.rest ? { height: `${restoredWindowHeights.rest}px` } : undefined}
          >
            <div className="dk-window-titlebar dk-window-titlebar-rest">
              <span className="dk-window-title dk-window-title-rest">
                REST API
              </span>
              <span className="dk-window-controls dk-window-controls-rest">
                {['▽', '△', '✕'].map((sym, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="dk-window-control dk-window-control-rest"
                    onClick={i === 1 ? () => restoreWindowHeight('rest') : undefined}
                  >
                    {sym}
                  </span>
                ))}
              </span>
            </div>
            <div
              className="dk-well-output"
              style={restoredWindowHeights.rest ? { maxHeight: `${Math.max(120, restoredWindowHeights.rest - 32)}px` } : undefined}
            >
              <div>
                <span className="dk-c-green">user@sdk</span>
                <span className="dk-c-dim">:</span>
                <span className="dk-c-blue">~</span>
                <span className="dk-c-dim">$ </span>
                <span className="dk-c-light">{playgroundCurlSource}</span>
              </div>
              {!apiResult?.__uninitialized && (
                <div className="dk-rest-output">
                  {apiLoading ? (
                    <span className="dk-c-muted">{'  % Total    % Received    Time     Elapsed\n  …waiting'}</span>
                  ) : apiResult && typeof apiResult === 'object' && apiResult !== null && 'error' in apiResult ? (
                    <span className="dk-c-error">{'{ "error": '}{JSON.stringify((apiResult as { error: unknown }).error)}{'}'}</span>
                  ) : (
                    <pre className="dk-rest-json">
                      {JSON.stringify(apiResult, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Debug Inspector (collapsible) — hidden on narrow viewports (see index.css) ────────── */}
        <div className="dk-inspector-block">
          {/* Collapse toggle + Debug/Compare buttons in same row */}
          <div className="dk-inspector-toolbar">
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
                className="dk-select dk-compare-select"
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
                className="dk-inspector-collapse"
              >
                <div className="dk-inspector-content">

                  {/* Highlighted template badge */}
                  {highlightedTemplate && (
                    <div className="dk-highlight-row">
                      <span>Highlighting: <code className="app-inline-code-chip dk-highlight-chip">{highlightedTemplate}</code></span>
                      <button className="dk-highlight-clear" onClick={() => setHighlightedTemplate(null)}><X size={13} /></button>
                    </div>
                  )}

                  {/* Raw Wikitext + Normalized YAML panels */}
                  <div className={`dk-inspector-grid${compareMode ? ' compare' : ''}`}>

                    {/* Raw Wikitext */}
                    <div className="dk-inspector-col">
                      <div className="dk-inspector-col-title">
                        <Languages size={14} className="dk-title-icon-blue" /> Raw Wikitext
                      </div>
                      <div className="dk-panel dk-inspector-panel">
                        <div className="dk-inspector-panel-meta">
                          <span>Section: {langName(lang)}</span>
                          <span>{rawBlock.length} chars</span>
                        </div>
                        <pre className="dk-inspector-pre">
                          {renderWikitext(rawBlock)}
                        </pre>
                      </div>
                    </div>

                    {/* Normalized YAML */}
                    <div className="dk-inspector-col">
                      <div className="dk-inspector-col-head">
                        <div className="dk-inspector-col-title">
                          <ChevronRight size={14} className="dk-title-icon-violet" /> Normalized YAML
                        </div>
                        {results.length > 1 && (
                          <select
                            className="dk-select dk-lexeme-select"
                            value={selectedEntryIdx}
                            onChange={(e) => setSelectedEntryIdx(Number(e.target.value))}
                          >
                            {results.map((r, i) => <option key={i} value={i}>Lexeme {i + 1}: {r.type}</option>)}
                          </select>
                        )}
                      </div>
                      <div className="dk-panel dk-inspector-panel">
                        <div className="dk-inspector-panel-meta">
                          <span>Entries: {results.length}</span>
                          <span>Schema v1.0.0{debugMode ? ' | Debug ON' : ''}</span>
                        </div>
                        <div className="dk-inspector-scroll">
                          {loading ? (
                            <div className="dk-inspector-loading">
                              <Loader2 size={18} className="animate-spin" /> Processing…
                            </div>
                          ) : results.length > 0 ? (
                            highlightYaml(formatYaml({ lexemes: results }))
                          ) : (
                            <span className="dk-muted-text">No results.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Compare panel */}
                    {compareMode && (
                      <div className="dk-inspector-col">
                        <div className="dk-inspector-col-title">
                          <Columns2 size={14} className="dk-title-icon-green" /> {langName(compareLang)}
                        </div>
                        <div className="dk-panel dk-inspector-panel dk-inspector-panel-compare">
                          <div className="dk-inspector-panel-meta dk-inspector-panel-meta-compare">
                            <span>Entries: {compareResults.length}</span>
                            <span>{compareRawBlock.length} chars</span>
                          </div>
                          <div className="dk-inspector-scroll">
                            {compareLoading ? (
                              <div className="dk-inspector-loading">
                                <Loader2 size={18} className="animate-spin" /> Fetching…
                              </div>
                            ) : compareResults.length > 0 ? (
                              highlightYaml(formatYaml({ lexemes: compareResults }))
                            ) : (
                              <span className="dk-muted-text">No results in {langName(compareLang)}.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Decoder matches table */}
                  {debugMode && decoderMatches.length > 0 && (
                    <div className="dk-section-block">
                      <div className="dk-section-row">
                        <Bug size={14} className="dk-title-icon-amber" /> Decoder Matches — Lexeme {selectedEntryIdx + 1}
                      </div>
                      <div className="dk-panel dk-table-wrap">
                        <table className="dk-table">
                          <thead>
                            <tr className="dk-table-head-row">
                              {['Decoder', 'Template', 'Raw', 'Fields Produced'].map((h) => <th key={h} className="dk-table-head-cell">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {decoderMatches.map((m, i) => (
                              <tr key={i} className="dk-table-row"
                                onClick={() => m.raw && setHighlightedTemplate(m.raw.slice(0, 40))}>
                                <td className="dk-table-cell dk-c-amber dk-font-mono">{m.decoderId}</td>
                                <td className="dk-table-cell dk-c-blue dk-font-mono">{m.templateName ? `{{${m.templateName}}}` : '–'}</td>
                                <td className="dk-table-cell dk-table-raw dk-font-mono">{m.raw}</td>
                                <td className="dk-table-cell">
                                  {m.fieldsProduced.map((f: string) => (
                                    <span key={f} className="decoder-field-chip">{f}</span>
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
                    <div className="dk-section-block">
                      <div className="dk-section-row">
                        <ImageIcon size={14} className="dk-title-icon-green" /> Wikidata Media
                      </div>
                      <div className="dk-media-grid">
                        {results.map((r, i) => r.wikidata?.media?.thumbnail ? (
                          <div key={i} className="dk-panel dk-media-card">
                            <img className="wikidata-card-img" src={r.wikidata.media.thumbnail} alt={r.form} />
                            <div className="dk-media-meta">
                              <p className="dk-media-title">{r.form}</p>
                              <p className="dk-media-file">{r.wikidata.media.P18}</p>
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

      <p className="app-body-paragraph">Wiktionary SDK extracts lexicographic data directly from source templates and keeps every field traceable. The same core engine powers the package API, CLI, and web playground so outputs remain consistent across interfaces. Use targeted wrappers for quick lookups, or inspect full lexeme structures when you need complete context. The design favors explicit data and deterministic behavior over linguistic guesswork.
      </p>

      <p className="app-body-paragraph">Wiktionary SDK is a specialized tool for the **deterministic and source-faithful extraction** of lexicographic data from Wiktionary, with a primary focus on **Greek entries** and initial support for **Dutch (NL)** and **German (DE)**.</p>
      <p className="app-body-paragraph">The project is designed as a **multi-client ecosystem**, separating the core extraction engine from its various interfaces (Web, CLI, API server, and NPM package).</p>

      {/* ── Footer ────────────────────────────────── */}
      <footer className="app-footer">
        Copyright © 2026 <a href="https://wso.art">Dr Wouter Soudan</a>. All rights reserved.
      </footer>
    </div>
  );
};

export default App;
