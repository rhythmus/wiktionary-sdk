/**
 * Lightweight HTTP API wrapper for the WiktionaryFetch engine.
 *
 * GET /api/fetch?query=<term>&lang=<code>&pos=<pos>&enrich=<bool>&format=<yaml|json>
 * GET /api/health
 *
 * Run:  npx tsx server.ts
 * Or:   node dist/esm/server.js  (after build)
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { fetchWiktionary } from "./src/index";
import type { WikiLang } from "./src/types";

const PORT = parseInt(process.env.PORT || "3000", 10);

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data, null, 2));
}

async function handleFetch(url: URL, res: ServerResponse): Promise<void> {
  const query = url.searchParams.get("query");
  const lang = (url.searchParams.get("lang") || "el") as WikiLang;
  const pos = url.searchParams.get("pos") || undefined;
  const enrich = url.searchParams.get("enrich") !== "false";

  if (!query) {
    sendJson(res, 400, { error: "Missing required 'query' parameter" });
    return;
  }

  try {
    const result = await fetchWiktionary({
      query,
      lang,
      preferredPos: pos,
      enrich,
    });

    const format = url.searchParams.get("format");
    if (format === "yaml") {
      const jsYaml = await import("js-yaml");
      const yamlStr = jsYaml.dump(result, { indent: 2, lineWidth: -1, noRefs: true });
      res.writeHead(200, {
        "Content-Type": "text/yaml",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(yamlStr);
    } else {
      sendJson(res, 200, result);
    }
  } catch (err: any) {
    sendJson(res, 500, { error: err.message || "Internal server error" });
  }
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(res, 200, { status: "ok", version: "1.0.0" });
    return;
  }

  if (url.pathname === "/api/fetch" && req.method === "GET") {
    await handleFetch(url, res);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`WiktionaryFetch API server running on http://localhost:${PORT}`);
  console.log(`  GET /api/fetch?query=γράφω&lang=el`);
  console.log(`  GET /api/health`);
});
