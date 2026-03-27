import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Globe, ChevronRight, Image as ImageIcon, Loader2, AlertCircle, Github, Languages, Bug, Columns2, X, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import yaml from 'js-yaml';
import { wiktionary, lemma, ipa, pronounce, hyphenate, synonyms, antonyms, etymology, stem, morphology, conjugate, decline, hypernyms, hyponyms, derivedTerms, relatedTerms, wikidataQid, wikipediaLink, image, partOfSpeech, usageNotes, translate } from '@engine/index';
import type { Entry, WikiLang } from '@engine/types';

const API_METHODS: Record<string, any> = { lemma, ipa, pronounce, hyphenate, synonyms, antonyms, etymology, stem, morphology, conjugate, decline, hypernyms, hyponyms, derivedTerms, relatedTerms, wikidataQid, wikipediaLink, image, partOfSpeech, usageNotes, translate };

const LANGUAGES = [
  { value: 'el', label: 'Greek', flag: '\u{1F1EC}\u{1F1F7}' },
  { value: 'grc', label: 'Ancient Greek', flag: '\u{1F3DB}\u{FE0F}' },
  { value: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { value: 'nl', label: 'Dutch', flag: '\u{1F1F3}\u{1F1F1}' },
  { value: 'de', label: 'German', flag: '\u{1F1E9}\u{1F1EA}' },
  { value: 'fr', label: 'French', flag: '\u{1F1EB}\u{1F1F7}' },
];

const POS_OPTIONS = [
  { value: '', label: 'Auto' },
  { value: 'verb', label: 'Verb' },
  { value: 'noun', label: 'Noun' },
  { value: 'adjective', label: 'Adjective' },
  { value: 'pronoun', label: 'Pronoun' },
  { value: 'numeral', label: 'Numeral' },
  { value: 'adverb', label: 'Adverb' },
];

interface DecoderMatch {
  decoderId: string;
  templateName: string;
  raw: string;
  fieldsProduced: string[];
}

function extractDecoderMatches(entry: Entry): DecoderMatch[] {
  const matches: DecoderMatch[] = [];
  const templates = entry.templates || {};

  for (const [tplName, tplInstances] of Object.entries(templates)) {
    const fieldsProduced: string[] = [];

    if (tplName === 'IPA' || tplName === 'el-IPA') fieldsProduced.push('pronunciation.IPA');
    if (tplName === 'audio') fieldsProduced.push('pronunciation.audio');
    if (tplName === 'hyphenation') fieldsProduced.push('hyphenation');
    if (tplName.startsWith('el-')) fieldsProduced.push('part_of_speech');
    if (['inflection of', 'infl of', 'form of', 'alternative form of'].includes(tplName))
      fieldsProduced.push('type', 'form_of');
    if (['syn', 'ant', 'hyper', 'hypo'].includes(tplName))
      fieldsProduced.push('semantic_relations');
    if (['inh', 'der', 'bor', 'cog'].includes(tplName))
      fieldsProduced.push('etymology');
    if (['t', 't+', 'tt', 'tt+', 't-simple'].includes(tplName))
      fieldsProduced.push('translations');

    for (const inst of tplInstances) {
      matches.push({
        decoderId: tplName,
        templateName: tplName,
        raw: inst.raw,
        fieldsProduced: fieldsProduced.length > 0 ? fieldsProduced : ['templates'],
      });
    }
  }

  return matches;
}

const App: React.FC = () => {
  const [query, setQuery] = useState('\u03b3\u03c1\u03ac\u03c6\u03c9');
  const [lang, setLang] = useState<WikiLang>('el');
  const [prefPos, setPrefPos] = useState('');
  const [enrich, setEnrich] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Entry[]>([]);
  const [rawBlock, setRawBlock] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [highlightedTemplate, setHighlightedTemplate] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [selectedEntryIdx, setSelectedEntryIdx] = useState(0);
  const [debugEvents, setDebugEvents] = useState<any[][]>([]);

  const [compareMode, setCompareMode] = useState(false);
  const [compareLang, setCompareLang] = useState<WikiLang>('grc');
  const [compareResults, setCompareResults] = useState<Entry[]>([]);
  const [compareRawBlock, setCompareRawBlock] = useState('');
  const [compareLoading, setCompareLoading] = useState(false);

  const [apiMethod, setApiMethod] = useState<string>('stem');
  const [apiProps, setApiProps] = useState<string>('');
  const [apiResult, setApiResult] = useState<any>({ __uninitialized: true });
  const [apiLoading, setApiLoading] = useState(false);

  const handleApiExecute = useCallback(async () => {
    setApiLoading(true);
    try {
      let propsObj = undefined;
      if (apiProps.trim()) {
        try {
            propsObj = JSON.parse(apiProps);
        } catch (err) {
            setApiResult({ error: "Invalid JSON format for Props" });
            setApiLoading(false);
            return;
        }
      }
      
      const fn = API_METHODS[apiMethod];
      let res;
      if (["conjugate", "decline"].includes(apiMethod)) res = await fn(query, propsObj || {}, lang);
      else if (["translate", "wikipediaLink"].includes(apiMethod)) res = await fn(query, lang, propsObj?.target, propsObj);
      else if (["hyphenate"].includes(apiMethod)) res = await fn(query, lang, propsObj);
      else res = await fn(query, lang);
      setApiResult(res);
    } catch (e: any) {
      setApiResult({ error: e.message });
    }
    setApiLoading(false);
  }, [apiMethod, apiProps, query, lang]);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSelectedEntryIdx(0);
    try {
      const res = await wiktionary({
        query: query.trim(),
        lang,
        preferredPos: prefPos || undefined,
        enrich,
        debugDecoders: debugMode
      });
      setResults(res.entries);
      setRawBlock(res.rawLanguageBlock);
      setDebugEvents(res.debug ?? []);
      if (res.notes.length > 0 && res.entries.length === 0) {
        setError(res.notes[0]);
      }

      if (compareMode) {
        setCompareLoading(true);
        try {
          const cRes = await wiktionary({
            query: query.trim(),
            lang: compareLang,
            preferredPos: prefPos || undefined,
            enrich: false
          });
          setCompareResults(cRes.entries);
          setCompareRawBlock(cRes.rawLanguageBlock);
        } catch {
          setCompareResults([]);
          setCompareRawBlock('');
        } finally {
          setCompareLoading(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during fetch');
    } finally {
      setLoading(false);
    }
  }, [query, lang, prefPos, enrich, compareMode, compareLang]);

  useEffect(() => {
    handleSearch();
  }, []);

  useEffect(() => {
    // Re-run API execution if query changes successfully and API explorer result exists
    if (results.length > 0 && query.trim()) {
        handleApiExecute();
    }
  }, [results]);

  const formatYaml = (data: any) => {
    try {
      return yaml.dump(data, { indent: 2, lineWidth: -1, noRefs: true, sortKeys: false });
    } catch {
      return JSON.stringify(data, null, 2);
    }
  };

  const decoderMatches = useMemo(() => {
    if (!debugMode || results.length === 0) return [];
    const events = debugEvents[selectedEntryIdx] ?? debugEvents[0];
    if (events && events.length > 0) {
      const out: DecoderMatch[] = [];
      for (const e of events) {
        const tpls = e.matchedTemplates ?? [];
        if (tpls.length === 0) {
          out.push({ decoderId: e.decoderId, templateName: e.decoderId, raw: '', fieldsProduced: e.fieldsProduced ?? [] });
        } else {
          for (const t of tpls) {
            out.push({ decoderId: e.decoderId, templateName: t.name, raw: t.raw, fieldsProduced: e.fieldsProduced ?? [] });
          }
        }
      }
      return out;
    }
    const entry = results[selectedEntryIdx] || results[0];
    return extractDecoderMatches(entry);
  }, [debugMode, results, selectedEntryIdx, debugEvents]);

  const renderWikitext = (text: string) => {
    if (!text) return <span className="text-text-muted">No wikitext loaded.</span>;

    return text.split('\n').map((line, i) => {
      const isHighlighted = highlightedTemplate && line.includes(highlightedTemplate);
      return (
        <div
          key={i}
          className={`whitespace-pre-wrap transition-colors ${
            isHighlighted ? 'bg-amber-500/20 border-l-2 border-amber-400 pl-2 -ml-2' : ''
          }`}
        >
          {line}
        </div>
      );
    });
  };

  const highlightYaml = (text: string) => {
    return text.split('\n').map((line, i) => {
      const keyMatch = line.match(/^(\s*)([^:]+):/);

      const handleClick = () => {
        const rawMatch = line.match(/raw:\s*'([^']+)'/);
        if (rawMatch) {
          const templateRaw = rawMatch[1].slice(0, 40);
          setHighlightedTemplate(templateRaw);
          return;
        }
        const templateKeyMatch = line.match(/^\s{4}(\S+):$/);
        if (templateKeyMatch) {
          setHighlightedTemplate(`{{${templateKeyMatch[1]}`);
          return;
        }
      };

      if (keyMatch) {
        const indent = keyMatch[1];
        const key = keyMatch[2];
        const rest = line.slice(keyMatch[0].length);
        return (
          <div
            key={i}
            className="whitespace-pre cursor-pointer hover:bg-white/5 transition-colors"
            onClick={handleClick}
          >
            {indent}<span className="yaml-key">{key}</span>:{highlightValue(rest)}
          </div>
        );
      }
      return (
        <div key={i} className="whitespace-pre cursor-pointer hover:bg-white/5 transition-colors" onClick={handleClick}>
          {line}
        </div>
      );
    });
  };

  const highlightValue = (val: string) => {
    if (val.trim() === '') return val;
    if (val.trim().match(/^"(.*)"$/)) return <span className="yaml-string">{val}</span>;
    if (val.trim().match(/^'(.*)'$/)) return <span className="yaml-string">{val}</span>;
    if (val.trim().match(/^(true|false|null)$/)) return <span className="yaml-bool">{val}</span>;
    if (val.trim().match(/^-?\d+(\.\d+)?$/)) return <span className="yaml-number">{val}</span>;
    return <span className="yaml-string">{val}</span>;
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-1">
            Wiktionary SDK
          </h1>
          <p className="text-text-secondary text-sm">Deterministic Greek Lexicographic Extraction</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setDebugMode(!debugMode);
              if (query.trim()) setTimeout(() => handleSearch(), 0);
            }}
            className={`p-2 rounded-full transition-colors ${debugMode ? 'bg-amber-500/20 text-amber-400' : 'glass hover:bg-white/10'}`}
            title="Toggle Debugger Mode"
          >
            <Bug size={20} />
          </button>
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              if (!compareMode && results.length > 0) {
                handleSearch();
              }
            }}
            className={`p-2 rounded-full transition-colors ${compareMode ? 'bg-emerald-500/20 text-emerald-400' : 'glass hover:bg-white/10'}`}
            title="Toggle Comparison View"
          >
            <Columns2 size={20} />
          </button>
          <a href="https://github.com/woutersoudan/wiktionary-fetch" className="p-2 rounded-full glass hover:bg-white/10 transition-colors">
            <Github size={20} />
          </a>
        </div>
      </header>

      <section className="glass glass-card p-6 mb-8 animate-fade-in">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter term (e.g. \u03b3\u03c1\u03ac\u03c6\u03c9, \u03ad\u03b3\u03c1\u03b1\u03c8\u03b1)..."
              className="w-full bg-bg-color/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-blue-500/50 transition-colors text-white"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as WikiLang)}
              className="bg-bg-color/50 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-blue-500/50 transition-colors text-white"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
              ))}
            </select>
            <select
              value={prefPos}
              onChange={(e) => setPrefPos(e.target.value)}
              className="bg-bg-color/50 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-blue-500/50 transition-colors text-white"
            >
              {POS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {compareMode && (
              <select
                value={compareLang}
                onChange={(e) => setCompareLang(e.target.value as WikiLang)}
                className="bg-bg-color/50 border border-emerald-500/30 rounded-xl py-3 px-4 outline-none focus:border-emerald-500/50 transition-colors text-white"
              >
                {LANGUAGES.filter(l => l.value !== lang).map((l) => (
                  <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                ))}
              </select>
            )}
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-8 py-3 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Globe size={20} />}
              {loading ? 'Fetching...' : 'Fetch'}
            </button>
          </div>
        </form>
        <div className="mt-4 flex items-center gap-4 text-xs text-text-muted">
          <label className="flex items-center gap-2 cursor-pointer hover:text-text-secondary transition-colors">
            <input type="checkbox" checked={enrich} onChange={(e) => setEnrich(e.target.checked)} className="accent-blue-500" />
            Wikidata Enrichment
          </label>
        </div>
      </section>

      {highlightedTemplate && (
        <div className="mb-4 flex items-center gap-2 text-xs text-amber-400">
          <span>Highlighting: <code className="bg-amber-500/10 px-2 py-0.5 rounded">{highlightedTemplate}</code></span>
          <button onClick={() => setHighlightedTemplate(null)} className="p-1 rounded hover:bg-white/10"><X size={14} /></button>
        </div>
      )}

      <main className={`grid gap-8 ${compareMode ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="lg:col-span-full p-4 bg-error/10 border border-error/20 rounded-xl text-error flex items-center gap-3"
            >
              <AlertCircle size={20} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Languages size={18} className="text-blue-400" />
              Raw Wikitext
            </h2>
          </div>
          <div className="glass glass-card p-0 overflow-hidden h-[600px] flex flex-col">
            <div className="bg-white/5 border-b border-white/10 py-2 px-4 text-xs text-text-muted font-mono flex items-center justify-between">
              <span>Section: {langToLanguageName(lang)}</span>
              <span>{rawBlock.length} chars</span>
            </div>
            <pre className="flex-1 p-6 overflow-auto text-sm text-text-secondary leading-relaxed">
              {renderWikitext(rawBlock)}
            </pre>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ChevronRight size={18} className="text-indigo-400" />
              Normalized YAML
            </h2>
            {results.length > 1 && (
              <select
                value={selectedEntryIdx}
                onChange={(e) => setSelectedEntryIdx(Number(e.target.value))}
                className="text-xs bg-bg-color/50 border border-white/10 rounded-lg py-1 px-2 text-white"
              >
                {results.map((r, i) => (
                  <option key={i} value={i}>Entry {i + 1}: {r.type} ({r.part_of_speech || r.part_of_speech_heading})</option>
                ))}
              </select>
            )}
          </div>
          <div className="glass glass-card p-0 overflow-hidden h-[600px] flex flex-col">
            <div className="bg-white/5 border-b border-white/10 py-2 px-4 text-xs text-text-muted font-mono flex items-center justify-between">
              <span>Entries: {results.length}</span>
              <span>Schema v1.0.0 {debugMode && '| Debug ON'}</span>
            </div>
            <div className="flex-1 p-6 overflow-auto text-sm font-mono leading-relaxed">
              {loading ? (
                <div className="h-full flex items-center justify-center text-text-muted gap-2">
                  <Loader2 className="animate-spin" size={24} />
                  <span>Processing templates...</span>
                </div>
              ) : results.length > 0 ? (
                highlightYaml(formatYaml({ entries: results }))
              ) : (
                <span className="text-text-muted">No results to display.</span>
              )}
            </div>
          </div>
        </div>

        {compareMode && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Columns2 size={18} className="text-emerald-400" />
                Compare: {langToLanguageName(compareLang)}
              </h2>
            </div>
            <div className="glass glass-card p-0 overflow-hidden h-[600px] flex flex-col border border-emerald-500/20">
              <div className="bg-emerald-500/5 border-b border-emerald-500/10 py-2 px-4 text-xs text-text-muted font-mono flex items-center justify-between">
                <span>Entries: {compareResults.length}</span>
                <span>{compareRawBlock.length} chars</span>
              </div>
              <div className="flex-1 p-6 overflow-auto text-sm font-mono leading-relaxed">
                {compareLoading ? (
                  <div className="h-full flex items-center justify-center text-text-muted gap-2">
                    <Loader2 className="animate-spin" size={24} />
                    <span>Fetching comparison...</span>
                  </div>
                ) : compareResults.length > 0 ? (
                  highlightYaml(formatYaml({ entries: compareResults }))
                ) : (
                  <span className="text-text-muted">No comparison results. The term may not exist in {langToLanguageName(compareLang)}.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {debugMode && decoderMatches.length > 0 && (
          <section className="lg:col-span-full">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bug size={18} className="text-amber-400" />
              Decoder Matches (Entry {selectedEntryIdx + 1})
            </h2>
            <div className="glass glass-card p-4 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-white/10 text-text-muted">
                    <th className="py-2 px-3">Decoder</th>
                    <th className="py-2 px-3">Template</th>
                    <th className="py-2 px-3">Raw</th>
                    <th className="py-2 px-3">Fields Produced</th>
                  </tr>
                </thead>
                <tbody>
                  {decoderMatches.map((m, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => m.raw && setHighlightedTemplate(m.raw.slice(0, 40))}
                    >
                      <td className="py-2 px-3 font-mono text-amber-400">{m.decoderId}</td>
                      <td className="py-2 px-3 font-mono text-blue-400">{m.templateName ? `{{${m.templateName}}}` : '-'}</td>
                      <td className="py-2 px-3 font-mono text-xs text-text-secondary max-w-xs truncate">{m.raw}</td>
                      <td className="py-2 px-3">
                        {m.fieldsProduced.map((f) => (
                          <span key={f} className="inline-block bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded mr-1 mb-1">{f}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {results.some(r => r.wikidata?.media?.thumbnail) && (
          <section className="lg:col-span-full">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ImageIcon size={18} className="text-emerald-400" />
              Wikidata Media
            </h2>
            <div className="flex flex-wrap gap-6">
              {results.map((r, i) => r.wikidata?.media?.thumbnail ? (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass glass-card p-2 w-full sm:w-64"
                >
                  <img src={r.wikidata.media.thumbnail} alt={r.form} className="w-full h-48 object-cover rounded-lg mb-2" />
                  <div className="p-2">
                    <p className="text-sm font-medium mb-1">{r.form}</p>
                    <p className="text-xs text-text-muted truncate">{r.wikidata.media.P18}</p>
                  </div>
                </motion.div>
              ) : null)}
            </div>
          </section>
        )}

        <section className="lg:col-span-full mt-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Terminal size={18} className="text-fuchsia-400" />
                Live API Playground
            </h2>
            <div className="glass glass-card p-4 sm:p-6 flex flex-col items-start gap-4 border border-fuchsia-500/20">
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                    <div className="flex-1 flex flex-col gap-2">
                        <label className="text-xs text-text-muted">Target Wrapper</label>
                        <select
                            value={apiMethod}
                            onChange={(e) => setApiMethod(e.target.value)}
                            className="w-full bg-bg-color/50 border border-fuchsia-500/30 rounded-xl py-2 px-3 outline-none focus:border-fuchsia-500/80 transition-colors text-white text-sm"
                        >
                            {Object.keys(API_METHODS).sort().map((m) => (
                                <option key={m} value={m}>{m}()</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-[2] flex flex-col gap-2">
                        <label className="text-xs text-text-muted">Props / Criteria (JSON Object String)</label>
                        <input
                            type="text"
                            value={apiProps}
                            onChange={(e) => setApiProps(e.target.value)}
                            placeholder='e.g. {"number": "plural"}'
                            className="font-mono text-sm w-full bg-bg-color/50 border border-white/10 rounded-xl py-2 px-3 outline-none focus:border-fuchsia-500/50 transition-colors text-white"
                        />
                    </div>
                    <div className="flex flex-col gap-2 justify-end">
                        <button
                            onClick={handleApiExecute}
                            disabled={apiLoading}
                            className="bg-fuchsia-600/20 hover:bg-fuchsia-500/40 text-fuchsia-400 border border-fuchsia-500/50 disabled:bg-fuchsia-900/10 disabled:cursor-not-allowed font-medium rounded-xl px-6 py-2 transition-all flex items-center gap-2 whitespace-nowrap"
                        >
                            {apiLoading ? <Loader2 className="animate-spin" size={16} /> : <Terminal size={16} />}
                            {apiLoading ? 'Exec' : 'Execute'}
                        </button>
                    </div>
                </div>

                <div className="w-full bg-black/40 border border-white/5 rounded-xl mt-4 max-h-[400px] overflow-auto flex flex-col">
                    <div className="bg-white/5 border-b border-white/10 py-1.5 px-3 text-xs text-text-muted font-mono flex gap-2">
                        <span className="text-fuchsia-400">sdk.{apiMethod}("{query}"{apiProps ? `, ${apiProps}` : ''})</span>
                    </div>
                    <pre className="p-4 text-sm font-mono leading-loose text-text-secondary select-text overflow-x-auto">
                        {apiResult && apiResult.__uninitialized ? (
                            <span className="text-text-muted opacity-50">// Output will render here</span>
                        ) : typeof apiResult === 'undefined' ? (
                            <span className="text-amber-500">undefined</span>
                        ) : apiResult === null ? (
                            <span className="text-amber-500">null</span>
                        ) : typeof apiResult === 'string' ? (
                            <span className="text-emerald-300">"{apiResult}"</span>
                        ) : (
                            JSON.stringify(apiResult, null, 2)
                        )}
                    </pre>
                </div>
            </div>
        </section>
      </main>

      <footer className="mt-16 pt-8 border-t border-white/5 text-center text-text-muted text-xs">
        <p>&copy; 2026 Wiktionary SDK Project. Deterministic Extraction Engine.</p>
      </footer>
    </div>
  );
};

const langToLanguageName = (lang: string) => {
  const map: Record<string, string> = { el: 'Greek', grc: 'Ancient Greek', en: 'English', nl: 'Dutch', de: 'German', fr: 'French' };
  return map[lang] || 'Greek';
};

export default App;
