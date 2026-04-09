# Wiktionary SDK

> Get structured lexicographic data from Wiktionary, Wikidata, Wikipedia, and Wikimedia

=> Online demo on https://rhythmus.github.io/wiktionary-sdk/

[![GitHub Pages deploy status](https://github.com/rhythmus/wiktionary-sdk/actions/workflows/deploy-webapp.yml/badge.svg)](https://github.com/rhythmus/wiktionary-sdk/actions/workflows/deploy-webapp.yml)
[![License](https://img.shields.io/github/license/rhythmus/wiktionary-sdk.svg)](https://github.com/rhythmus/wiktionary-sdk/blob/master/LICENSE)
![Node.js version](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![Type definitions](https://img.shields.io/npm/types/wiktionary-sdk.svg?color=brightgreen)
[![npm version](https://img.shields.io/npm/v/wiktionary-sdk.svg)](https://www.npmjs.com/package/wiktionary-sdk)
[![CI status](https://github.com/rhythmus/wiktionary-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/rhythmus/wiktionary-sdk/actions/workflows/ci.yml)

[Wiktionary](https://www.wiktionary.org/) is the world's largest open multilingual dictionary, but its underlying wiki markup is far from a rigorous database. Extracting unambiguous, strongly typed, machine-readable data from its vast template ecosystem is messy — often a real [p.i.t.a](https://rhythmus.github.io/wiktionary-sdk/?q=pain%20in%20the%20ass). Wiktionary SDK solves this with an easy-to-use interface that spares you the headache of wrestling with the official REST API's bewildering outputs.

Wiktionary SDK is a specialized tool for the **deterministic and source-faithful extraction** of lexicographic data from Wiktionary, with a primary focus on **Greek entries** and initial support for **Dutch (NL)** and **German (DE)**.

The project is designed as a **multi-client ecosystem**, separating the core extraction engine from its various interfaces (Web, CLI, API server, and NPM package).

### Version axes

| Axis | Current value | Where it lives |
|------|----------------|----------------|
| **npm package** | `1.2.0` (see `package.json` `version`) | Release tagging / consumers |
| **Output `schema_version`** | `3.3.0` | `SCHEMA_VERSION` in `src/model/schema-version.ts` (re-exported via `src/index.ts`), emitted on every `FetchResult` |
| **Formal spec revision** | v3.4 | Title line in `docs/wiktionary-sdk-spec.md` |

Bump rules for schema vs code: see `VERSIONING.md`. The spec revision and `SCHEMA_VERSION` can move at different cadences; the table above is the support checklist from `audit.md` §2.2.

### Where the domain model lives (source of truth)

Changes to **normalized output shape** must stay consistent across three layers:

| Layer | Location | What you do |
|-------|----------|-------------|
| **TypeScript** | [`src/model/`](src/model/) | Update the relevant `src/model/*.ts` slice and `SCHEMA_VERSION` when the runtime payload changes. |
| **JSON Schema (edit here)** | [`schema/src/root.yaml`](schema/src/root.yaml) + [`schema/src/defs/`](schema/src/defs/) | **Author-time YAML only** — this is the single place to edit the schema structure. |
| **JSON Schema (shipped / validated)** | [`schema/normalized-entry.schema.json`](schema/normalized-entry.schema.json) | **Generated.** Run **`npm run build:schema`** after YAML edits and **commit** this file. Do not edit it by hand. |

Which `$defs` key belongs in which YAML file is defined in [`tools/schema-def-modules.ts`](tools/schema-def-modules.ts). Full workflow, CI expectations, and adding new defs: **[`schema/README.md`](schema/README.md)**. **`npm run test:ci`** runs **`check:schema-artifact`** so the committed JSON always matches the YAML.

## 🚀 Quick Start: Programmatic vs. CLI

The SDK features a strict separation between programmatic usage inside Node.js applications and powerful data-piping capabilities via the terminal.

### 1. Programmatic Initialization (Node.js/TypeScript)
You can invoke the primary engine to receive the complete, normalized YAML/JSON Abstract Syntax Tree (AST):

```typescript
import { wiktionary } from "wiktionary-sdk";

// Fetch full normalized AST — lexemes are returned in Wikitext source order by default
const result = await wiktionary({ query: "bank" }); 
console.log(result.lexemes.map(l => `${l.language}: ${l.part_of_speech_heading}`));

// Opt-in: sort lexemes by language priority (el > grc > en) instead of source order
const sorted = await wiktionary({ query: "γράφω", sort: "priority" });
console.log(sorted.lexemes.map(l => l.language)); // ['el', 'grc', 'Italiot Greek']
```

#### `wiktionary()` Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `query` | `string` | *(required)* | The term to look up (e.g. `"γράφω"`, `"bank"`) |
| `lang` | `string` | `"Auto"` | BCP-47 language code (e.g. `"el"`, `"grc"`) or `"Auto"` to discover all languages |
| `pos` | `string` | `"Auto"` | Part-of-speech filter (e.g. `"verb"`, `"noun"`) or `"Auto"` |
| `enrich` | `boolean` | `true` | Fetch Wikidata enrichment (QID, labels, P18 image) |
| `sort` | `"source" \| "priority"` | `"source"` | Lexeme ordering strategy — see below |
| `debugDecoders` | `boolean` | `false` | Include per-lexeme decoder match diagnostics in the result |

**Lexeme ordering (`sort`)**

By default, `wiktionary()` returns lexemes in **source order** — the order in which language sections and PoS blocks appear in the Wiktionary markup. This honours the project's core principle of source-faithful extraction.

Set `sort: "priority"` to apply a hardcoded language-priority heuristic instead:

| Priority | Language |
|----------|----------|
| 1 | Modern Greek (`el`) |
| 2 | Ancient Greek (`grc`) |
| 3 | English (`en`) |
| 100 | All others (alphabetical) |

Within the same priority tier, lexemes are sorted alphabetically by language code; within the same language, by PoS heading.

> **Note:** The priority values above are provisional. A future release will make them configurable and expand coverage — see [Roadmap](docs/ROADMAP.md) (Stage 23 / Phase 8).

### 2. CLI Execution (DevOps pipelines)
You can execute exactly the same core engine natively from your shell. By default, it dumps the entire requested schema:

```bash
# Auto-discover multiple languages (New: --lang defaults to Auto)
wiktionary-sdk bank --format yaml

# Explicitly filter by PoS
wiktionary-sdk test --pos verb --format yaml
```

> **New in v1.0!** You can also evaluate our 21 convenience wrappers entirely from the CLI using the `--extract` flag:
```bash
wiktionary-sdk γράφω --extract stem --format json
wiktionary-sdk έγραψε --extract translate --target en
wiktionary-sdk έγραψες --extract conjugate --props '{"number":"plural", "tense": "past"}'
```

**Out** (normalized entries):

```yaml
schema_version: "3.3.0"
lexemes:
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
5.  🏛️ **Academic Typographic Standards** — From v2.2, the SDK uses a **Handlebars-based high-fidelity rendering engine** to achieve a "Gold Standard" for human-readable output, emulating the density and formal aesthetic of premium printed dictionaries (see `src/templates/entry.html.hbs`).

## ✨ Features & Capabilities

### 🧰 Convenience API

Beyond the low-level `wiktionary` engine, the library provides high-level convenience wrappers to extract exact data points easily. These are organized by their linguistic and structural semantics.

**All lexeme-scoped wrappers return `GroupedLexemeResults<T>`** — a concise object with:
- `order: string[]` (stable lexeme id order)
- `lexemes: Record<lexeme_id, { language, pos, etymology_index, value, support_warning? }>`

Optional **`support_warning`** is set when an empty or partial **`value`** likely reflects **SDK template coverage** (undecoded `{{…}}`, unsupported parameters, parse failures) rather than a proof that Wiktionary lacks the data. Helpers live in **`src/convenience/extraction-support.ts`**; **`format(results)`** appends a **Support:** line per row when present.

This gives direct per-lexeme access when `lang="Auto"` / `pos="Auto"` return multiple matches.

```typescript
import { asLexemeRows } from "wiktionary-sdk";

const results = await synonyms("γράφω");
// results.order -> ["grc:γράφω#E1#verb#LEXEME", "el:γράφω#E1#verb#LEXEME", ...]
// results.lexemes["el:γράφω#E1#verb#LEXEME"].value -> ["σημειώνω", ...]

// Optional row view for map/filter/find ergonomics:
const rows = asLexemeRows(results);
// rows[0] = { lexeme_id, language, pos, etymology_index, value, support_warning? }
```

**Exceptions** that stay scalar: `lemma()` (form resolution), `pageMetadata()` (page-level), and `getMainLexeme()` (single-lexeme shortcut utility).

> For readability, many examples below show row-like outputs (`[{ value: ... }]`).
> In code, obtain that view with `asLexemeRows(groupedResult)`.

#### 1. Identity & Part of Speech
Resolve lemmas and identify structural categories.

```typescript
import { lemma, partOfSpeech, richEntry, wiktionary } from "wiktionary-sdk";

// lemma() stays scalar — it resolves an inflected form to its dictionary form
await lemma("έγραψε"); // "γράφω" (Greek)
await lemma("banks");  // "bank" (English)

// GroupedLexemeResults<string | null> — one entry per lexeme id
await partOfSpeech("έγραψε", "el"); // [{ value: "verb", language: "el", ... }]

// GroupedLexemeResults<RichEntry | null> — full rich entry per lexeme
await richEntry("γράφω"); 
```

#### 2. Pronunciation
Extract phonetic transcriptions, rhymes, and audio resources.

```typescript
import { ipa, pronounce, rhymes, homophones, audioGallery } from "wiktionary-sdk";

await ipa("έγραψε");     // [{ value: "/ˈɣra.pse/", language: "el", ... }]
await pronounce("έγραψε"); // [{ value: "https://...audio.ogg", ... }]

// Per-lexeme audio gallery with dialect labels
await audioGallery("γράφω"); 
// [{ value: [{ url: "...", label: "Audio (Greece)", filename: "El-γράφω.ogg" }], ... }]

await rhymes("γράφω");     // [{ value: ["-afo"], ... }]
await homophones("γράφω"); // [{ value: [...], ... }]
```

#### 3. Morphology (Stems & Inflection)
Extract native stems and perform dynamic inflection (declension/conjugation).

```typescript
import { stem, stemByLexeme, morphology, conjugate, decline, gender, transitivity } from "wiktionary-sdk";

// GroupedLexemeResults<GrammarTraits> — grammar per lexeme
await morphology("έγραψες");
// [{ value: { person: "2", number: "singular", tense: "past", ... }, ... }]

// GroupedLexemeResults<string[] | Record | null> — conjugation per lexeme
await conjugate("έγραψες", { number: "plural" }); 
// [{ value: ["γράψατε"], ... }]

// Optional explicit non-el template prefixes (defaults remain el-* only)
await conjugate("test", {}, "Auto", { conjugationTemplatePrefixes: ["xx-conj-"] });

// Decline nominals per lexeme
await decline("άνθρωπος", { case: "genitive", number: "plural" });
// [{ value: ["ανθρώπων"], ... }]

await decline("test", {}, "Auto", { declensionTemplatePrefixes: ["xx-decl-"] });

// GroupedLexemeResults<WordStems> — structured stems per lexeme; see "Grouped results" below
await stem("έγραψα");
// grouped.lexemes[id].value.aliases -> ["γράφ", "γράψ", ...]; optional grouped.lexemes[id].support_warning

await stemByLexeme("έγραψα"); // alias of stem()

await gender("μήλο");         // [{ value: "neuter", ... }]
await transitivity("γράφω");  // [{ value: "both", ... }]
```

#### 4. Hyphenation
Retrieve syllable structures and counts.

```typescript
import { hyphenate, syllableCount } from "wiktionary-sdk";

await hyphenate("έγραψε"); // [{ value: ["έ", "γρα", "ψε"], ... }]
await syllableCount("έγραψε"); // [{ value: 3, ... }]
```

#### 5. Etymology
Trace the linguistic lineage and cognates of a term.

```typescript
import { etymology, etymologyChain, etymologyCognates, etymologyText } from "wiktionary-sdk";

// LexemeResult<any[]>[] — per-lexeme etymology chain
await etymologyChain("έγραψε", "el");
// [{ value: [{ lang: "grc", term: "γράφω" }, ...], ... }]

await etymologyCognates("έγραψε"); // [{ value: [...cognates], ... }]
await etymologyText("γράφω");     // [{ value: "From Ancient Greek...", ... }]
```

#### 6. Senses, Examples & Usage
Extract prose definitions and usage metadata.

```typescript
import { exampleDetails, usageNotes } from "wiktionary-sdk";

// LexemeResult<any[]>[] — per-lexeme examples
await exampleDetails("γράφω"); 
// [{ value: [{ text: "...", translation: "...", author: "...", ... }], ... }]

await usageNotes("μήλο"); // [{ value: ["Used with the accusative...", ...], ... }]
```

#### 7. Semantic Relations
Navigate synonyms, antonyms, and ontological hierarchies.

```typescript
import { synonyms, antonyms, hypernyms, hyponyms } from "wiktionary-sdk";

await synonyms("έγραψε"); // [{ value: ["σημειώνω", "καταγράφω"], language: "el", ... }]
await antonyms("έγραψε"); // [{ value: ["σβήνω"], ... }]
await hypernyms("μήλο");  // [{ value: ["φρούτο"], ... }]
await hyponyms("φρούτο"); // [{ value: ["μήλο", "μπανάνα"], ... }]
```

#### 8. Derived, Related & Descendants
Explore connected terms across history and usage.

```typescript
import { derivedTerms, relatedTerms, descendants } from "wiktionary-sdk";

await derivedTerms("έγραψε"); // [{ value: [{ term: "συγγραφέας", ... }], ... }]
await relatedTerms("έγραψε"); // [{ value: [{ term: "γραπτός", ... }], ... }]
await descendants("γράφω");   // [{ value: [{ term: "...", ... }], ... }]
```

#### 9. See also & Anagrams
Quick links and character permutations.

```typescript
import { seeAlso, anagrams } from "wiktionary-sdk";

await seeAlso("ζωγραφίζω"); // [{ value: ["γράφω"], ... }]
await anagrams("αγράφω");    // [{ value: ["γράφω"], ... }]
```

#### 10. Translations
Query 1-to-1 translations natively (gloss mode) or fetch full native prose definitions (senses mode).

```typescript
import { translate } from "wiktionary-sdk";

await translate("έγραψε", "el", "nl"); // [{ value: ["schrijven"], ... }]
await translate("έγραψε", "el", "fr", { mode: "senses" }); // [{ value: ["écrire"], ... }]
```

#### 11. Connectivity & Media
Aggregate all media resources and link metadata.

```typescript
import { allImages, image, externalLinks, internalLinks } from "wiktionary-sdk";

await allImages("γράφω");      // [{ value: ["https://...thumb.jpg", ...], ... }]
await image("μήλο");           // [{ value: "https://...apple.jpeg", ... }]
await externalLinks("γράφω");  // [{ value: ["https://..."], ... }]
await internalLinks("γράφω");  // [{ value: ["σημειώνω", ...], ... }]
```

#### 12. Wikidata Enrichment
Access the global entity knowledge graph.

```typescript
import { wikidataQid, isInstance, wikipediaLink } from "wiktionary-sdk";

await wikidataQid("μήλο", "el"); // [{ value: "Q89", ... }]
await isInstance("Σωκράτης", "Q5"); // [{ value: true, ... }]
await wikipediaLink("μήλο", "el", "en"); // [{ value: "https://en.wikipedia.org/wiki/Apple", ... }]
```

#### 13. Presentation Layer (Smart Formatter)
Transform any structured result from the functions above into Text, Markdown, or HTML.

```typescript
import { format, hyphenate, morphology, stem, etymology } from "wiktionary-sdk";

// Syllable formatting
const syllables = await hyphenate("έγραψε");
format(syllables, { separator: "‧" }); // "έ‧γρα‧ψε"
format(syllables, { listStyle: "numbered" }); // "1. έ \n 2. γρα \n 3. ψε"

// Grammar formatting
const morphRes = await morphology("έγραψες");
format(morphRes, { mode: "markdown" }); 
// "*2nd person, singular, past, perfective, indicative, active*"

// Stem formatting
const stemsRes = await stem("έγραψα");
format(stemsRes, { mode: "text" }); // "Stems: γράφ, έγραφ, γράψ, ..."

// Etymology formatting
const lineage = await etymology("γράφω", "el");
format(lineage, { mode: "markdown" }); // "grk-pro ***grépʰō** ← el **γράφω**"
```

> [!WARNING]
> **Architectural Rationale: The `conjugate()` and `decline()` Exception**
> To support fully inflected paradigm generation (`conjugate()` and `decline()`), the library makes a strict temporary exception to its core _"No HTML Scraping"_ rule. Because Wiktionary uses dynamic Lua module architectures for inflection rendering that are entirely inaccessible via plain JSON dumps, we call MediaWiki `action=parse` on template wikitext (with the page title as context) and then apply narrowly scoped DOM parsing to read table cells. Conversely, `stem()` relies purely on parameterized source tags and does not infer data.
>
> For a detailed technical breakdown of this mechanism and the Scribunto Lua runtime, see the [Wiktionary Morphological Engine document](file:///Users/woutersoudan/Desktop/wiktionary-fetch/docs/wiktionary_morphology_engine.md).

`morphology()` smart defaults are wrapper-level fallbacks only (for convenience when criteria are omitted). They do not change normalized extraction contracts or infer unsupported source data.

### 🎭 Smart Presentation Layer

- **Polymorphic `format()` utility** — transforms any structured SDK result (Morphology, Stems, Etymology, Senses) into human-readable Text, Markdown, or HTML.
- **Extensible Style Registry** — Developers can register custom formatting styles (e.g., LaTeX, YAML) by implementing the `FormatterStyle` interface and calling `registerStyle()`.
-    - Handlebars-based rendering system (Gold Standard v2.3.0).
    - Environment-agnostic templates (bundling logic for Web/CLI/Node).
    - ✨ **v2.4.0 (Granular Rendering)**: Introduced specialized typography for variants and etymology. Includes **Red Wavy Underlines** for misspellings, **Small-Caps** for abbreviations, and canonical academic symbols (`~`, `←`, `<`) for linguistic relations.
    - Inflected form support with morphological redirects ("έγραψε" → "γράφω").
    - Font-neutral fragment architecture for clean UI embedding.
- **Font-Agnostic Fragments** — entry output is designed as a CSS-neutral snippet that inherits the host environment's typography for seamless embedding.

### 🧠 Extraction Engine

- **Brace-aware template extraction** that handles nested `{{...}}` blocks —
  standard regex is insufficient for Wikitext. Parameter splitting preserves
  pipes inside both `[[...]]` and `{{...}}`; only splits on `|` when both
  depths are zero.
- **Pronunciation** — `{{IPA}}`, `{{el-IPA}}`, `{{audio}}`, and `{{hyphenation}}` templates are decoded. The SDK supports **audio galleries**, capturing all dialectal files (US, UK, Au) from a section into `audio_details` with regional labels.
- **Senses & Citations** — entry lines (`#`, `##`, `#:`) are parsed into structured `Sense` objects. The engine provides specialized support for **structured citations** (`{{quote-book}}`, `{{ux}}`, etc.), extracting **author, year, source, and passage** alongside the translation.
- **Translations** — `{{t}}`, `{{t+}}`, `{{tt}}`, `{{tt+}}`, `{{t-simple}}` templates are extracted from `====Translations====` sections. Each item has `term` (required), `gloss?`, `transliteration?`, `gender?`, `alt?` from explicit params. Grouped by language.
- **Wikidata Enrichment** — Deep integration with the Wikidata API to extract **Instance Of (P31)** and **Subclass Of (P279)** relationships, alongside multilingual labels, descriptions, and sitelinks.
- **Lemma resolution** — inflected forms are automatically linked back to their lemma entry via form-of template parameters (explicit only, no guessing).
- **Usage notes** — `===Usage notes===` section text is captured verbatim.

### ⚙️ Infrastructure

- 💾 **Multi-tier caching** — L1 in-memory with TTL, L2/L3 pluggable adapters (IndexedDB for browser, SQLite for Node, Redis for services). API responses are cached automatically.
- 🚦 **Rate limiting** — request throttling (default 200ms / 5 req/s, configurable), custom User-Agent, optional `maxQueue` back-pressure, and a reserved `proxyUrl` field (not wired to `fetch` — use your runtime’s HTTP proxy). HTTP 429 responses are retried automatically with exponential backoff (configurable `maxRetries429`, default 3). `mwFetchJson` accepts optional `timeoutMs` / `AbortSignal` for bounded waits.
- 🔧 **Unified configuration** — `configureSdk()` sets rate limiter, cache, retry policy, and User-Agent in a single call before any `wiktionary()` invocation. Granular `configureRateLimiter()` and `configureCache()` are also available. All configuration types (`SdkConfig`, `RateLimiterConfig`, `CacheAdapter`) are exported from the package. See [Infrastructure Configuration](#-infrastructure-configuration-for-operators) below.
- 🔎 **Template introspection** — a crawler that discovers all Greek templates from Wiktionary categories and produces a Missing Decoder Report showing coverage gaps. Optional `--sample N` mode samples real Greek entries and reports top missing templates by frequency.
- 📐 **Formal JSON Schema** — the normalized output shape is formalized in `schema/normalized-entry.schema.json` (draft-07), with semantic versioning documented in `VERSIONING.md`.
- ✅ **Expanded hardening test matrix** — parser unit tests, decoder tests, fixture-based integration tests (no network), schema validation tests, cross-interface contract tests (SDK/CLI/Webapp), fallback-enrichment matrix tests, and negative schema-hardening tests.
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
  - **Color-Coded Interactive Mode**: Automatically uses ANSI styles (`--format ansi`) for convenience extractions when running in a TTY terminal.
- 🔌 **HTTP API Server** — Lightweight Node.js server with `GET /api/fetch` and `GET /api/health`, CORS enabled, Docker-ready.
- 📦 **NPM package** — dual ESM/CJS build for library consumers, with TypeDoc-generated API documentation.

## 🏗️ Architecture & Project Structure

```
wiktionary-sdk/
├── src/                      # Core engine (TypeScript library)
│   ├── index.ts              # Public package entry (barrel)
│   ├── model/                # Domain types, SCHEMA_VERSION, decode context
│   ├── ingress/              # MediaWiki API, cache, rate limiter, server fetch
│   ├── parse/                # Brace-aware parser, lexicographic headings
│   ├── decode/               # Decoder registry + template decoders
│   ├── pipeline/             # wiktionary-core, form-of-parse-enrich
│   ├── present/              # Formatter, Handlebars templates, lexeme display groups
│   ├── convenience/          # High-level wrappers, morphology, stem
│   ├── infra/                # Shared utils, central defaults (constants)
│   └── form-of-display.ts    # Headline morph display helpers (uses convenience/morphology)
├── schema/                   # JSON Schema for normalized output
│   ├── src/                  # AUTHOR-TIME YAML (source of truth for schema shape)
│   │   ├── root.yaml         # FetchResult root (no $defs)
│   │   └── defs/*.yaml       # Modular $defs (see tools/schema-def-modules.ts)
│   ├── normalized-entry.schema.json  # GENERATED — run npm run build:schema after YAML edits
│   └── README.md             # Schema authoring workflow
├── test/                     # Vitest hardening + regression suites
├── cli/                      # CLI tool (single & batch lookup)
├── tools/                    # Developer tooling (template introspection)
├── webapp/                   # React/Vite frontend (inspector + debugger)
├── server.ts                 # HTTP API server wrapper
├── Dockerfile                # Container build
├── VERSIONING.md             # Output schema versioning policy
└── docs/
    ├── wiktionary-sdk-spec.md              # Formal technical specification
    ├── form-of-display-and-mediawiki-parse.md  # Form-of Lua vs wikitext; parse enrichment (e.g. Spanish sense)
    ├── query-result-dimensional-matrix.md      # All dimensions of wiktionary() results (languages, PoS, etymology, …)
    └── ROADMAP.md                          # Remaining work: phased engineering + product backlog
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

### Manual API smoke (optional)

Requires network access (not run in CI):

```bash
npx tsx tools/verify_v2.ts
```

### 🖥️ Running the Web Frontend
```bash
cd webapp
npm install
npm run dev
```

While Vite is running, edits to `src/present/templates/entry.html.hbs`, `entry.md.hbs`, or
`entry.css` are written into `src/present/templates/templates.ts`
automatically so the demo and hot reload stay aligned with the bundled SDK
strings. Commit `templates.ts` after template changes so CLI and package users
see the same output without the webapp.

Hero copy is also centralized: edit `shared-copy.yaml` and run:

```bash
npm run sync:copy
```

This regenerates `webapp/src/shared-copy.generated.ts` and syncs the README hero
copy so web and docs stay identical. For CI or pre-commit validation:

```bash
npm run check:sync-copy
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

The SDK includes a documentation-driven test suite to ensure that all usage examples in this README remain valid and that the API behavior is consistent. **Contributor guide:** [test/README.md](test/README.md) (mocking, golden snapshots, decoder coverage).

```bash
# Run the compliance suite
npm test test/readme_examples.test.ts

# Default offline suite (excludes parser wall-clock perf test)
npm test
npm run test:ci

# Parser performance assertions (optional; also relaxed under CI=1)
npm run test:perf

# Full unit + perf
npm run test:all

# Optional live en.wiktionary fetch (sets WIKT_TEST_LIVE)
npm run test:network

# Vitest benchmark files (separate from test:perf)
npm run bench
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

## 🔧 Infrastructure Configuration (for operators)

The SDK ships sensible defaults for rate limiting, caching, and retry behavior. For production deployments, batch processing, or environments with specific network constraints, all infrastructure knobs are configurable at startup.

### Unified setup: `configureSdk()`

Call once before any `wiktionary()` invocation. All fields are optional; only provided values override their defaults.

```typescript
import { configureSdk, wiktionary } from "wiktionary-sdk";

configureSdk({
  rateLimiter: {
    minIntervalMs: 250,    // 4 req/s (default: 200ms / 5 req/s)
    maxRetries429: 5,      // retry up to 5× on HTTP 429 (default: 3)
    userAgent: "MyBot/2.0 (https://example.com; ops@example.com)",
    maxQueue: 50,          // reject if >50 requests queued (default: unlimited)
  },
  cache: {
    defaultTtl: 60_000,   // 1 min TTL (default: 30 min)
    l1MaxEntries: 500,     // cap L1 memory entries (default: unlimited)
  },
});

const result = await wiktionary({ query: "bank", lang: "en" });
```

### Granular configuration

For fine-grained control, use the individual configure functions:

```typescript
import { configureRateLimiter, configureCache, wiktionary } from "wiktionary-sdk";

// Rate limiter only — e.g. a batch pipeline on a fast server
configureRateLimiter({
  minIntervalMs: 100,        // 10 req/s (aggressive; ensure proper User-Agent)
  maxRetries429: 0,          // disable retry — fail fast and handle in your own retry loop
  userAgent: "WiktBatchBot/1.0 (https://example.com; batch@example.com)",
});

// Cache only — e.g. plug in Redis for a shared multi-process deployment
import Redis from "ioredis";
const redis = new Redis();

configureCache({
  defaultTtl: 3_600_000,    // 1 hour
  l2: {
    async get(key)           { return redis.get(`wikt:${key}`); },
    async set(key, val, ttl) { await redis.set(`wikt:${key}`, val, "PX", ttl); },
    async delete(key)        { await redis.del(`wikt:${key}`); },
    async clear()            { /* scan + del, or use a key prefix with expiry */ },
  },
});

const result = await wiktionary({ query: "γράφω" });
```

### Configuration reference

#### `RateLimiterConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `minIntervalMs` | `number` | `200` | Minimum ms between API calls (200ms = 5 req/s) |
| `maxRetries429` | `number` | `3` | Auto-retries on HTTP 429 with exponential backoff. Set `0` to disable |
| `userAgent` | `string` | `"Wiktionary SDK/1.0 …"` | Sent as `User-Agent` header per Wikimedia etiquette |
| `maxQueue` | `number` | unlimited | Max pending requests in the throttle queue; throws if exceeded |
| `proxyUrl` | `string` | `null` | Reserved; stored but not wired to `fetch` — use your runtime's HTTP proxy |

#### Cache options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `defaultTtl` | `number` | `1_800_000` (30 min) | Default TTL for all cache tiers (ms) |
| `l1MaxEntries` | `number` | unlimited | Cap on in-memory L1 entries (FIFO eviction) |
| `l2` | `CacheAdapter` | `null` | Persistent store adapter (IndexedDB, SQLite, file) |
| `l3` | `CacheAdapter` | `null` | Shared store adapter (Redis, Memcached) |

#### `CacheAdapter` interface

Any L2/L3 backend must implement:

```typescript
interface CacheAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

### HTTP 429 retry behavior

When the Wikimedia API returns HTTP 429 (Too Many Requests), `mwFetchJson` automatically retries up to `maxRetries429` times:

1. If the response includes a `Retry-After` header (integer seconds), the SDK honors it (capped at 10s).
2. Otherwise, exponential backoff applies: 1s, 2s, 4s, … (capped at 10s per wait).
3. If all retries are exhausted, the original 429 error is thrown.

For browser deployments (where you cannot set a custom `User-Agent`), Wikimedia servers apply stricter rate limits. The default 200ms interval provides headroom; increase it further if you observe persistent 429 errors.

### Design rationale

Rate limiters and caches are **infrastructure singletons** — they should be set once at application startup, not per-call. This avoids:
- Cluttering every `wiktionary()` call site with options most users never change.
- Ambiguity when concurrent calls specify conflicting rate limits.
- Encouraging per-request reconfiguration, which defeats global throttling.

The `configureSdk()` / `configureRateLimiter()` / `configureCache()` pattern follows the same "configure-once, use-everywhere" approach as database connection pools and HTTP clients in production Node.js services.

## 📊 Data Model

The project distinguishes between two primary entry types:

1.  **LEXEME**: Represents a dictionary lemma (e.g., *γράφω*). Includes POS, morphology stems, translations, senses, semantic relations, etymology, pronunciation, and usage notes.
2.  **INFLECTED_FORM**: Represents a specific form (e.g., *έγραψε*). Links back to a lemma via `form_of` and includes inflectional tags.

**Contract:** Runtime shapes are defined under **`src/model/`** (and re-exported from the package via **`src/index.ts`**). The machine-readable JSON Schema is **authored** as modular YAML under **`schema/src/`** and **emitted** to **`schema/normalized-entry.schema.json`** via **`npm run build:schema`** (see **[Where the domain model lives](#where-the-domain-model-lives-source-of-truth)** and **`schema/README.md`**). The emitted `schema_version` matches **`SCHEMA_VERSION`** (see the [Version axes](#version-axes) table). Versioning policy: **`VERSIONING.md`**.

## 🧩 Decoder Coverage

The registry currently supports decoders for:

| Category | Templates |
|----------|-----------|
| Headword / POS | `el-verb`, `el-noun`, `el-adj`, `el-adv`, `el-pron`, `el-numeral`, `el-part`, `el-art`, **`nl-noun`**, **`nl-verb`**, **`nl-adj`**, **`de-noun`**, **`de-verb`**, **`de-adj`** |
| Pronunciation | `IPA`, `el-IPA`, `audio`, `hyphenation` |
| Form-of | `inflection of`, `infl of`, `form of`, `alternative form of`, `alt form`, `misspelling of`, `abbreviation of`, `short for`, `clipping of`, `diminutive of`, `augmentative of` |
| Translations | `t`, `t+`, `tt`, `tt+`, `t-simple` |
| Semantic relations | `syn`, `ant`, `hyper`, `hypo` |
| Etymology | `inh`, `der`, `bor`, `cog` (+ long-form aliases), **`back-formation`**, **`clipping`**, **`affix`**, **`compound`** |
| Senses | `#` / `##` / `#:` definition line parsing |
| Usage notes | `===Usage notes===` section extraction |
| Section links | `l`, `link` in `====Derived terms====`, `====Related terms====`, `====Descendants====` |

Use `npm run introspect` to discover templates in the wild that do not yet have decoders. Use `--sample N` to prioritize by observed frequency in real Greek entries.

## 📋 Output Schema Versioning

See [VERSIONING.md](VERSIONING.md) for the full policy. In short: MAJOR bumps for breaking changes, MINOR for additive fields, PATCH for documentation-only fixes.

**Authoring reminder:** The file consumers and Ajv validate against — **`schema/normalized-entry.schema.json`** — is **generated from YAML**. After editing anything under **`schema/src/`**, run:

```bash
npm run build:schema
```

and commit both the YAML and the updated JSON. CI (`npm run test:ci`) runs **`check:schema-artifact`** and will fail if you forget. Do not edit **`normalized-entry.schema.json`** by hand.

## 🧭 Roadmap (post-v1.0)

The plan lives in **[docs/ROADMAP.md](docs/ROADMAP.md)** (phases 0–10: hygiene through long-horizon items). **Delivered** roadmap stages 14–22 and the testing baseline are summarized in **`CHANGELOG.md`** (*Roadmap history — delivered engineering stages*). For narrative “what shipped” detail, see spec §13.

## 🔮 Future Work: Text-to-Dictionary (T2D)

The Wiktionary SDK is being positioned as the foundational data layer for a complete **Text-to-Dictionary (T2D)** pipeline. This future application will provide:
- **Automatic Glossary Generation**: Transform any literary text into a sorted, academic dictionary.
- **Context-Aware Sense Resolution**: Automatically highlighting the active sense of a word within its specific sentence context.
- **Morpheme Transparency**: Linking every inflected form in a text back to its exhaustive lemma profile.

For the full architectural vision, see **[TEXT_TO_DICTIONARY_PLAN.md](file:///Users/woutersoudan/git/wiktionary-sdk/docs/TEXT_TO_DICTIONARY_PLAN.md)**.
