import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { invokeWrapperMethod } from "../src/wrapper-invoke";
import { invokeExtractWrapper } from "../cli/index";
import * as SDK from "../src/index";

describe("cross-interface parity: shared wrapper invocation", () => {
  it("dispatches canonical argument order across wrapper signatures", async () => {
    const opts = {
      sourceLang: "el",
      preferredPos: "noun",
      targetLang: "en",
      props: { target: "fr", qid: "Q42", mode: "gloss" } as any,
    };

    const capture = vi.fn(async (...args: any[]) => ({ args }));

    const t = await invokeWrapperMethod("translate", capture, "logos", opts);
    expect(t.args).toEqual(["logos", "el", "fr", { target: "fr", qid: "Q42", mode: "gloss" }, "noun"]);

    const w = await invokeWrapperMethod("wikipediaLink", capture, "logos", opts);
    expect(w.args).toEqual(["logos", "el", "fr", "noun"]);

    const i = await invokeWrapperMethod("isInstance", capture, "logos", opts);
    expect(i.args).toEqual(["logos", "Q42", "el"]);

    const c = await invokeWrapperMethod("conjugate", capture, "γράφω", opts);
    expect(c.args).toEqual(["γράφω", "el", { target: "fr", qid: "Q42", mode: "gloss" }]);

    const h = await invokeWrapperMethod("hyphenate", capture, "λόγος", opts);
    expect(h.args).toEqual(["λόγος", "el", { target: "fr", qid: "Q42", mode: "gloss" }, "noun"]);
  });

  it("keeps CLI extraction route parity with shared helper", async () => {
    const spy = vi.spyOn(SDK, "translate").mockImplementation(async (...args: any[]) => ({ args } as any));

    const out = await invokeExtractWrapper("translate", "logos", {
      lang: "el",
      targetLang: "en",
      props: { target: "de", mode: "gloss" },
      preferredPos: "noun",
    } as any);

    expect(out.args).toEqual(["logos", "el", "de", { target: "de", mode: "gloss" }, "noun"]);
    spy.mockRestore();
  });

  it("ensures webapp playground uses shared invocation helper", () => {
    const appPath = resolve(__dirname, "../webapp/src/App.tsx");
    const appText = readFileSync(appPath, "utf-8");
    expect(appText.includes("invokeWrapperMethod(apiMethod, fn, query")).toBe(true);
  });
});

