# WiktionaryFetch

WiktionaryFetch is a specialized tool for the **deterministic and source-faithful extraction** of lexicographic data from Wiktionary, with a primary focus on **Greek entries**.

It aims to provide a clean, normalized representation of word data (JSON/YAML) directly from the English Wiktionary's wikitext, optionally enriched with Wikidata and Wikimedia Commons media.

## 🎯 Goals

- **Source-Faithful Extraction:** Extracts verbatim wikitext and template data without making linguistic inferences (no paradigm completion or stem guessing).
- **Canonical Parsing Surface:** Uses the **English Wiktionary** (`en.wiktionary.org`) as the primary data source. This is a deliberate choice as `en` provides more consistent structure and broader Greek coverage than `el.wiktionary.org`.
- **Traceability:** Every piece of extracted data is traceable back to its source template or wikitext block.
- **Normalized Representation:** Converts complex wikitext blocks into a consistent schema for Lexemes and Inflected Forms.

## 🏗️ Architecture & Pipeline

The system follows a multi-layered approach to handle the transition from raw web data to deep linguistic analysis:

1.  **Wiktionary Raw Layer:** Fetches wikitext via the MediaWiki Action/REST API.
2.  **Normalized Layer:** Parses structural templates (e.g., `{{el-form-of-verb}}`, `{{el-verb}}`) into a consistent `NormalizedEntry` format.
3.  **Deep Morphology Layer:** (Optional/Future) Extends the normalized data with calculated fields like augment segmentation and stem alternation logic.

## ✨ Key Features

- **Registry-Based Decoders:** Uses a modular architecture of pure decoders to handle specific template families.
- **Template-First Strategy:** Focuses on extracting "invariants"—machine-readable template parameters—rather than fragile screen-scraping of HTML.
- **Lemma Resolution:** Automatically detects "form-of" templates (e.g., `{infl of|...}`) to link inflected forms back to their lemma lexemes.

- **Multi-Source Enrichment:** Optionally fetches Wikidata labels, descriptions, and sitelinks, as well as Wikimedia Commons thumbnails (via P18).
- **Template Coverage Strategy:** Focuses on total coverage of templates used in Greek entries through automated discovery of template categories.

## 🏗️ Architecture & Project Structure

The project has evolved from a standalone prototype into a modular TypeScript library with a modern React frontend.

- **`src/` (Core Engine):** The heart of the project. A tree-shakeable TypeScript library that handles fetching, parsing, and normalization.
    - `types.ts`: Formal schema and interface definitions.
    - `registry.ts`: The `DecoderRegistry` and PoS mapping logic.
    - `parser.ts`: Robust wikitext and template parsing.
    - `api.ts`: MediaWiki and Wikidata client abstraction.
- **`webapp/` (React Frontend):** A premium React/Vite dashboard for visual verification.
    - Glassmorphism design with Tailwind CSS.
    - Real-time YAML preview and image gallery.
- **`docs/`:** Formal specifications, deep-dive research, and the project roadmap.
    - `wiktionary-fetch-spec.md`: The technical "ground truth" for the engine.
    - `ROADMAP.md`: The multi-phase evolution plan.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### 🛠️ Building the Library
To build the core TypeScript engine into the `dist/` folder:
```bash
npm install
npm run build
```

### 💻 Running the Web Frontend
The React application is located in the `webapp/` directory:
```bash
cd webapp
npm install
npm run dev
```

## 📊 Data Model

The project distinguishes between two primary entry types:

1.  **LEXEME**: Represents a dictionary lemma (e.g., *γράφω*). Includes POS, morphology stems, and translations.
2.  **INFLECTED_FORM**: Represents a specific form (e.g., *έγραψε*). Links back to a lemma and includes inflectional tags.

---

> [!NOTE]
> This project has transitioned from a prototype to a modular library structure (v1.0 Alpha).

