# Staged plan: modular `src/` layout

**Status:** Forward-only engineering backlog (alpha). Not tied to npm semver until you choose to tag. **Phases 0–9** of this plan are implemented on `master` (convenience split, `infra/`, `model/` + `types.ts` shim); **Phase 10** is ongoing doc hygiene (README/spec/audit path strings; optional removal of the `types.ts` shim after migrating in-repo imports to `./model`).

**Companion policy:** See **§ Project stage: alpha** in [`AGENTS.md`](../AGENTS.md): no backward-compatibility burden for internal paths or incidental APIs; the bar is **green tests**, **schema/types parity**, and **updated docs**.

---

## Goals

1. **Reveal structure** — Folder names match the real pipeline: ingress → parse → decode → pipeline → model → present → convenience.
2. **Reduce file gravity** — Break up `library.ts`, `formatter.ts`, `wiktionary-core.ts`, and `types.ts` into coherent units.
3. **Contain dependency direction** — Document and enforce allowed edges (e.g. convenience → pipeline → parse/decode → ingress; present → model).
4. **Stay shippable** — Each phase ends with `npm run build`, `npm run test:ci`, and a single focused commit (or two if docs are large).

---

## Target layout (end state)

```text
src/
  index.ts                    # Public barrel only
  model/                      # Types, SCHEMA_VERSION, type guards (split from types.ts)
  ingress/                    # api, cache, rate-limiter, server-fetch
  parse/                      # parser, lexicographic-headings
  decode/                     # registry.ts + registry/* (moved as a tree)
  pipeline/                   # wiktionary-core, form-of-parse-enrich (+ optional submodules)
  present/                    # formatter (split), form-of-display, lexeme-display-groups, templates/
  convenience/                # library (split), morphology, stem, wrapper-invoke
  infra/                      # utils, constants (optional home for shared pure helpers)
```

Names are normative for *intent*; adjust if a clearer term emerges (e.g. `fetch/` instead of `ingress/`).

---

## Dependency rules (inform linting / review)

| Layer        | May import from                    | Must not import from (avoid cycles)      |
|-------------|-------------------------------------|------------------------------------------|
| `ingress`   | `infra`, `model`                    | `parse`, `decode`, `pipeline`, `present`, `convenience` |
| `parse`     | `model`, `infra`                    | `decode`, `pipeline`, `convenience`       |
| `decode`    | `model`, `parse`, `infra`          | `pipeline`, `convenience`, `present`      |
| `pipeline`  | all below + `decode`, `parse`, `ingress` | `convenience`, `present` (keep I/O orchestration free of formatters) |
| `present`   | `model`, `infra`, `parse` (types/helpers only) | `pipeline`, `convenience`                |
| `convenience` | `pipeline`, `ingress`, `model`, `infra`, `decode` (if ever needed) | `present`                             |
| `model`     | (none or `infra` only)              | everything else                           |

**Resolved:** The former `morphology` ↔ monolithic `library` cycle was removed by splitting convenience modules (`morphology` uses `lemma` / `mapLexemes` locally, not a circular import through a single library file).

---

## Phase 0 — Baseline and guardrails

**Purpose:** Nothing moves yet; you have a reproducible bar.

1. Record current **`npm run test:ci`** green on `master`.
2. Add **`docs/src-layout-refactor-plan.md`** (this file) and link it from **`AGENTS.md`** Essential Reading.
3. Optional: add **`docs/architecture-layers.md`** with the table above + a one-line diagram (Mermaid), or keep the table only here.
4. Optional: note in **`typedoc`** / **`package.json`** `docs` script that entrypoints may multiply after Phase 5/6 (update when done).

**Exit:** Docs merged; tests still green.

---

## Phase 1 — `ingress/` (low coupling)

**Moves:** `api.ts`, `cache.ts`, `rate-limiter.ts`, `server-fetch.ts` → `src/ingress/`.

**Steps:**

1. Create `src/ingress/` and move files (git `mv` preserves history where supported).
2. Update imports across `src/`, `test/`, `cli/`, `webapp/` as needed.
3. If anything imported these via deep paths from outside `src`, fix those too.

**Exit:** `npm run test:ci` green. No behaviour change.

---

## Phase 2 — `parse/`

**Moves:** `parser.ts`, `lexicographic-headings.ts` → `src/parse/`.

**Steps:**

1. Move files; fix imports (`registry/` uses `../parser` today → `../parse/parser` or `@/parse/parser` if you introduce path aliases later).
2. Run decoder/parser tests (`test/parser*.ts`, `test/lexicographic-headings.test.ts`).

**Caution:** `parser.ts` imports `lexicographic-headings`; keep them in the same package layer.

**Exit:** `npm run test:ci` green.

---

## Phase 3 — `decode/` (registry tree)

**Moves:** `registry.ts` and entire `src/registry/` → `src/decode/` (paths become `src/decode/registry.ts`, `src/decode/registry/*` **or** keep inner folder name `registry` under `decode/` — pick one convention and stick to it).

**Steps:**

1. Prefer **single mechanical move** of the directory to avoid reordering decoder registration.
2. Update **`register-all-decoders`**, **`decoder-ids`**, **`tools/assert-registry-order.ts`**, **`docs/registry-inventory.md`**, and **`AGENTS.md`** paths.
3. Run **`npm run check:registry-order`** and decoder coverage tests.

**Exit:** `npm run test:ci` green; registry order test green.

---

## Phase 4 — `pipeline/`

**Moves:** `wiktionary-core.ts`, `form-of-parse-enrich.ts` → `src/pipeline/`.

**Steps:**

1. Update **`src/index.ts`** re-exports (still export `wiktionary` / `wiktionaryRecursive` from the new path).
2. Internal importers (`library.ts`, `morphology.ts`, tests) point to `pipeline/`.
3. **Optional sub-phase 4b:** Extract pure helpers from `wiktionary-core.ts` into `pipeline/steps/*.ts` (language block extraction, lemma merge, Wikidata attach) *without* behaviour change — only if each extraction is covered by existing tests or a small new test.

**Exit:** `npm run test:ci` green; no public API regression (same exports from `index.ts`).

---

## Phase 5 — `present/`

**Moves:** `formatter.ts`, `form-of-display.ts`, `lexeme-display-groups.ts`, and `templates/` (sources + generated `templates.ts`) under `src/present/`.

**Steps:**

1. Move files; fix imports (**`webapp`**, **`test/formatter-audit.test.ts`**, integration tests).
2. **Split `formatter.ts`** (recommended in the same phase or immediately after):
   - `present/handlebars-setup.ts` (helper registration),
   - `present/format-core.ts` (shared logic),
   - `present/format-html.ts` / `present/format-md.ts` (mode entrypoints),
   - thin `present/formatter.ts` facade re-exporting today’s public API.
3. Regenerate / relocate **`templates.ts`** import paths in Vite plugin or doc (**`AGENTS.md`** “Modify rendering” section).

**Exit:** `npm run test:ci` green; HTML/Markdown goldens unchanged unless a bugfix is intentional.

---

## Phase 6 — `convenience/` + split `library.ts`

**Moves:** `library.ts`, `morphology.ts`, `stem.ts`, `wrapper-invoke.ts` → `src/convenience/`.

**Steps:**

1. Split **`library.ts`** by concern, e.g.:
   - `convenience/grouped-results.ts` (`GroupedLexemeResults`, `mapLexemes`, …),
   - `convenience/lemma-and-translate.ts`,
   - `convenience/relations.ts`,
   - `convenience/rich-entry.ts`,
   - `convenience/wikidata-media.ts`,
   - `convenience/index.ts` barrel.
2. Keep **`src/index.ts`** exporting the same function names.
3. Update **`AGENTS.md`** §4 (CLI/webapp parity) with new file paths.

**Exit:** `npm run test:ci` green; **`test/cross-interface-parity.test.ts`** green.

---

## Phase 7 — `infra/` and small files

**Moves:** `utils.ts`, `constants.ts` → `src/infra/` (or keep `constants` adjacent to `model/` if you prefer).

**Steps:**

1. Move; fix imports across repo.
2. Ensure **browser-safe** surface: no accidental `fs` in shared infra used by webapp.

**Exit:** `npm run test:ci` green.

---

## Phase 8 — Dependency hygiene (cycles)

**Focus:** `morphology` ↔ `library` (and any new edges).

**Options (pick one per sub-step):**

1. Introduce **`convenience/wiktionary-helpers.ts`** with the minimal shared calls to **`pipeline/wiktionary`** used by both.
2. Or move **lemma helpers** used by morphology into **`pipeline/`** and have **`library`** call those.

**Exit:** No import cycle between `convenience` and `pipeline` (verify with `madge`, `skott`, or manual `grep`); `npm run test:ci` green.

---

## Phase 9 — `model/` (split `types.ts`)

**Moves:** Replace monolithic **`src/types.ts`** with **`src/model/*.ts`** + **`src/model/index.ts`**, and a **temporary** `src/types.ts` that re-exports everything (so churn is localized), then delete the shim once all imports use `model/` or the public barrel.

**Suggested slices:**

- `model/schema-version.ts` (`SCHEMA_VERSION`)
- `model/part-of-speech.ts` (`PART_OF_SPEECH_VALUES`, `isPartOfSpeech`)
- `model/lexeme.ts`, `model/fetch-result.ts`, `model/sense.ts`, `model/relations.ts`, `model/etymology.ts`, `model/wikidata.ts`, `model/templates.ts` (`TemplateCall`, `TemplateDecoder`, `DecodeContext`), `model/library-types.ts` (`LexemeResult`, `RichEntry`, …)

**Synchronization:** After each slice, align **`schema/src/`** YAML and **`npm run build:schema`** if any **public** JSON shape changes (often it does not if only file layout changes).

**Exit:** `npm run test:ci` green; **`test/schema-pos-parity.test.ts`** green; TypeDoc entrypoints updated if needed.

---

## Phase 10 — Barrel, docs, and cleanup

1. **`src/index.ts`** — Trim to re-exports only; confirm **`package.json`** `exports` still point at built `dist` (adjust only if you intentionally add subpath exports).
2. **`README.md`** project tree — Match final layout.
3. **`AGENTS.md`** — Replace every stale path (`src/parser.ts` → `src/parse/parser.ts`, etc.).
4. **`docs/wiktionary-sdk-spec.md`** §14 / implementation map — Update file paths.
5. Remove **temporary** `types.ts` shim if still present.
6. Optional: **`eslint-plugin-import`** boundaries or a simple **`dependency-cruiser`** config encoding the layer table.

**Exit:** Full doc sweep; `npm run test:ci` green.

---

## Verification checklist (every phase)

- [ ] `npm run build`
- [ ] `npm run test:ci` (includes registry order + schema artifact checks)
- [ ] Grep for old paths in `test/`, `cli/`, `webapp/`, `tools/`
- [ ] If types or output shape changed: `npm run build:schema` + commit JSON

---

## Ordering rationale (why this order)

1. **Ingress / parse** first — Few dependents, clear boundaries, low risk.
2. **Decode** before **pipeline** — `wiktionary-core` depends on registry + parser; moving registry first avoids double refactors.
3. **Pipeline** before **present** — Formatter must not be pulled into orchestration; pipeline stays independent of Handlebars.
4. **Convenience** after **pipeline** — Wrappers sit on top of the engine; splitting `library` is easier when imports already point to `pipeline/`.
5. **Types split last** — Touches almost every file; doing it after physical moves avoids mixing two kinds of churn in one step.

---

## After this plan

- Fold completed phases into **`CHANGELOG.md`** and trim this doc or mark sections **Done**.
- Large **product** backlog remains in **`docs/ROADMAP.md`** (or successor); this file is **only** the `src/` modularization spine.
