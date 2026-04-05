/**
 * Merge author-time modular YAML under schema/src/ into the published
 * schema/normalized-entry.schema.json (JSON Schema draft-07).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { allExpectedDefKeys } from "./schema-def-modules";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(repoRoot, "schema", "src");
const defsDir = join(srcDir, "defs");
const rootPath = join(srcDir, "root.yaml");
const outPath = join(repoRoot, "schema", "normalized-entry.schema.json");

function loadYaml(path: string): unknown {
  const text = readFileSync(path, "utf8");
  return yaml.load(text);
}

function mergeDefs(): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  const files = readdirSync(defsDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  for (const file of files) {
    const full = join(defsDir, file);
    const doc = loadYaml(full) as Record<string, unknown> | null;
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      throw new Error(`Invalid YAML object in ${full}`);
    }
    for (const [key, value] of Object.entries(doc)) {
      if (key in merged) {
        throw new Error(`Duplicate $defs key "${key}" (also in earlier file)`);
      }
      merged[key] = value;
    }
  }

  const expected = new Set(allExpectedDefKeys());
  for (const k of Object.keys(merged)) {
    if (!expected.has(k)) {
      throw new Error(`Unexpected $defs key "${k}" not listed in schema-def-modules.ts`);
    }
  }
  for (const k of expected) {
    if (!(k in merged)) {
      throw new Error(`Missing $defs key "${k}" (from schema-def-modules.ts)`);
    }
  }

  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(merged).sort()) {
    sorted[k] = merged[k];
  }
  return sorted;
}

function main(): void {
  if (!existsSync(rootPath)) {
    throw new Error(`Missing ${rootPath}`);
  }
  const root = loadYaml(rootPath) as Record<string, unknown>;
  if (!root || typeof root !== "object") {
    throw new Error("root.yaml must be a YAML mapping");
  }
  if ("$defs" in root) {
    throw new Error("root.yaml must not contain $defs (use schema/src/defs/*.yaml)");
  }

  const $defs = mergeDefs();
  const schema = { ...root, $defs };

  const json = JSON.stringify(schema, null, 2) + "\n";
  writeFileSync(outPath, json, "utf8");
  console.error(`Wrote ${outPath} (${Object.keys($defs).length} $defs)`);
}

main();
