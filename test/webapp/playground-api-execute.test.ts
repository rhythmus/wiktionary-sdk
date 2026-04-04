/**
 * Audit §13.12 — playground execute (invalid JSON + invoke errors) without DOM.
 */
import { describe, it, expect, vi } from "vitest";
import { runPlaygroundApiExecute } from "../../webapp/src/playground-api-execute";

describe("runPlaygroundApiExecute", () => {
  const apiMethods = {
    stem: vi.fn().mockResolvedValue({ order: [], lexemes: {} }),
  };

  it("returns invalid_json when apiPropsRaw is not valid JSON", async () => {
    const out = await runPlaygroundApiExecute({
      apiMethod: "stem",
      apiPropsRaw: "{not-json",
      query: "x",
      lang: "en",
      prefPos: "Auto",
      apiMethods,
    });
    expect(out).toEqual({ ok: false, error: "invalid_json" });
    expect(apiMethods.stem).not.toHaveBeenCalled();
  });

  it("returns invoke error shape when wrapper throws", async () => {
    const boom = vi.fn().mockRejectedValue(new Error("network down"));
    const out = await runPlaygroundApiExecute({
      apiMethod: "stem",
      apiPropsRaw: "",
      query: "x",
      lang: "en",
      prefPos: "Auto",
      apiMethods: { stem: boom },
    });
    expect(out.ok).toBe(false);
    if (!out.ok && out.error === "invoke") {
      expect(out.message).toBe("network down");
      expect(out.result).toEqual({ error: "network down" });
      expect(out.formatted).toContain("network down");
    } else {
      expect.fail("expected invoke error branch");
    }
  });

  it("returns formatted terminal-html on success", async () => {
    const out = await runPlaygroundApiExecute({
      apiMethod: "stem",
      apiPropsRaw: "",
      query: "γράφω",
      lang: "el",
      prefPos: "Auto",
      apiMethods,
      invokeWrapper: async (_m, fn, q) => fn(q, "el", "Auto"),
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result).toBeDefined();
      expect(typeof out.formatted).toBe("string");
    }
  });
});
