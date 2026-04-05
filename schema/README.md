# Normalized output JSON Schema

- **Author-time source (edit here):** `schema/src/root.yaml` and `schema/src/defs/*.yaml`  
- **Published artifact (validators, npm `files`):** `schema/normalized-entry.schema.json` — **generated; do not hand-edit.**

## Regenerate the JSON

```bash
npm run build:schema
```

After changing any file under `schema/src/`, run the command above and commit the updated `normalized-entry.schema.json`. CI runs `npm run check:schema-artifact` to ensure the artifact matches the YAML.

## Layout

- `tools/schema-def-modules.ts` — maps each `defs/*.yaml` file to its `$defs` keys (each key exactly once).
- `tools/build-normalized-schema.ts` — merges YAML → JSON (sorted `$defs` keys for stable diffs).
- `tools/bootstrap-normalized-schema-yaml.ts` — rare helper to split the JSON back into YAML modules (e.g. after a one-off JSON-only edit).

## New `$defs` entry

1. Add the key to the appropriate file list in `tools/schema-def-modules.ts` (or add a new `defs/*.yaml` and list it there).
2. Add the schema fragment under `schema/src/defs/`.
3. Run `npm run build:schema` and commit both YAML and `normalized-entry.schema.json`.
