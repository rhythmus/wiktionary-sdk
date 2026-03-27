# 📖 Wiktionary SDK

Wiktionary SDK is a specialized tool for the **deterministic and source-faithful extraction** of lexicographic data from Wiktionary, with a primary focus on **Greek entries**.

The project is designed as a **multi-client ecosystem**, separating the core extraction engine from its various interfaces (Web, CLI, API server, and NPM package).

## 🚀 Quick Start: Programmatic vs. CLI

The SDK features a strict separation between programmatic usage inside Node.js applications and powerful data-piping capabilities via the terminal.

### 1. Programmatic Initialization (Node.js/TypeScript)
You can invoke the primary engine to receive the complete, normalized YAML/JSON Abstract Syntax Tree (AST):

```typescript
import { wiktionary } from "wiktionary-sdk";

// Fetch full normalized AST
const result = await wiktionary({ query: "γράφω", lang: "el" });
console.log(result.entries[0].senses);
```

### 2. CLI Execution (DevOps pipelines)
You can execute exactly the same core engine natively from your shell. By default, it dumps the entire requested schema:

```bash
# Dump the AST to standard out formatted in YAML
wiktionary-sdk γράφω --lang el --format yaml
```

> **New in v1.0!** You can also evaluate our 17 convenience wrappers entirely from the CLI using the `--extract` flag:
```bash
wiktionary-sdk γράφω --extract stem --format json
wiktionary-sdk έγραψε --extract translate --target en
wiktionary-sdk έγραψες --extract conjugate --props '{"number":"plural", "tense": "past"}'
```

**Out** (normalized entries):

```yaml
schema_version: "1.0.0"
entries:
    - id: "el:γράφω#E1#verb#LEXEME"
    language: el
    query: γράφω
    type: LEXEME
    form: γράφω
    part_of_speech: verb
    senses:
      - id: S1
        gloss: to write
        subsenses:
          - id: S1.1
            gloss: to write by hand
          - id: S1.2
            gloss: to type
    semantic_relations:
      synonyms:
        - term: σημειώνω
        - term: καταγράφω
      antonyms:
        - term: σβήνω
    etymology:
      links:
        - template: inh
          source_lang: grc
          term: γράφω
          gloss: to write
```


## 🏛️ Design Philosophy

1.  🎯 **Extraction, Not Inference** — We extract *what is actually there*. By avoiding linguistic heuristics, we ensure the data is 100% faithful to the source, making it a reliable foundation for higher-level morphology engines.
2.  🧩 **Registry-Based Modularity** — Instead of a monolithic parser, a decentralized **Registry of Template Decoders** allows for rapid expansion and total traceability.
3.  🔗 **Traceability First** — Every piece of normalized data links back to its specific source template and verbatim wikitext.
4.  🔍 **Developer-Centric Verification** — A premium React dashboard with interactive template inspection and debugger mode provides instant visual confirmation of extraction quality.

## ✨ Features & Capabilities

### 🧰 Convenience API
Beyond the low-level `wiktionary` engine, the library provides high-level convenience wrappers to extract exact data points easily:

```typescript
import { lemma, synonyms, hypernyms, ipa, pronounce, hyphenate, etymology, translate, wikidataQid, wikipediaLink, image } from "wiktionary-sdk";

// 1. Resolve inflected forms directly to their dictionary lemma
await lemma("έγραψε", "el"); // "γράφω"
await lemma("γράφω", "el"); // "γράφω"

// 2. Fetch specific semantic relations directly 
await synonyms("έγραψε", "el"); // ["σημειώνω", "καταγράφω"]
await antonyms("έγραψε", "el"); // ["σβήνω"]
await hypernyms("μήλο", "el"); // ["φρούτο"]
await hyponyms("φρούτο", "el"); // ["μήλο", "μπανάνα"]
await derivedTerms("έγραψε", "el"); // ["συγγραφέας", … ]
await relatedTerms("έγραψε", "el"); // ["γραπτός"]

// 3. Get precise phonetic transcription and Wikipedia audio URIs
await ipa("έγραψε", "el"); // "ˈe.ɣrap.se" (also aliased as phonetic())
await pronounce("έγραψε", "el"); // "https://upload.wikimedia.org/wikipedia/commons/x/xx/egrapse.ogg"

// 4. Format hyphenation natively or as arrays
await hyphenate("έγραψε", "el"); // "έ-γρα-ψε"
await hyphenate("έγραψε", "el", { separator: "‧" }); // "έ‧γρα‧ψε"
await hyphenate("έγραψε", "el", { format: "array" }); // ["έ", "γρα", "ψε"]

// 6. Get structured etymology lineage (auto-resolves Wiktionary language macros!)
await etymology("έγραψε", "el");
/*
{
  1: { lang: "grc", form: "γράφω" },
...
}
*/

// 7. Access Wikidata Entity Ontology (For Nouns/Concepts)
await wikidataQid("μήλο", "el"); // "Q89" (Apple)
await image("μήλο", "el"); // "https://upload.wikimedia.org/.../apple.jpeg"
await wikipediaLink("μήλο", "el", "en"); // "https://en.wikipedia.org/wiki/Apple"

// 8. Query 1-to-1 translations natively (gloss mode)
await translate("έγραψε", "el", "nl"); 
// ["schrijven"]

// 9. Fetch full native prose definitions from foreign domains! (senses mode)
await translate("έγραψε", "el", "fr", { mode: "senses" });
// ["écrire", "dessiner"]

// 10. Extract linguistic annotations and notes
await partOfSpeech("έγραψε", "el"); // "verb"
await usageNotes("μήλο", "el"); // ["In colloquial contexts..."]

// 9. Extract inherent grammar from any inflected form!
await morphology("έγραψες");
/*
{
  person: "2",
  number: "singular",
  tense: "past",
  aspect: "perfective",
  mood: "indicative",
  voice: "active"
}
*/

// 10. Conjugate verbs dynamically (Uses DOM parsing on the MediaWiki API)
// Automatically merges overrides into the inherent grammar of the query word!
await conjugate("έγραψες", {
    number: "plural", 
}); 
// ["γράψατε"] (Inherits past perfective indicative active from "έγραψες")

// 11. Decline nominals dynamically (Nouns and Adjectives)
// Extract targeted cases and numbers dynamically via DOM parsing
await decline("άνθρωπος", {
    case: "genitive",
    number: "plural"
});
// ["ανθρώπων"]

// 12. Extract native word stems mathematically mapped inside declarative Wiktionary templates!
await stem("έγραψα");
/*
{
  "verb": {
    "present": [ "γράφ" ],
    "imperfect": [ "έγραφ" ],
    "dependent": [ "γράψ" ],
    ...
  },
  "aliases": [ "γράφ", "έγραφ", "γράψ", "γραφ", "γραφτ", "έγραψ" ]
}
*/
await stem("άνθρωπος")
/*
{
  "nominals": [ "άνθρωπ", "ανθρώπ" ],
  "aliases": [ "άνθρωπ", "ανθρώπ" ]
  "aliases": [ "άνθρωπ", "ανθρώπ" ]
}
*/
```

> [!WARNING]
> **Architectural Rationale: The `conjugate()` and `decline()` Exception**
> To support fully inflected paradigm generation (`conjugate()` and `decline()`), the library makes a strict temporary exception to its core _"No HTML Scraping"_ rule. Because Wiktionary uses dynamic Lua module architectures for inflection rendering that are entirely inaccessible via JSON text dumps, we call the MediaWiki `expandtemplates` API to execute Wiktionary's Lua scripts server-side, and then deploy highly localized DOM-parsing against the resulting payload to extract exact grammatical criteria. Conversely, the `stem()` function relies purely on mathematical indexing across parameterized source tags, preserving our explicit 100% data-faithfulness baseline.
>
> For a detailed technical breakdown of this mechanism and the Scribunto Lua runtime, see the [Wiktionary Morphological Engine document](file:///Users/woutersoudan/Desktop/wiktionary-fetch/docs/wiktionary_morphology_engine.md).

### 🧠 Extraction Engine

- **Brace-aware template extraction** that handles nested `{{...}}` blocks —
  standard regex is insufficient for Wikitext. Parameter splitting preserves
  pipes inside both `[[...]]` and `{{...}}`; only splits on `|` when both
  depths are zero.
- **Registry of Template Decoders** — a decentralized, pure-function architecture where each supported template family has its own decoder. Adding support for a new template means registering one function; no changes to the parser or orchestrator.
- **Sense-level structuring** — definition lines (`#`, `##`, `#:`) are parsed into structured `Sense` objects with unique IDs, nested subsenses, and usage examples. Wiki markup is stripped from glosses.
- **Semantic relations** — `{{syn}}`, `{{ant}}`, `{{hyper}}`, `{{hypo}}` templates are decoded into structured synonym, antonym, hypernym, and hyponym lists with optional qualifiers and sense IDs.
- **Etymology graph** — `{{inh}}`, `{{der}}`, `{{bor}}`, `{{cog}}` templates are decoded into structured etymological links capturing source language, term, gloss, and verbatim raw text.
- **Pronunciation** — `{{IPA}}`, `{{el-IPA}}`, `{{audio}}`, and `{{hyphenation}}` templates are decoded, with audio filenames mapped to Wikimedia Commons URLs.
- **Translations** — `{{t}}`, `{{t+}}`, `{{tt}}`, `{{tt+}}`, `{{t-simple}}` templates are extracted from `====Translations====` sections. Each item has `term` (required), `gloss?`, `transliteration?`, `gender?`, `alt?` from explicit params. Grouped by language.
- **Usage notes** — `===Usage notes===` section text is captured verbatim.
- **Lemma resolution** — inflected forms are automatically linked back to their lemma entry via form-of template parameters (explicit only, no guessing).
- **Wikidata enrichment** — optional QID, multilingual labels, descriptions, sitelinks, and P18 image thumbnails via the Wikidata API.

### ⚙️ Infrastructure

- 💾 **Multi-tier caching** — L1 in-memory with TTL, L2/L3 pluggable adapters (IndexedDB for browser, SQLite for Node, Redis for services). API responses are cached automatically.
- 🚦 **Rate limiting** — request throttling (default 10 req/s per Wikimedia guidelines), custom User-Agent, and optional proxy support for batch processing.
- 🔎 **Template introspection** — a crawler that discovers all Greek templates from Wiktionary categories and produces a Missing Decoder Report showing coverage gaps. Optional `--sample N` mode samples real Greek entries and reports top missing templates by frequency.
- 📐 **Formal JSON Schema** — the normalized output shape is formalized in `schema/normalized-entry.schema.json` (draft-07), with semantic versioning documented in `VERSIONING.md`.
- ✅ **72 automated tests** — parser unit tests, decoder tests, fixture-based integration tests (no network), schema validation tests, performance assertions, and cache/rate-limiter tests.
- ⚡ **Parser benchmarks** — verified sub-10ms parsing and sub-1ms section extraction on large entries.

### 🌐 Interfaces

- 🖥️ **React Webapp Dashboard** — A dynamic glassmorphism interface featuring:
  - **Live API Playground**: Programmatically execute any SDK convenience wrapper (like `conjugate` or `stem`) directly via dropdown against an active query, viewing JSON returns right in the browser!
  - **Debugger Mode**: Shows exactly which internal decoder matched which regex template structure.
  - **Cross-Language Comparison**: Side-by-side AST view for translating forms.
- 💻 **CLI Router (`wiktionary-sdk`)** — Access the engine via standard I/O:
  - Standard payload dumping (`--lang=el --format=yaml`)
  - Batch CSV/JSON processing (`--batch list.txt`)
  - Extended API Endpoint execution via explicit router flags (`--extract`, `--target`, `--props`)
- 🔌 **HTTP API Server** — Lightweight Node.js server with `GET /api/fetch` and `GET /api/health`, CORS enabled, Docker-ready.
- 📦 **NPM package** — dual ESM/CJS build for library consumers, with TypeDoc-generated API documentation.

## 🏗️ Architecture & Project Structure

```
wiktionary-sdk/
├── src/                      # Core engine (TypeScript library)
│   ├── types.ts              # Formal schema, interfaces, SCHEMA_VERSION
│   ├── registry.ts           # DecoderRegistry + all template decoders
│   ├── parser.ts             # Brace-aware wikitext & template parser
│   ├── api.ts                # MediaWiki & Wikidata API client (cached, rate-limited)
│   ├── cache.ts              # Multi-tier cache (L1 memory, L2/L3 pluggable)
│   ├── rate-limiter.ts       # Request throttling & User-Agent management
│   └── utils.ts              # Shared utilities (MD5, deep merge, etc.)
├── schema/                   # JSON Schema for normalized output
│   └── normalized-entry.schema.json
├── test/                     # Vitest test suite (69 tests)
├── cli/                      # CLI tool (single & batch lookup)
├── tools/                    # Developer tooling (template introspection)
├── webapp/                   # React/Vite frontend (inspector + debugger)
├── server.ts                 # HTTP API server wrapper
├── Dockerfile                # Container build
├── VERSIONING.md             # Output schema versioning policy
└── docs/
    ├── wiktionary-sdk-spec.md   # Formal technical specification
    └── ROADMAP.md                 # Post-v1.0 staged implementation roadmap
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### 🛠️ Building the Library
The core engine compiles to both ESM and CJS targets:
```bash
npm install
npm run build        # outputs to dist/esm/ and dist/cjs/
```

### 🖥️ Running the Web Frontend
```bash
cd webapp
npm install
npm run dev
```

### 💻 Using the CLI Pipeline
```bash
# Standard Output
npx wiktionary-sdk γράφω --lang el --format yaml

# Pipeline execution: Array mappings 
npx wiktionary-sdk έγραψε --extract synonyms --format json | jq '.[0]'

# Pipeline execution: Complex API parameters
npx wiktionary-sdk άνθρωπος --extract decline --props '{"case":"genitive", "number":"plural"}' 

# Batch input handling
npx wiktionary-sdk --batch terms.txt --output results.yaml
```

### 🔌 Running the API Server
```bash
npm run build        # compile first
npm run serve        # starts on http://localhost:3000 (runs built server)
# GET /api/fetch?query=γράφω&lang=el
# GET /api/health
```

### ✅ Running Tests
```bash
npm test             # run all 72 tests (includes fixture-based integration tests)
npm run bench        # run parser benchmarks
```

### 📚 Generating API Documentation
```bash
npm run docs         # TypeDoc output to docs/api/
```

### 🔎 Template Introspection
```bash
npm run introspect         # markdown report
npm run introspect -- --json   # JSON report
npm run introspect -- --sample 50   # sample 50 Greek entries, top missing by frequency
```

### 🐳 Docker
```bash
docker build -t wiktionary-sdk .
docker run -p 3000:3000 wiktionary-sdk
```

## 📊 Data Model

The project distinguishes between two primary entry types:

1.  **LEXEME**: Represents a dictionary lemma (e.g., *γράφω*). Includes POS, morphology stems, translations, senses, semantic relations, etymology, pronunciation, and usage notes.
2.  **INFLECTED_FORM**: Represents a specific form (e.g., *έγραψε*). Links back to a lemma via `form_of` and includes inflectional tags.

The output conforms to a formal JSON Schema (`schema/normalized-entry.schema.json`) versioned per the policy in `VERSIONING.md`. The current schema version is `1.0.0`.

## 🧩 Decoder Coverage

The registry currently supports decoders for:

| Category | Templates |
|----------|-----------|
| Headword / POS | `el-verb`, `el-noun`, `el-adj`, `el-adv`, `el-pron`, `el-numeral`, `el-part`, `el-art` |
| Pronunciation | `IPA`, `el-IPA`, `audio`, `hyphenation` |
| Form-of | `inflection of`, `infl of`, `form of`, `alternative form of`, `alt form`, `misspelling of`, `abbreviation of`, `short for`, `clipping of`, `diminutive of`, `augmentative of` |
| Translations | `t`, `t+`, `tt`, `tt+`, `t-simple` |
| Semantic relations | `syn`, `ant`, `hyper`, `hypo` |
| Etymology | `inh`, `der`, `bor`, `cog` (+ long-form aliases) |
| Senses | `#` / `##` / `#:` definition line parsing |
| Usage notes | `===Usage notes===` section extraction |
| Section links | `l`, `link` in `====Derived terms====`, `====Related terms====`, `====Descendants====` |

Use `npm run introspect` to discover templates in the wild that do not yet have decoders. Use `--sample N` to prioritize by observed frequency in real Greek entries.

## 📋 Output Schema Versioning

See [VERSIONING.md](VERSIONING.md) for the full policy. In short: MAJOR bumps for breaking changes, MINOR for additive fields, PATCH for documentation-only fixes.

## 🧭 Roadmap (post-v1.0)

`docs/ROADMAP.md` is the living post‑v1.0 plan. **Completed:**

- **Parser correctness**: brace-aware parameter splitting (pipes inside `{{...}}` preserved).
- **Translation shape**: `term` (required), `gloss?`, `transliteration?`, `gender?`, `alt?` from explicit params.
- **Unknown language**: `lang=it` returns early with a note; no silent fallback to Greek.
- **Schema versioning**: `FetchResult` always includes `schema_version`.
- **Packaging**: CLI and server run from built JS; cache key normalization for redirects.
- **Decoder debug mode**: `debugDecoders: true` returns per-entry decoder match info; webapp shows Decoder column.
- **Template location metadata**: `templates_all` preserves document order and optional `start`/`end`/`line`.
- **Cycle protection**: lemma resolution tracks visited `(lang, lemma)`; `lemma_triggered_by_entry_id` on resolved entries.
- **Declared decoder coverage**: `handlesTemplates` on decoders; introspection uses declared coverage.
- **Sense gloss_raw**: exact text before stripping for forensic verification.
- **Section links**: `derived_terms`, `related_terms`, `descendants` from `{{l}}`/`{{link}}`.
- **Sample mode**: `--sample N` on template-introspect reports top missing templates by frequency.
