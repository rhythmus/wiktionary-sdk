/**
 * Pure HTTP response builder for GET /api/fetch — shared by `server.ts` and tests.
 */
import { wiktionary as defaultWiktionary } from "./index";
import type { WikiLang } from "./types";

export type WiktionaryFetchFn = typeof defaultWiktionary;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
};

export async function buildApiFetchResponse(
  url: URL,
  deps?: { wiktionaryFn?: WiktionaryFetchFn }
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const wiktionary = deps?.wiktionaryFn ?? defaultWiktionary;
  const query = url.searchParams.get("query");
  const lang = (url.searchParams.get("lang") || "el") as WikiLang;
  const pos = url.searchParams.get("pos") || undefined;
  const enrich = url.searchParams.get("enrich") !== "false";

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
      preferredPos: pos,
      enrich,
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
