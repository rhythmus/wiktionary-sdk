/**
 * Pure HTTP response builder for GET /api/fetch — shared by `server.ts` and tests.
 */
import { wiktionary as defaultWiktionary } from "../pipeline/wiktionary-core";
import { SERVER_DEFAULT_WIKI_LANG } from "../infra/constants";
import type { WikiLang } from "../model";

export type WiktionaryFetchFn = typeof defaultWiktionary;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
};

function parseEnrichParam(raw: string | null): boolean {
  if (raw === null) return true;
  const x = raw.toLowerCase();
  return x !== "false" && x !== "0" && x !== "no";
}

function parseDebugDecodersParam(raw: string | null): boolean {
  if (raw === null) return false;
  const x = raw.toLowerCase();
  return x === "true" || x === "1" || x === "yes";
}

function parseMatchMode(raw: string | null): "strict" | "fuzzy" {
  return raw?.toLowerCase() === "fuzzy" ? "fuzzy" : "strict";
}

function parseSort(raw: string | null): "source" | "priority" {
  return raw?.toLowerCase() === "priority" ? "priority" : "source";
}

function parseLangPriorities(raw: string | null): Record<string, number> | undefined {
  if (!raw) return undefined;
  const out: Record<string, number> = {};
  for (const chunk of raw.split(",")) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const [langRaw, rankRaw] = trimmed.split("=");
    if (!langRaw || !rankRaw) continue;
    const rank = Number(rankRaw.trim());
    if (!Number.isFinite(rank)) continue;
    out[langRaw.trim()] = rank;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseOptionalPositiveInt(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

export async function buildApiFetchResponse(
  url: URL,
  deps?: { wiktionaryFn?: WiktionaryFetchFn },
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const wiktionary = deps?.wiktionaryFn ?? defaultWiktionary;
  const query = url.searchParams.get("query");
  const lang = (url.searchParams.get("lang") || SERVER_DEFAULT_WIKI_LANG) as WikiLang;
  /**
   * PoS block filter (`wiktionary({ pos })`). Prefer this for strict filtering.
   * When omitted, defaults to `"Auto"`.
   */
  const pos = url.searchParams.get("filterPos") || "Auto";
  /**
   * Lemma disambiguation (`wiktionary({ preferredPos })`).
   * For backwards compatibility, bare `pos=` maps here only (legacy server behaviour).
   */
  const preferredPos =
    url.searchParams.get("preferredPos") ?? url.searchParams.get("pos") ?? undefined;
  const enrich = parseEnrichParam(url.searchParams.get("enrich"));
  const matchMode = parseMatchMode(url.searchParams.get("matchMode"));
  const sort = parseSort(url.searchParams.get("sort"));
  const sortPriorities = parseLangPriorities(url.searchParams.get("langPriorities"));
  const debugDecoders = parseDebugDecodersParam(url.searchParams.get("debugDecoders"));
  const lemmaFetchConcurrency = parseOptionalPositiveInt(url.searchParams.get("lemmaFetchConcurrency"));
  const formOfParseConcurrency = parseOptionalPositiveInt(url.searchParams.get("formOfParseConcurrency"));

  if (!query) {
    return {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({ error: "Missing required 'query' parameter" }),
    };
  }

  try {
    const result = await wiktionary({
      query,
      lang,
      pos,
      preferredPos,
      enrich,
      matchMode,
      sort: sortPriorities ? { strategy: sort, priorities: sortPriorities } : sort,
      debugDecoders,
      ...(lemmaFetchConcurrency != null ? { lemmaFetchConcurrency } : {}),
      ...(formOfParseConcurrency != null ? { formOfParseConcurrency } : {}),
    });

    const format = url.searchParams.get("format");
    if (format === "yaml") {
      const jsYaml = await import("js-yaml");
      const yamlStr = jsYaml.dump(result, { indent: 2, lineWidth: -1, noRefs: true });
      return {
        status: 200,
        headers: { "Content-Type": "text/yaml; charset=utf-8", ...CORS_HEADERS },
        body: yamlStr,
      };
    }

    return {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify(result, null, 2),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({ error: message }),
    };
  }
}
