/**
 * Template Introspection Engine
 *
 * Crawls Greek template categories on Wiktionary and produces a
 * "Missing Decoder Report" listing templates without registered decoders.
 *
 * Usage:
 *   npx tsx tools/template-introspect.ts [--category <name>] [--json]
 *   npx tsx tools/template-introspect.ts --sample <N> [--json]  # sample N Greek entries, report top missing by frequency
 */

import { mwFetchJson } from "../src/ingress/api";
import { fetchWikitextEnWiktionary } from "../src/ingress/api";
import { registry } from "../src/registry";
import { extractLanguageSection } from "../src/parser";
import { parseTemplates } from "../src/parser";

const DEFAULT_CATEGORIES = [
  "Category:Greek headword-line templates",
  "Category:Greek inflection-table templates",
];

const GREEK_SAMPLE_CATEGORY = "Category:Greek lemmas";

async function fetchCategoryMembers(category: string, namespace = 10): Promise<string[]> {
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
      cmnamespace: String(namespace),
    };
    if (cmcontinue) params.cmcontinue = cmcontinue;

    const data = await mwFetchJson("https://en.wiktionary.org/w/api.php", params);
    const cms = data?.query?.categorymembers ?? [];
    for (const cm of cms) {
      const title = cm.title ?? "";
      const name = namespace === 10 ? title.replace(/^Template:/, "") : title;
      if (name) members.push(name);
    }
    cmcontinue = data?.continue?.cmcontinue;
  } while (cmcontinue);

  return members;
}

function getRegisteredTemplateNames(): Set<string> {
  return registry.getHandledTemplates();
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

export interface SampleReport {
  timestamp: string;
  sample_size: number;
  entries_sampled: number;
  templates_encountered: number;
  templates_decoded: number;
  top_missing_by_frequency: Array<{ template: string; count: number }>;
  all_encountered: number;
  all_decoded: number;
}

export async function generateSampleReport(sampleSize: number): Promise<SampleReport> {
  const members = await fetchCategoryMembers(GREEK_SAMPLE_CATEGORY, 0);
  const shuffled = [...members].sort(() => Math.random() - 0.5);
  const toSample = shuffled.slice(0, sampleSize);
  const freq = new Map<string, number>();
  const registered = registry.getHandledTemplates();
  let entriesSampled = 0;

  for (const title of toSample) {
    try {
      const page = await fetchWikitextEnWiktionary(title);
      if (!page.exists || !page.wikitext) continue;
      const langBlock = extractLanguageSection(page.wikitext, "Greek");
      if (!langBlock) continue;
      entriesSampled++;
      const templates = parseTemplates(langBlock);
      for (const t of templates) {
        freq.set(t.name, (freq.get(t.name) ?? 0) + 1);
      }
    } catch {
      // skip failed fetches
    }
  }

  const allTemplates = [...freq.entries()];
  const allEncountered = allTemplates.reduce((s, [, c]) => s + c, 0);
  const decoded = allTemplates.filter(([n]) => registered.has(n));
  const missing = allTemplates.filter(([n]) => !registered.has(n));
  const allDecoded = decoded.reduce((s, [, c]) => s + c, 0);
  const topMissing = missing
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([template, count]) => ({ template, count }));

  return {
    timestamp: new Date().toISOString(),
    sample_size: sampleSize,
    entries_sampled: entriesSampled,
    templates_encountered: freq.size,
    templates_decoded: decoded.length,
    top_missing_by_frequency: topMissing,
    all_encountered: allEncountered,
    all_decoded: allDecoded,
  };
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

export function formatSampleReport(report: SampleReport): string {
  const pct = report.all_encountered
    ? Math.round((report.all_decoded / report.all_encountered) * 100)
    : 100;
  const lines = [
    "# Template Sample Report (Greek entries)",
    "",
    `Generated: ${report.timestamp}`,
    `Entries sampled: ${report.entries_sampled} (requested ${report.sample_size})`,
    `Template types encountered: ${report.templates_encountered}`,
    `Template types decoded: ${report.templates_decoded}`,
    `Template instances: ${report.all_encountered} total, ${report.all_decoded} decoded (${pct}%)`,
    "",
    "## Top missing templates by frequency",
    "",
    ...report.top_missing_by_frequency.map((t) => `- \`${t.template}\`: ${t.count}`),
    "",
  ];
  return lines.join("\n");
}

if (typeof process !== "undefined" && process.argv[1]?.includes("template-introspect")) {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const catIdx = args.indexOf("--category");
  const categories = catIdx >= 0 && args[catIdx + 1] ? [args[catIdx + 1]] : undefined;
  const sampleIdx = args.indexOf("--sample");
  const sampleSize = sampleIdx >= 0 && args[sampleIdx + 1] ? parseInt(args[sampleIdx + 1], 10) : 0;

  const run = sampleSize > 0
    ? generateSampleReport(sampleSize).then((report) => {
        if (jsonOutput) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(formatSampleReport(report));
        }
      })
    : generateReport(categories).then((report) => {
        if (jsonOutput) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(formatReport(report));
        }
      });

  run.catch((err) => {
    console.error("Error generating report:", err);
    process.exit(1);
  });
}
