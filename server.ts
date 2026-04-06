/**
 * Lightweight HTTP API wrapper for the Wiktionary SDK engine.
 *
 * GET /api/fetch?query=<term>&lang=<code>&pos=<legacy preferredPos>&filterPos=<pos filter>&preferredPos=<...>&matchMode=strict|fuzzy&sort=source|priority&langPriorities=el=1,grc=2&debugDecoders=true&enrich=<bool>&format=<yaml|json>
 * GET /api/health
 *
 * Run:  npx tsx server.ts
 * Or:   node dist/esm/server.js  (after build)
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { buildApiFetchResponse } from "./src/ingress/server-fetch";

const PORT = parseInt(process.env.PORT || "3000", 10);

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data, null, 2));
}

async function handleFetch(url: URL, res: ServerResponse): Promise<void> {
  const r = await buildApiFetchResponse(url);
  res.writeHead(r.status, r.headers);
  res.end(r.body);
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
  console.log(`Wiktionary SDK API server running on http://localhost:${PORT}`);
  console.log(`  GET /api/fetch?query=γράφω&lang=el`);
  console.log(`  GET /api/health`);
});
