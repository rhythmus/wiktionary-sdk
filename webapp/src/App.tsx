import React, { useState, useEffect } from 'react';
import { Search, Globe, ChevronRight, Image as ImageIcon, Loader2, AlertCircle, Github, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import yaml from 'js-yaml';
import { fetchWiktionary } from '@engine/index';
import type { Entry, WikiLang } from '@engine/types';


const LANGUAGES = [
  { value: 'el', label: 'Greek', flag: '🇬🇷' },
  { value: 'grc', label: 'Ancient Greek', flag: '🏛️' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'nl', label: 'Dutch', flag: '🇳🇱' },
  { value: 'de', label: 'German', flag: '🇩🇪' },
  { value: 'fr', label: 'French', flag: '🇫🇷' },
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

const App: React.FC = () => {
  const [query, setQuery] = useState('γράφω');
  const [lang, setLang] = useState<WikiLang>('el');
  const [prefPos, setPrefPos] = useState('');
  const [enrich, setEnrich] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Entry[]>([]);
  const [rawBlock, setRawBlock] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetchWiktionary({
        query: query.trim(),
        lang,
        preferredPos: prefPos || undefined,
        enrich
      });
      setResults(res.entries);
      setRawBlock(res.rawLanguageBlock);
      if (res.notes.length > 0 && res.entries.length === 0) {
        setError(res.notes[0]);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during fetch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  const formatYaml = (data: any) => {
    try {
      return yaml.dump(data, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
      });
    } catch (e) {
      return JSON.stringify(data, null, 2);
    }
  };

  const highlightYaml = (text: string) => {
    return text.split('\n').map((line, i) => {
      const keyMatch = line.match(/^(\s*)([^:]+):/);
      if (keyMatch) {
        const indent = keyMatch[1];
        const key = keyMatch[2];
        const rest = line.slice(keyMatch[0].length);
        return (
          <div key={i} className="whitespace-pre">
            {indent}<span className="yaml-key">{key}</span>:{highlightValue(rest)}
          </div>
        );
      }
      return <div key={i} className="whitespace-pre">{line}</div>;
    });
  };

  const highlightValue = (val: string) => {
    if (val.trim() === '') return val;
    if (val.trim().match(/^"(.*)"$/)) return <span className="yaml-string">{val}</span>;
    if (val.trim().match(/^(true|false|null)$/)) return <span className="yaml-bool">{val}</span>;
    if (val.trim().match(/^-?\d+(\.\d+)?$/)) return <span className="yaml-number">{val}</span>;
    return val;
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-1">
            WiktionaryFetch
          </h1>
          <p className="text-text-secondary text-sm">Deterministic Greek Lexicographic Extraction</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://github.com/woutersoudan/wiktionary-fetch" className="p-2 rounded-full glass hover:bg-white/10 transition-colors">
            <Github size={20} />
          </a>
        </div>
      </header>

      {/* Search Bar */}
      <section className="glass glass-card p-6 mb-8 animate-fade-in">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter term (e.g. γράφω, έγραψα)..."
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
            <input
              type="checkbox"
              checked={enrich}
              onChange={(e) => setEnrich(e.target.checked)}
              className="accent-blue-500"
            />
            Wikidata Enrichment
          </label>
        </div>
      </section>

      {/* Main Content */}
      <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="lg:col-span-2 p-4 bg-error/10 border border-error/20 rounded-xl text-error flex items-center gap-3"
            >
              <AlertCircle size={20} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left Pane: Wikitext */}
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
              {rawBlock || 'No wikitext loaded.'}
            </pre>
          </div>
        </div>

        {/* Right Pane: Normalized YAML */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ChevronRight size={18} className="text-indigo-400" />
              Normalized YAML
            </h2>
          </div>
          <div className="glass glass-card p-0 overflow-hidden h-[600px] flex flex-col">
            <div className="bg-white/5 border-b border-white/10 py-2 px-4 text-xs text-text-muted font-mono flex items-center justify-between">
              <span>Entries: {results.length}</span>
              <span>Validated Schema v1.0</span>
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

        {/* Media Strip */}
        {results.some(r => r.wikidata?.media?.thumbnail) && (
          <section className="lg:col-span-2">
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
                  <img
                    src={r.wikidata.media.thumbnail}
                    alt={r.form}
                    className="w-full h-48 object-cover rounded-lg mb-2"
                  />
                  <div className="p-2">
                    <p className="text-sm font-medium mb-1">{r.form}</p>
                    <p className="text-xs text-text-muted truncate">{r.wikidata.media.P18}</p>
                  </div>
                </motion.div>
              ) : null)}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 pt-8 border-t border-white/5 text-center text-text-muted text-xs">
        <p>© 2026 WiktionaryFetch Project. Deterministic Extraction Engine.</p>
      </footer>
    </div>
  );
};

const langToLanguageName = (lang: string) => {
  const map: any = { el: 'Greek', grc: 'Ancient Greek', en: 'English', nl: 'Dutch', de: 'German', fr: 'French' };
  return map[lang] || 'Greek';
};

export default App;
