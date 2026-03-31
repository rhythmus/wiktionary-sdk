import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { describe, it, expect } from "vitest";
import type { TemplateDecoder } from "../src/types";
import { registry } from "../src/registry";

const TEST_ROOT = resolve(__dirname, "..");

/** Decoders for Greek headword templates not yet present in any fixture or test string. */
const DECODER_EVIDENCE_ALLOWLIST = new Set<string>([
  "store-raw-templates",
  "el-pron-head",
  "el-numeral-head",
  "el-participle-head",
  "el-adv-head",
  "el-art-head",
  "romanization",
  "rhymes",
  /** Section decoders — add ===…=== blocks to fixtures when you want to drop from allowlist. */
  "alternative-forms",
  "see-also",
  "anagrams",
  "wikidata-p31",
  "nl-adj-head",
  "nl-verb-head",
  "de-adj-head",
  "de-verb-head",
]);

function collectTextFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collectTextFiles(p, acc);
    else if (name.endsWith(".ts") || name.endsWith(".wikitext") || name.endsWith(".json")) acc.push(p);
  }
  return acc;
}

function templateNeedle(name: string): string {
  return `{{${name}`;
}

function hasDecoderEvidence(d: TemplateDecoder, blob: string): boolean {
  if (d.id === "store-raw-templates") return true;
  if (DECODER_EVIDENCE_ALLOWLIST.has(d.id)) return true;

  const ht = d.handlesTemplates ?? [];
  if (ht.length > 0) {
    return ht.some((t) => blob.includes(templateNeedle(t)));
  }

  if (d.id === "references" && /===\s*References\s*===/m.test(blob)) return true;
  if (d.id === "usage-notes" && /Usage notes|===Notes===/i.test(blob)) return true;
  if (
    d.id === "inflection-table-ref" &&
    (/\{\{\s*el-conj/i.test(blob) || /\{\{\s*el-decl/i.test(blob))
  ) {
    return true;
  }
  if (d.id === "form-of") {
    return /\{\{\s*inflection of/i.test(blob) || /\{\{\s*infl of/i.test(blob);
  }
  if (d.id === "alternative-forms-section") {
    return /={3,}\s*Alternative forms\s*={3,}/im.test(blob);
  }
  if (d.id === "el-noun-stems") {
    return /\{\{\s*el-n[MNF]-/i.test(blob);
  }

  return blob.includes(`"${d.id}"`);
}

describe("decoder registry evidence", () => {
  it("every production decoder has corpus evidence (fixture or test)", () => {
    const paths = collectTextFiles(join(TEST_ROOT, "test"));
    const blob = paths
      .filter((p) => !p.includes("decoder-coverage.test.ts"))
      .map((p) => readFileSync(p, "utf-8"))
      .join("\n");

    const missing: string[] = [];
    const seen = new Set<string>();
    for (const d of registry.getDecoders()) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      if (!hasDecoderEvidence(d, blob)) missing.push(d.id);
    }

    expect(missing, `Add a fixture/test using these decoders or extend DECODER_EVIDENCE_ALLOWLIST: ${missing.join(", ")}`).toEqual(
      []
    );
  });
});
