# WiktionaryFetch

WiktionaryFetch is a specialized tool for the **deterministic and source-faithful extraction** of lexicographic data from Wiktionary, with a primary focus on **Greek entries**.

The project is designed as a **multi-client ecosystem**, separating the core extraction engine from its various interfaces (Web, CLI, and future Node packages).

## 🏛️ Design Philosophy

1.  **Extraction, Not Inference**: We extract *what is actually there*. By avoiding linguistic heuristics, we ensure the data is 100% faithful to the source, making it a reliable foundation for higher-level morphology engines.
2.  **Registry-Based Modularity**: Instead of a monolithic parser, a decentralized **Registry of Template Decoders** allows for rapid expansion and total traceability.
3.  **Traceability First**: Every piece of normalized data links back to its specific source template and verbatim wikitext.
4.  **Developer-Centric Verification**: A premium React dashboard provides instant visual confirmation of extraction quality through real-time YAML and media previews.

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

