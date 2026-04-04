/**
 * Audit §13.13 — HTTP fetch handler behaviour (no listening server).
 */
import { describe, it, expect, vi } from "vitest";
import { buildApiFetchResponse } from "../src/server-fetch";
import type { FetchResult } from "../src/types";

describe("buildApiFetchResponse", () => {
  it("returns 400 JSON when query is missing", async () => {
    const r = await buildApiFetchResponse(new URL("http://localhost/api/fetch"), {
      wiktionaryFn: vi.fn() as any,
    });
    expect(r.status).toBe(400);
    expect(r.headers["Content-Type"]).toContain("application/json");
    expect(JSON.parse(r.body).error).toMatch(/Missing required/);
  });

  it("returns 200 JSON when wiktionary succeeds", async () => {
    const stub: FetchResult = {
      schema_version: "3.0.0",
      rawLanguageBlock: "",
      lexemes: [],
      notes: [],
    };
    const r = await buildApiFetchResponse(new URL("http://localhost/api/fetch?query=dog&lang=en"), {
      wiktionaryFn: vi.fn().mockResolvedValue(stub) as any,
    });
    expect(r.status).toBe(200);
    expect(r.headers["Content-Type"]).toContain("application/json");
    expect(JSON.parse(r.body).lexemes).toEqual([]);
  });

  it("returns YAML content-type when format=yaml", async () => {
    const stub: FetchResult = {
      schema_version: "3.0.0",
      rawLanguageBlock: "x",
      lexemes: [],
      notes: [],
    };
    const r = await buildApiFetchResponse(
      new URL("http://localhost/api/fetch?query=dog&lang=en&format=yaml"),
      { wiktionaryFn: vi.fn().mockResolvedValue(stub) as any }
    );
    expect(r.status).toBe(200);
    expect(r.headers["Content-Type"]).toContain("text/yaml");
    expect(r.body).toContain("schema_version");
  });

  it("returns 500 when wiktionary throws", async () => {
    const r = await buildApiFetchResponse(new URL("http://localhost/api/fetch?query=x&lang=en"), {
      wiktionaryFn: vi.fn().mockRejectedValue(new Error("boom")) as any,
    });
    expect(r.status).toBe(500);
    expect(JSON.parse(r.body).error).toBe("boom");
  });
});
