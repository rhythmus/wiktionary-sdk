/**
 * Playground execute (invalid JSON + invoke errors + `wiktionary` direct path) without DOM.
 */
import { describe, it, expect, vi } from "vitest";
import { runPlaygroundApiExecute } from "../../webapp/src/playground-api-execute";
import * as Engine from "../../src/index";

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

  it("wiktionary calls library entrypoint and ignores invalid apiProps JSON", async () => {
    const spy = vi.spyOn(Engine, "wiktionary").mockResolvedValue({
      schema_version: "test",
      lexemes: [],
      notes: [],
      rawLanguageBlock: "",
    } as Awaited<ReturnType<typeof Engine.wiktionary>>);
    const out = await runPlaygroundApiExecute({
      apiMethod: "wiktionary",
      apiPropsRaw: "{not-json",
      query: "x",
      lang: "en",
      prefPos: "Auto",
      apiMethods: {},
      matchMode: "strict",
      debugDecoders: true,
      sort: { strategy: "priority", priorities: { grc: 1, el: 2 } },
    });
    expect(out.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "x",
        lang: "en",
        pos: "Auto",
        enrich: true,
        matchMode: "strict",
        debugDecoders: true,
        sort: { strategy: "priority", priorities: { grc: 1, el: 2 } },
      }),
    );
    spy.mockRestore();
  });
});
