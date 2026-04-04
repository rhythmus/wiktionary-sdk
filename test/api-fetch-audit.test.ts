/**
 * Audit §13.2 — mwFetchJson and normalizeWiktionaryQueryPage edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mwFetchJson, normalizeWiktionaryQueryPage } from "../src/api";
import { RateLimiter } from "../src/rate-limiter";

describe("api audit: normalizeWiktionaryQueryPage", () => {
  it("treats missing revision slots as empty wikitext", () => {
    const page = {
      title: "Ghost",
      missing: false,
      pageid: 42,
      revisions: [{}],
    };
    const r = normalizeWiktionaryQueryPage(page, "Ghost");
    expect(r.exists).toBe(true);
    expect(r.wikitext).toBe("");
    expect(r.title).toBe("Ghost");
  });

  it("maps absent categories and links to empty arrays", () => {
    const page = {
      title: "Bare",
      revisions: [{ slots: { main: { content: "x" } } }],
    };
    const r = normalizeWiktionaryQueryPage(page, "Bare");
    expect(r.categories).toEqual([]);
    expect(r.langlinks).toEqual([]);
    expect(r.images).toEqual([]);
    expect(r.page_links).toEqual([]);
    expect(r.external_links).toEqual([]);
  });
});

describe("api audit: mwFetchJson", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.spyOn(RateLimiter.prototype, "throttle").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("returns parsed JSON on HTTP 200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, x: 1 }),
    }) as any;

    const j = await mwFetchJson("https://example.invalid/api.php", { action: "query" });
    expect(j).toEqual({ ok: true, x: 1 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("throws on non-OK HTTP status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    }) as any;

    await expect(
      mwFetchJson("https://example.invalid/api.php", { action: "query" })
    ).rejects.toThrow(/HTTP 503/);
  });

  it("aborts when timeoutMs elapses before fetch resolves", async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const s = init?.signal;
          if (!s) {
            reject(new Error("expected signal"));
            return;
          }
          const onAbort = () => reject(s.reason);
          if (s.aborted) {
            onAbort();
            return;
          }
          s.addEventListener("abort", onAbort);
        }),
    ) as any;

    await expect(
      mwFetchJson("https://example.invalid/api.php", { action: "query" }, { timeoutMs: 20 }),
    ).rejects.toThrow(/timed out/i);
  });

  it("rejects before fetch when caller signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort(new Error("user cancelled"));
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as any;

    await expect(
      mwFetchJson("https://example.invalid/api.php", { action: "query" }, { signal: ac.signal }),
    ).rejects.toThrow(/user cancelled/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
