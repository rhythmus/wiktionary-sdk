# 📖 Wiktionary SDK

> Get structured lexicographic data from Wiktionary, Wikidata, Wikipedia and Wikimedia

Wiktionary SDK is a specialized tool for the **deterministic and source-faithful extraction** of lexicographic data from Wiktionary, with a primary focus on **Greek entries** and initial support for **Dutch (NL)** and **German (DE)**.

The project is designed as a **multi-client ecosystem**, separating the core extraction engine from its various interfaces (Web, CLI, API server, and NPM package).

## 🚀 Quick Start: Programmatic vs. CLI

The SDK features a strict separation between programmatic usage inside Node.js applications and powerful data-piping capabilities via the terminal.

### 1. Programmatic Initialization (Node.js/TypeScript)
You can invoke the primary engine to receive the complete, normalized YAML/JSON Abstract Syntax Tree (AST):

```typescript
import { wiktionary } from "wiktionary-sdk";

// Fetch full normalized AST (New: lang and pos are optional, default to "Auto")
const result = await wiktionary({ query: "bank" }); 
// Auto-discovers English, Danish, Dutch, etc. and sorts by priority (el > grc > en).
console.log(result.entries.map(e => `${e.language}: ${e.part_of_speech_heading}`));
```

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

Beyond the low-level `wiktionary` engine, the library provides high-level convenience wrappers to extract exact data points easily. These are organized by their linguistic and structural semantics.

#### 1. Identity & Part of Speech
Resolve lemmas and identify structural categories.

```typescript
import { lemma, partOfSpeech, richEntry, wiktionary } from "wiktionary-sdk";

// Resolve inflected forms (Now works in "Auto" mode by default!)
await lemma("έγραψε"); // "γράφω" (Greek)
await lemma("banks");  // "bank" (English)
await lemma("bank");   // "bank" (Found as English LEXEME first)

// Get structural data
await partOfSpeech("έγραψε", "el"); // "verb"

// Get the full rich entry object
const entry = await richEntry("γράφω"); 
```

#### 2. Pronunciation
Extract phonetic transcriptions, rhymes, and audio resources.

```typescript
import { ipa, pronounce, rhymes, homophones, audioDetails } from "wiktionary-sdk";

await ipa("έγραψε"); // "/ˈɣra.pse/"
await pronounce("έγραψε"); // Resolved Wikimedia Commons audio URL

// High-fidelity audio with dialect labels
await audioDetails("γράφω"); 
// [{ url: "...", label: "Audio (Greece)", filename: "El-γράφω.ogg" }]

await rhymes("γράφω");     // ["-afo"]
await homophones("γράφω"); // ["γράφω (variant)"]
```

#### 3. Morphology (Stems & Inflection)
Extract native stems and perform dynamic inflection (declension/conjugation).

```typescript
import { stem, morphology, conjugate, decline, gender, transitivity, inflectionTableRef } from "wiktionary-sdk";

// Extract inherent grammar from any inflected form!
await morphology("έγραψες");
/* { person: "2", number: "singular", tense: "past", ... } */

// Conjugate verbs dynamically (Uses DOM parsing on MediaWiki API)
await conjugate("έγραψες", { number: "plural" }); 
// ["γράψατε"] (Inherits past perfective indicative active from "έγραψες")

// Decline nominals (Nouns and Adjectives)
await decline("άνθρωπος", { case: "genitive", number: "plural" });
// ["ανθρώπων"]

// Native word stems mapped from declarative templates
await stem("έγραψα");
/* { verb: { present: ["γράφ"], ... }, aliases: ["γράφ", "γράψ", ...] } */

await gender("μήλο");         // "neuter"
await transitivity("γράφω");  // "both"
await inflectionTableRef("γράφω"); // { template_name: "el-conj-γράφω", ... }
```

#### 4. Hyphenation
Retrieve syllable structures and counts.

```typescript
import { hyphenate, syllableCount } from "wiktionary-sdk";

await hyphenate("έγραψε"); // ["έ", "γρα", "ψε"]
await syllableCount("έγραψε"); // 3
```

#### 5. Etymology
Trace the linguistic lineage and cognates of a term.

```typescript
import { etymology, etymologyChain, etymologyCognates, etymologyText } from "wiktionary-sdk";

// Structured etymology chain (Ancestors)
await etymologyChain("έγραψε", "el");
/* [{ lang: "grc", term: "γράφω" }, ...] */

await etymologyCognates("έγραψε"); // List of cognate terms
await etymologyText("γράφω");     // Raw etymology prose text
```

#### 6. Senses, Examples & Usage
Extract prosecutorial definitions and usage metadata.

```typescript
import { exampleDetails, usageNotes } from "wiktionary-sdk";

// High-fidelity examples (Prose + Translations + Citations)
await exampleDetails("γράφω"); 
/* [{ text: "...", translation: "...", author: "...", ... }] */

await usageNotes("μήλο"); // ["Used with the accusative...", ...]
```

#### 7. Semantic Relations
Navigate synonyms, antonyms, and ontological hierarchies.

```typescript
import { synonyms, antonyms, hypernyms, hyponyms } from "wiktionary-sdk";

await synonyms("έγραψε"); // ["σημειώνω", "καταγράφω"]
await antonyms("έγραψε"); // ["σβήνω"]
await hypernyms("μήλο");  // ["φρούτο"]
await hyponyms("φρούτο"); // ["μήλο", "μπανάνα"]
```

#### 8. Derived, Related & Descendants
Explore connected terms across history and usage.

```typescript
import { derivedTerms, relatedTerms, descendants } from "wiktionary-sdk";

await derivedTerms("έγραψε"); // [{ term: "συγγραφέας", ... }]
await relatedTerms("έγραψε"); // [{ term: "γραπτός", ... }]
await descendants("γράφω");   // [{ term: "...", ... }]
```

#### 9. See also & Anagrams
Quick links and character permutations.

```typescript
import { seeAlso, anagrams } from "wiktionary-sdk";

await seeAlso("ζωγραφίζω"); // ["γράφω"]
await anagrams("αγράφω");    // ["γράφω"]
```

#### 10. Translations
Query 1-to-1 translations natively (gloss mode) or fetch full native prose definitions (senses mode).

```typescript
import { translate } from "wiktionary-sdk";

await translate("έγραψε", "el", "nl"); // ["schrijven"]
await translate("έγραψε", "el", "fr", { mode: "senses" }); // ["écrire"]
```

#### 11. Connectivity & Media
Aggregate all media resources and link metadata.

```typescript
import { allImages, image, externalLinks, internalLinks } from "wiktionary-sdk";

// Aggregate gallery (Wiktionary + Wikidata images)
await allImages("γράφω"); 

await image("μήλο");          // Primary thumbnail resolved from Wikidata
await externalLinks("γράφω");  // External URLs (references, external sites)
await internalLinks("γράφω");  // Wiktionary term links within the article
```

#### 12. Wikidata Enrichment
Access the global entity knowledge graph.

```typescript
import { wikidataQid, isInstance, wikipediaLink } from "wiktionary-sdk";

await wikidataQid("μήλο", "el"); // "Q89" (Apple)
await isInstance("Σωκράτης", "Q5"); // true (Person check)
await wikipediaLink("μήλο", "el", "en"); // En-wiki URL
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
> To support fully inflected paradigm generation (`conjugate()` and `decline()`), the library makes a strict temporary exception to its core _"No HTML Scraping"_ rule. Because Wiktionary uses dynamic Lua module architectures for inflection rendering that are entirely inaccessible via JSON text dumps, we call the MediaWiki `expandtemplates` API to execute Wiktionary's Lua scripts server-side, and then deploy highly localized DOM-parsing against the resulting payload to extract exact grammatical criteria. Conversely, the `stem()` function relies purely on mathematical indexing across parameterized source tags, preserving our explicit 100% data-faithfulness baseline.
>
> For a detailed technical breakdown of this mechanism and the Scribunto Lua runtime, see the [Wiktionary Morphological Engine document](file:///Users/woutersoudan/Desktop/wiktionary-fetch/docs/wiktionary_morphology_engine.md).

### 🎭 Smart Presentation Layer

- **Polymorphic `format()` utility** — transforms any structured SDK result (Morphology, Stems, Etymology, Senses) into human-readable Text, Markdown, or HTML.
- **Extensible Style Registry** — Developers can register custom formatting styles (e.g., LaTeX, YAML) by implementing the `FormatterStyle` interface and calling `registerStyle()`.
- **Context-aware serialization** — automatic handling of list styles, ordinal suffixes, and philological separators (e.g., `‧` for syllables).
- **Extensible Templates** — support for Markdown and HTML styling to ensure consistent presentation across playgrounds, CLIs, and web applications.

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
  - **Color-Coded Interactive Mode**: Automatically uses ANSI styles (`--format ansi`) for convenience extractions when running in a TTY terminal.
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

## 📊 Data Model

The project distinguishes between two primary entry types:

1.  **LEXEME**: Represents a dictionary lemma (e.g., *γράφω*). Includes POS, morphology stems, translations, senses, semantic relations, etymology, pronunciation, and usage notes.
2.  **INFLECTED_FORM**: Represents a specific form (e.g., *έγραψε*). Links back to a lemma via `form_of` and includes inflectional tags.

The output conforms to a formal JSON Schema (`schema/normalized-entry.schema.json`) versioned per the policy in `VERSIONING.md`. The current schema version is `2.1.0`.

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
