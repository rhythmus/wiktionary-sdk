/**
 * Compares en.wiktionary Category:Form-of templates against registry coverage
 * (isFormOfTemplateName from registry). Writes a markdown report and
 * prints a short summary.
 *
 * Usage: npx tsx tools/form-of-template-report.ts
 *
 * Requires network access to the MediaWiki API.
 */

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { mwFetchJson } from "../src/ingress/api";
import { FORM_OF_TEMPLATES, isFormOfTemplateName } from "../src/registry";

/** In Category:Form-of templates but not a lemma-pointer "X of lemma" (handled as only_used_in on senses). */
const CATEGORY_NOT_FORM_OF_LEMMA = new Set(["only used in"]);

const CATEGORY = "Category:Form-of templates";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(__dirname, "form-of-template-report.md");

function normalizeTemplateTitle(title: string): string {
  return title
    .replace(/^Template:/i, "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

function isCovered(name: string): boolean {
  return isFormOfTemplateName(name) || CATEGORY_NOT_FORM_OF_LEMMA.has(name);
}

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
      const title = cm.title ?? "";
      if (title) members.push(title);
    }
    cmcontinue = data?.continue?.cmcontinue;
  } while (cmcontinue);

  return members;
}

async function main(): Promise<void> {
  const titles = await fetchCategoryMembers(CATEGORY);
  const normalized = titles.map((t) => ({
    title: t,
    name: normalizeTemplateTitle(t),
  }));

  const gaps = normalized.filter((x) => !isCovered(x.name));
  const covered = normalized.filter((x) => isCovered(x.name));
  const differentSemantics = normalized.filter((x) => CATEGORY_NOT_FORM_OF_LEMMA.has(x.name));
  const lemmaFormOfCount = normalized.filter((x) => isFormOfTemplateName(x.name)).length;

  const extraInRegistry = [...FORM_OF_TEMPLATES].filter(
    (n) => !normalized.some((x) => x.name === n.toLowerCase()),
  );
  extraInRegistry.sort();

  const lines: string[] = [
    `# Form-of template coverage report`,
    ``,
    `- **Category**: [${CATEGORY}](https://en.wiktionary.org/wiki/${encodeURIComponent(CATEGORY.replace(/ /g, "_"))})`,
    `- **Fetched**: ${new Date().toISOString()}`,
    `- **Templates in category**: ${normalized.length}`,
    `- **Lemma form-of (\`isFormOfTemplateName\`)**: ${lemmaFormOfCount}`,
    `- **Same category, other semantics** (see below): ${differentSemantics.length}`,
    `- **Accounted for (sum of the two)**: ${covered.length}`,
    `- **Gaps (in category, not accounted for)**: ${gaps.length}`,
    ``,
    `## Same category, different semantics (not isFormOfTemplateName)`,
    ``,
    `These templates appear in the category but are not lemma pointers; the SDK handles them elsewhere.`,
    ``,
  ];

  if (differentSemantics.length === 0) {
    lines.push(`(none)`);
  } else {
    for (const g of differentSemantics.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(
        `- \`${g.name}\` — decoded as structured \`only_used_in\` on sense lines, not \`form_of\` ([${g.title}](https://en.wiktionary.org/wiki/${encodeURIComponent(g.title.replace(/ /g, "_"))}))`,
      );
    }
  }

  lines.push(``, `## Gaps`, ``);

  if (gaps.length === 0) {
    lines.push(`(none)`);
  } else {
    for (const g of gaps.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`- \`${g.name}\` ([${g.title}](https://en.wiktionary.org/wiki/${encodeURIComponent(g.title.replace(/ /g, "_"))}))`);
    }
  }

  lines.push(
    ``,
    `## Registry templates not listed in category (informational)`,
    ``,
    `These appear in \`FORM_OF_TEMPLATES\` but were not returned as category members (may be intentional or category lag).`,
    ``,
  );
  if (extraInRegistry.length === 0) {
    lines.push(`(none)`);
  } else {
    for (const n of extraInRegistry) {
      lines.push(`- \`${n}\``);
    }
  }

  const body = lines.join("\n");
  await writeFile(REPORT_PATH, body, "utf8");

  console.log(`Category members: ${normalized.length}`);
  console.log(`Covered: ${covered.length}, gaps: ${gaps.length}`);
  console.log(`Wrote ${REPORT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
