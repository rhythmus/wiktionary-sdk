#!/usr/bin/env node

/**
 * WiktionaryFetch CLI
 *
 * Usage:
 *   wiktionary-fetch <term> [options]
 *   wiktionary-fetch --batch <file> [options]
 *
 * Options:
 *   --lang, -l       Language code (default: el)
 *   --format, -f     Output format: yaml | json (default: yaml)
 *   --pos, -p        Preferred part of speech filter
 *   --no-enrich      Skip Wikidata enrichment
 *   --batch, -b      Path to a CSV or JSON file with terms to process
 *   --output, -o     Output file path (default: stdout)
 *   --help, -h       Show this help message
 */

import { fetchWiktionary } from "../src/index";
import type { WikiLang, FetchResult } from "../src/types";
import { readFileSync, writeFileSync } from "fs";

interface CliOptions {
  terms: string[];
  lang: WikiLang;
  format: "yaml" | "json";
  preferredPos?: string;
  enrich: boolean;
  batchFile?: string;
  outputFile?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const opts: CliOptions = {
    terms: [],
    lang: "el",
    format: "yaml",
    enrich: true,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--lang" || arg === "-l") {
      opts.lang = args[++i] as WikiLang;
    } else if (arg === "--format" || arg === "-f") {
      const fmt = args[++i];
      if (fmt !== "yaml" && fmt !== "json") {
        console.error(`Unknown format: ${fmt}. Use 'yaml' or 'json'.`);
        process.exit(1);
      }
      opts.format = fmt;
    } else if (arg === "--pos" || arg === "-p") {
      opts.preferredPos = args[++i];
    } else if (arg === "--no-enrich") {
      opts.enrich = false;
    } else if (arg === "--batch" || arg === "-b") {
      opts.batchFile = args[++i];
    } else if (arg === "--output" || arg === "-o") {
      opts.outputFile = args[++i];
    } else if (!arg.startsWith("-")) {
      opts.terms.push(arg);
    }
    i++;
  }

  return opts;
}

function printHelp(): void {
  console.log(`
WiktionaryFetch CLI — Deterministic Wiktionary Extraction

Usage:
  wiktionary-fetch <term> [options]
  wiktionary-fetch --batch <file> [options]

Arguments:
  <term>             One or more terms to look up

Options:
  --lang, -l <code>  Language code (default: el)
  --format, -f <fmt> Output format: yaml | json (default: yaml)
  --pos, -p <pos>    Preferred part of speech
  --no-enrich        Skip Wikidata enrichment
  --batch, -b <file> Batch file (one term per line, or JSON array)
  --output, -o <file> Write output to file instead of stdout
  --help, -h         Show this help

Examples:
  wiktionary-fetch γράφω
  wiktionary-fetch γράφω --lang el --format json
  wiktionary-fetch --batch terms.txt --format yaml --output results.yaml
`);
}

function loadBatchTerms(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8").trim();

  if (filePath.endsWith(".json")) {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed.map(String);
    if (typeof parsed === "object") {
      return Object.values(parsed).flat().map(String);
    }
    return [String(parsed)];
  }

  // CSV or plain text: one term per line
  return content
    .split("\n")
    .map((line: string) => line.split(",")[0].trim())
    .filter(Boolean);
}

async function formatOutput(result: FetchResult, format: "yaml" | "json"): Promise<string> {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }
  // Dynamic import for yaml (only needed for yaml format)
  const jsYaml = await import("js-yaml");
  return jsYaml.dump(result, { indent: 2, lineWidth: -1, noRefs: true, sortKeys: false });
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  let terms = opts.terms;
  if (opts.batchFile) {
    terms = terms.concat(loadBatchTerms(opts.batchFile));
  }

  if (terms.length === 0) {
    console.error("No terms provided. Use --help for usage information.");
    process.exit(1);
  }

  const allResults: FetchResult[] = [];

  for (const term of terms) {
    try {
      const result = await fetchWiktionary({
        query: term,
        lang: opts.lang,
        preferredPos: opts.preferredPos,
        enrich: opts.enrich,
      });
      allResults.push(result);

      if (!opts.outputFile) {
        const output = await formatOutput(result, opts.format);
        console.log(`--- ${term} ---`);
        console.log(output);
      }
    } catch (err: any) {
      console.error(`Error fetching "${term}": ${err.message}`);
    }
  }

  if (opts.outputFile) {
    const combined = terms.length === 1
      ? allResults[0]
      : { results: allResults.map((r, i) => ({ query: terms[i], ...r })) };
    const output = await formatOutput(combined as any, opts.format);
    writeFileSync(opts.outputFile, output, "utf-8");
    console.log(`Output written to ${opts.outputFile}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
