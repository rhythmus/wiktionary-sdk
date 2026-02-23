/**
 * Template Introspection Engine
 *
 * Crawls Greek template categories on Wiktionary and produces a
 * "Missing Decoder Report" listing templates without registered decoders.
 *
 * Usage:  npx tsx tools/template-introspect.ts [--category <name>] [--json]
 */

import { mwFetchJson } from "../src/api";
import { registry } from "../src/registry";
import { parseTemplates } from "../src/parser";
import type { DecodeContext } from "../src/types";

const DEFAULT_CATEGORIES = [
  "Category:Greek headword-line templates",
  "Category:Greek inflection-table templates",
];

async function fetchCategoryMembers(category: string): Promise<string[]> {
  const members: string[] = [];
  let cmcontinue: string | undefined;

  do {
    const params: Record<string, string> = {
      action: "query",
      format: "json",
      formatversion: "2",
      origin: "*",
      list: "categorymembers",
      cmtitle: category,
      cmlimit: "500",
      cmnamespace: "10",
    };
    if (cmcontinue) params.cmcontinue = cmcontinue;

    const data = await mwFetchJson("https://en.wiktionary.org/w/api.php", params);
    const cms = data?.query?.categorymembers ?? [];
    for (const cm of cms) {
      const name = (cm.title ?? "").replace(/^Template:/, "");
      if (name) members.push(name);
    }
    cmcontinue = data?.continue?.cmcontinue;
  } while (cmcontinue);

  return members;
}

function getRegisteredTemplateNames(): Set<string> {
  const dummyWikitext = "";
  const dummyCtx: DecodeContext = {
    lang: "el",
    query: "",
    page: { exists: false, title: "", wikitext: "", pageprops: {}, pageid: null },
    languageBlock: "",
    etymology: { idx: 0, title: "", posBlocks: [] },
    posBlock: { posHeading: "", wikitext: "" },
    posBlockWikitext: "",
    templates: [],
    lines: [],
  };

  const knownNames = new Set<string>();

  const probeNames = [
    "el-verb", "el-noun", "el-adj", "el-adv", "el-pron", "el-numeral",
    "el-part", "el-art", "el-art-def", "el-art-indef",
    "IPA", "el-IPA", "audio", "hyphenation",
    "inflection of", "infl of", "form of", "alternative form of",
    "alt form", "alt form of", "misspelling of", "abbreviation of",
    "short for", "clipping of", "diminutive of", "augmentative of",
    "syn", "ant", "hyper", "hypo",
    "inh", "der", "bor", "cog", "inherited", "derived", "borrowed", "cognate",
    "t", "t+", "t-simple", "tt", "tt+",
  ];

  for (const name of probeNames) {
    const raw = `{{${name}|el|test}}`;
    const templates = parseTemplates(raw);
    const ctx = { ...dummyCtx, templates, lines: [raw], posBlockWikitext: raw };
    try {
      const patch = registry.decodeAll(ctx);
      if (patch && Object.keys(patch).length > 0) {
        knownNames.add(name);
      }
    } catch {
      // skip
    }
  }

  return knownNames;
}

export interface IntrospectionReport {
  timestamp: string;
  categories: string[];
  total_discovered: number;
  total_covered: number;
  total_missing: number;
  coverage_pct: number;
  covered: string[];
  missing: string[];
}

export async function generateReport(categories?: string[]): Promise<IntrospectionReport> {
  const cats = categories ?? DEFAULT_CATEGORIES;
  const allTemplates = new Set<string>();

  for (const cat of cats) {
    const members = await fetchCategoryMembers(cat);
    for (const m of members) allTemplates.add(m);
  }

  const registered = getRegisteredTemplateNames();
  const discovered = [...allTemplates].sort();
  const covered = discovered.filter((t) => registered.has(t));
  const missing = discovered.filter((t) => !registered.has(t));

  return {
    timestamp: new Date().toISOString(),
    categories: cats,
    total_discovered: discovered.length,
    total_covered: covered.length,
    total_missing: missing.length,
    coverage_pct: discovered.length ? Math.round((covered.length / discovered.length) * 100) : 100,
    covered,
    missing,
  };
}

export function formatReport(report: IntrospectionReport): string {
  const lines = [
    "# Template Introspection Report",
    "",
    `Generated: ${report.timestamp}`,
    `Categories: ${report.categories.join(", ")}`,
    "",
    `## Coverage: ${report.coverage_pct}% (${report.total_covered}/${report.total_discovered})`,
    "",
    `### Covered templates (${report.total_covered})`,
    ...report.covered.map((t) => `- \`${t}\``),
    "",
    `### Missing decoders (${report.total_missing})`,
    ...report.missing.map((t) => `- \`${t}\``),
    "",
  ];
  return lines.join("\n");
}

if (typeof process !== "undefined" && process.argv[1]?.includes("template-introspect")) {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const catIdx = args.indexOf("--category");
  const categories = catIdx >= 0 && args[catIdx + 1] ? [args[catIdx + 1]] : undefined;

  generateReport(categories)
    .then((report) => {
      if (jsonOutput) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatReport(report));
      }
    })
    .catch((err) => {
      console.error("Error generating report:", err);
      process.exit(1);
    });
}
