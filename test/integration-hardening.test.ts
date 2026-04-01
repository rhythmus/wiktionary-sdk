import { describe, it, expect, vi } from "vitest";
import { mapHeadingToPos } from "../src/parser";
import { format } from "../src/formatter";

describe("hardening: rare PoS heading normalization", () => {
  it("maps rare headings to normalized part_of_speech values", () => {
    const cases: Array<[string, string]> = [
      ["Interjection", "interjection"],
      ["Symbol", "symbol"],
      ["Abbreviation", "abbreviation"],
      ["Initialism", "initialism"],
      ["Acronym", "acronym"],
      ["Letter", "letter"],
      ["Contraction", "contraction"],
      ["Idiom", "idiom"],
      ["Proverb", "proverb"],
    ];
    for (const [heading, expected] of cases) {
      expect(mapHeadingToPos(heading)).toBe(expected);
    }
  });
});

describe("hardening: formatter undefined artifact prevention", () => {
  it("does not render literal 'undefined' for sparse etymology links", () => {
    const output = format(
      {
        headword: "logo",
        pos: "noun",
        etymology: {
          chain: [
            { source_lang: "logogram", raw: "{{foo}}" },
            { source_lang: "grc", term: "λόγος", raw: "{{der|en|grc|λόγος}}" },
          ],
        },
        senses: [{ id: "S1", gloss: "mark" }],
        source: {
          site: "en.wiktionary.org",
          title: "logo",
          language_section: "English",
          etymology_index: 1,
          pos_heading: "Noun",
        },
      },
      { mode: "ansi" }
    );
    expect(output).not.toContain("undefined");
    expect(output).toContain("λόγος");
  });
});

describe("hardening: CLI extract routing contract", () => {
  it("routes wrapper signatures correctly via invokeExtractWrapper", async () => {
    vi.mock("../src/index", () => ({
      translate: vi.fn(async (...args: any[]) => ({ fn: "translate", args })),
      wikipediaLink: vi.fn(async (...args: any[]) => ({ fn: "wikipediaLink", args })),
      isInstance: vi.fn(async (...args: any[]) => ({ fn: "isInstance", args })),
      conjugate: vi.fn(async (...args: any[]) => ({ fn: "conjugate", args })),
      hyphenate: vi.fn(async (...args: any[]) => ({ fn: "hyphenate", args })),
      richEntry: vi.fn(async (...args: any[]) => ({ fn: "richEntry", args })),
      wiktionary: vi.fn(),
      format: vi.fn(),
    }));

    const { invokeExtractWrapper } = await import("../cli/index");
    const opts = { lang: "el" as any, targetLang: "en", props: { qid: "Q5", x: 1 }, preferredPos: "noun" };

    const a = await invokeExtractWrapper("translate", "logos", opts);
    expect(a.args).toEqual(["logos", "el", "en", { qid: "Q5", x: 1 }, "noun"]);

    const b = await invokeExtractWrapper("wikipediaLink", "logos", opts);
    expect(b.args).toEqual(["logos", "el", "en", "noun"]);

    const c = await invokeExtractWrapper("isInstance", "logos", opts);
    expect(c.args).toEqual(["logos", "Q5", "el"]);

    const d = await invokeExtractWrapper("conjugate", "γράφω", opts);
    expect(d.args).toEqual(["γράφω", "el", { qid: "Q5", x: 1 }]);

    const e = await invokeExtractWrapper("hyphenate", "λόγος", opts);
    expect(e.args).toEqual(["λόγος", "el", { qid: "Q5", x: 1 }, "noun"]);

    const f = await invokeExtractWrapper("richEntry", "logos", opts);
    expect(f.args).toEqual(["logos", "el", "noun"]);
  });
});

