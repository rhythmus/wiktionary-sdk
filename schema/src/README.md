Modular YAML for `normalized-entry.schema.json`.

- `root.yaml` — document root (`$schema`, `properties`, `required`, …) **without** `$defs`.
- `defs/*.yaml` — one mapping per file: top-level keys are `$defs` names; values are the schema objects. File order is `01-…` … `91-…`; see `tools/schema-def-modules.ts` for which keys live in which file.
