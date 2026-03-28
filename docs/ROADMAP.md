# Wiktionary SDK: Implementation Roadmap (post-v1.0)

This roadmap proposes the next implementation stages for the
`wiktionary-sdk` ecosystem.

## Principles (non-negotiable)

- **Extraction, not inference**: only extract what is explicitly present in
  Wikitext/template parameters.
- **Traceability**: every structured field must be traceable to a source
  template, line, or section; store verbatim raw text alongside decoded data
  when practical.
- **Registry-first**: mapping/decoding logic lives in `src/registry.ts`, not in
  the parser or orchestration layer.

---

**Stage 9: Morphological API & Technical Documentation (Delivered)**
- Implementation of `conjugate()`, `decline()`, `stem()`, and `morphology()`.
- Added technical deep-dive documentation into Scribunto/Lua runtime.
- Formalized project rebranding to **Wiktionary SDK**.

**Stage 10: Formatter Engine, Morphology Corrections & Playground Overhaul (Delivered)**

- Added `src/formatter.ts`: polymorphic `format()` function with `text`, `markdown`, `html`,
  `ansi`, and `terminal-html` registered styles. `FormatterStyle` interface is public and
  pluggable via `registerStyle()`.
- Fixed `conjugate()` / `decline()` empty-criteria mode: returns full structured paradigm table
  (`Record<string, any>`) instead of an empty array.
- Fixed `morphology()`: non-linguistic entries (Pronunciation, References, etc.) are now
  filtered before form matching; case-insensitive match; LEXEME entries seed POS-appropriate
  grammatical defaults.
- Fixed row-header matching in `conjugate()` to accept ordinal suffixes (`1st sg`, `2nd pl`, …).
- CLI: `--format ansi` added; smart TTY default selects ANSI when stdout is interactive.
- Webapp: dual-theme UI (light dictionary + dark inspector); salve-style left-aligned Inter
  header with inline bold name and descriptor; macOS traffic-light terminal chrome.
- Webapp: pseudo-terminal renders exact CLI command (`~ wiktionary-sdk γράφω --extract stem`)
  before colour-coded `terminal-html` output.
- Webapp: GitHub corner (tholman-style with octocat wag animation).
- Webapp: removed misleading Wikidata checkbox; `enrich: true` hardcoded for playground.

**Stage 11: Compliance, Normalization & Doc Synchronization (Delivered)**

- **README Compliance Suite**: Integrated `test/readme_examples.test.ts` to ensure 100% parity
  between documentation and implementation.
- **Unicode Normalization (NFC)**: Forced all inputs (queries) and outputs (wikitext, titles) to
  NFC normalization in `src/api.ts` and `src/index.ts`, resolving cross-platform comparison
  failures.
- **Lemma Resolution Prioritization**: Updated `src/library.ts` to favor `INFLECTED_FORM` entries
  when searching for a lemma, preventing metadata blocks from intercepting resolution.
- **Robust IPA Decoding**: Updated `src/registry.ts` to find IPA even if slashes (`/`) or 
  brackets (`[]`) are missing in the wikitext template.
- **Hyphenation Support**: Confirmed `hyphenate()` returns arrays by default and supports 
  the `{ format: 'string' }` option for full flexibility.
- **API Aliases**: Added `phonetic()` and `derivations()` as semantic aliases for high-level 
  wrappers.

**All planned stages (0–11) are complete.** This document is retained for
reference. Future work can be added here as new stages.
