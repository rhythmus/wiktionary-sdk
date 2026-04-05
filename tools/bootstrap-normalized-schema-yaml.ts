/**
 * One-shot (or rare) helper: split schema/normalized-entry.schema.json into
 * schema/src/root.yaml + schema/src/defs/*.yaml per schema-def-modules.ts.
 * Run: npx tsx tools/bootstrap-normalized-schema-yaml.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { SCHEMA_DEF_MODULES } from "./schema-def-modules";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = join(repoRoot, "schema", "normalized-entry.schema.json");
const srcDir = join(repoRoot, "schema", "src");
const defsDir = join(srcDir, "defs");

const dumpOpts: yaml.DumpOptions = {
  lineWidth: 120,
  noRefs: true,
  sortKeys: false,
};

function main(): void {
  const schema = JSON.parse(readFileSync(jsonPath, "utf8")) as {
    $defs: Record<string, unknown>;
    [k: string]: unknown;
  };
  const { $defs, ...root } = schema;

  mkdirSync(defsDir, { recursive: true });

  const used = new Set<string>();
  for (const [filename, keys] of Object.entries(SCHEMA_DEF_MODULES)) {
    const chunk: Record<string, unknown> = {};
    for (const key of keys) {
      if (!(key in $defs)) {
        throw new Error(`$defs.${key} missing in JSON for ${filename}`);
      }
      if (used.has(key)) throw new Error(`Duplicate assignment of ${key}`);
      used.add(key);
      chunk[key] = $defs[key];
    }
    const banner = `# JSON Schema \$defs fragment — see tools/schema-def-modules.ts\n\n`;
    const out = banner + yaml.dump(chunk, dumpOpts);
    writeFileSync(join(defsDir, filename), out, "utf8");
  }

  for (const k of Object.keys($defs)) {
    if (!used.has(k)) throw new Error(`$defs.${k} not assigned to any module`);
  }

  const rootBanner = `# FetchResult root document (no \$defs). Built JSON: schema/normalized-entry.schema.json\n# Regenerate: npm run build:schema\n\n`;
  writeFileSync(join(srcDir, "root.yaml"), rootBanner + yaml.dump(root, dumpOpts), "utf8");
  console.error(`Wrote ${join(srcDir, "root.yaml")} and ${Object.keys(SCHEMA_DEF_MODULES).length} files under defs/`);
}

main();
