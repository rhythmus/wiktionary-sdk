# WiktionaryFetch

WiktionaryFetch is a specialized tool for the **deterministic and source-faithful extraction** of lexicographic data from Wiktionary, with a primary focus on **Greek entries**.

The project is designed as a **multi-client ecosystem**, separating the core extraction engine from its various interfaces (Web, CLI, API server, and NPM package).

## Design Philosophy

1.  **Extraction, Not Inference**: We extract *what is actually there*. By avoiding linguistic heuristics, we ensure the data is 100% faithful to the source, making it a reliable foundation for higher-level morphology engines.
2.  **Registry-Based Modularity**: Instead of a monolithic parser, a decentralized **Registry of Template Decoders** allows for rapid expansion and total traceability.
3.  **Traceability First**: Every piece of normalized data links back to its specific source template and verbatim wikitext.
4.  **Developer-Centric Verification**: A premium React dashboard with interactive template inspection and debugger mode provides instant visual confirmation of extraction quality.

## Architecture & Project Structure

```
wiktionary-fetch/
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
├── test/                     # Vitest test suite (62 tests)
├── cli/                      # CLI tool (single & batch lookup)
├── tools/                    # Developer tooling (template introspection)
├── webapp/                   # React/Vite frontend (inspector + debugger)
├── server.ts                 # HTTP API server wrapper
├── Dockerfile                # Container build
├── VERSIONING.md             # Output schema versioning policy
└── docs/
    ├── wiktionary-fetch-spec.md   # Formal technical specification
    └── ROADMAP.md                 # Multi-phase evolution plan (all phases complete)
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Building the Library
The core engine compiles to both ESM and CJS targets:
```bash
npm install
npm run build        # outputs to dist/esm/ and dist/cjs/
```

### Running the Web Frontend
```bash
cd webapp
npm install
npm run dev
```

### Using the CLI
```bash
npm run cli -- γράφω --lang el --format yaml
npm run cli -- --batch terms.txt --output results.yaml
npm run cli -- --help
```

### Running the API Server
```bash
npm run serve        # starts on http://localhost:3000
# GET /api/fetch?query=γράφω&lang=el
# GET /api/health
```

### Running Tests
```bash
npm test             # run all 62 tests
npm run bench        # run parser benchmarks
```

### Generating API Documentation
```bash
npm run docs         # TypeDoc output to docs/api/
```

### Template Introspection
```bash
npm run introspect         # markdown report
npm run introspect -- --json   # JSON report
```

### Docker
```bash
docker build -t wiktionary-fetch .
docker run -p 3000:3000 wiktionary-fetch
```

## Data Model

The project distinguishes between two primary entry types:

1.  **LEXEME**: Represents a dictionary lemma (e.g., *γράφω*). Includes POS, morphology stems, translations, senses, semantic relations, etymology, pronunciation, and usage notes.
2.  **INFLECTED_FORM**: Represents a specific form (e.g., *έγραψε*). Links back to a lemma via `form_of` and includes inflectional tags.

The output conforms to a formal JSON Schema (`schema/normalized-entry.schema.json`) versioned per the policy in `VERSIONING.md`. The current schema version is `1.0.0`.

## Decoder Coverage

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

Use `npm run introspect` to discover templates in the wild that do not yet have decoders.

## Output Schema Versioning

See [VERSIONING.md](VERSIONING.md) for the full policy. In short: MAJOR bumps for breaking changes, MINOR for additive fields, PATCH for documentation-only fixes.
