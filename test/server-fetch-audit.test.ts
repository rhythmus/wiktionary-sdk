/**
 * Audit §13.13 — HTTP fetch handler behaviour (no listening server).
 */
import { describe, it, expect, vi } from "vitest";
import { buildApiFetchResponse } from "../src/ingress/server-fetch";
import type { FetchResult } from "../src/model";

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

  it("forwards matchMode, sort, debugDecoders, and concurrency to wiktionaryFn", async () => {
    const stub = vi.fn().mockResolvedValue({
      schema_version: "3.0.0",
      rawLanguageBlock: "",
      lexemes: [],
      notes: [],
    } satisfies FetchResult);
    await buildApiFetchResponse(
      new URL(
        "http://localhost/api/fetch?query=dog&lang=en&matchMode=fuzzy&sort=priority&debugDecoders=true&lemmaFetchConcurrency=2&formOfParseConcurrency=3",
      ),
      { wiktionaryFn: stub as any },
    );
    expect(stub).toHaveBeenCalledWith(
      expect.objectContaining({
        matchMode: "fuzzy",
        sort: "priority",
        debugDecoders: true,
        lemmaFetchConcurrency: 2,
        formOfParseConcurrency: 3,
      }),
    );
  });

  it("maps legacy pos= to preferredPos and uses filterPos for pos filter", async () => {
    const stub = vi.fn().mockResolvedValue({
      schema_version: "3.0.0",
      rawLanguageBlock: "",
      lexemes: [],
      notes: [],
    } satisfies FetchResult);
    await buildApiFetchResponse(new URL("http://localhost/api/fetch?query=dog&lang=en&pos=verb"), {
      wiktionaryFn: stub as any,
    });
    expect(stub).toHaveBeenCalledWith(
      expect.objectContaining({ pos: "Auto", preferredPos: "verb" }),
    );

    stub.mockClear();
    await buildApiFetchResponse(
      new URL("http://localhost/api/fetch?query=dog&lang=en&filterPos=noun&preferredPos=verb"),
      { wiktionaryFn: stub as any },
    );
    expect(stub).toHaveBeenCalledWith(
      expect.objectContaining({ pos: "noun", preferredPos: "verb" }),
    );
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
