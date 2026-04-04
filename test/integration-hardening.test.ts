import { describe, it, expect, vi } from "vitest";
import { mapHeadingToPos } from "../src/parser";
import {
  expandDualPersonInflectionLine,
  format,
  formatFetchResult,
  formOfMorphInlinePhrase,
  formOfMorphMergedProseLine,
  formOfLabelDisplayLower,
  formOfUltraCompactEligible,
  hasFormOfMorphBullets,
  inflectionMorphBulletItems,
  inflectionMorphDisplayLines,
} from "../src/formatter";
import type { Lexeme } from "../src/types";

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

describe("hardening: inflection morph display lines", () => {
  it("expands first/third-person combined labels into two lines", () => {
    expect(expandDualPersonInflectionLine("first/third-person singular present subjunctive")).toEqual([
      "first-person singular present subjunctive",
      "third-person singular present subjunctive",
    ]);
    expect(expandDualPersonInflectionLine("third-person singular imperative")).toEqual([
      "third-person singular imperative",
    ]);
  });

  it("prefers definition subsenses over form_of tags", () => {
    const entry = {
      senses: [
        {
          id: "S0",
          gloss: "inflection of sensar",
          subsenses: [
            { gloss: "first/third-person singular present subjunctive" },
            { gloss: "third-person singular imperative" },
          ],
        },
      ],
      form_of: { lemma: "sensar", tags: ["should-not-win"] },
    } as unknown as Lexeme;
    expect(inflectionMorphDisplayLines(entry)).toEqual([
      "first-person singular present subjunctive",
      "third-person singular present subjunctive",
      "third-person singular imperative",
    ]);
  });

  it("falls back to form_of tags when there are no subsenses", () => {
    const entry = {
      senses: [{ id: "S0", gloss: "verb form of foo" }],
      form_of: { lemma: "foo", tags: ["first/third-person singular present"] },
    } as unknown as Lexeme;
    expect(inflectionMorphDisplayLines(entry)).toEqual([
      "first-person singular present",
      "third-person singular present",
    ]);
  });

  it("collapses abbrev-only form_of tags to inline phrase (no bullets)", () => {
    const entry = {
      headword: "sense",
      senses: [{ id: "S0", gloss: "participle of sensus" }],
      form_of: { lemma: "sensus", tags: ["voc", "m", "s"] },
    } as unknown as Lexeme;
    expect(formOfMorphInlinePhrase(entry)).toBe("vocative singular");
    expect(inflectionMorphDisplayLines(entry)).toEqual([]);
  });

  it("uses bullet list only when merged prose is empty (e.g. unrelated morph lines)", () => {
    const three = {
      senses: [
        {
          id: "S0",
          gloss: "x",
          subsenses: [{ gloss: "a" }, { gloss: "b" }, { gloss: "c" }],
        },
      ],
      form_of: { lemma: "y" },
    } as unknown as Lexeme;
    expect(formOfMorphMergedProseLine(three)).toBe("a · b · c");
    expect(hasFormOfMorphBullets(three)).toBe(false);
    expect(inflectionMorphBulletItems(three).length).toBe(0);

    const one = {
      senses: [{ id: "S0", gloss: "x", subsenses: [{ gloss: "ing-form" }] }],
      form_of: { lemma: "write" },
    } as unknown as Lexeme;
    expect(hasFormOfMorphBullets(one)).toBe(false);
    expect(inflectionMorphBulletItems(one).length).toBe(0);
  });

  it("renders merged morph phrase in HTML for multi-line form_of subsenses", () => {
    const html = format(
      {
        headword: "sense",
        pos: "verb",
        form_of: { lemma: "sensar", label: "inflection of sensar" },
        senses: [
          {
            id: "S0",
            gloss: "inflection of sensar",
            subsenses: [
              { gloss: "first/third-person singular present subjunctive" },
              { gloss: "third-person singular imperative" },
            ],
          },
        ],
        source: {
          site: "en.wiktionary.org",
          title: "sense",
          language_section: "Spanish",
          etymology_index: 0,
          pos_heading: "Verb",
        },
      },
      { mode: "html-fragment" }
    );
    expect(html).toContain("form-of-merged-morph");
    expect(html).not.toContain("form-of-morph-lines");
    expect(html).toContain("first and third person singular present subjunctive");
    expect(html).toMatch(/first and third person singular present subjunctive · third-person singular imperative/);
  });

  it("merges Spanish-style first/third hyphen morph lines", () => {
    const entry = {
      form_of: { lemma: "hablar" },
      senses: [
        {
          id: "S0",
          gloss: "verb form of hablar",
          subsenses: [
            { id: "ss1", gloss: "first-person singular imperfect subjunctive" },
            { id: "ss2", gloss: "third-person singular imperfect subjunctive" },
          ],
        },
      ],
    } as unknown as Lexeme;
    expect(formOfMorphMergedProseLine(entry)).toBe(
      "first and third person singular imperfect subjunctive"
    );
  });

  it("merges English spaced first/third person lines with or", () => {
    const entry = {
      form_of: { lemma: "be" },
      senses: [
        {
          id: "S0",
          gloss: "past of be",
          subsenses: [
            { id: "a", gloss: "first person singular past indicative" },
            { id: "b", gloss: "third person singular past indicative" },
          ],
        },
      ],
    } as unknown as Lexeme;
    expect(formOfMorphMergedProseLine(entry)).toBe("first or third person singular past indicative");
  });

  it("renders inline vocative phrase for abbrev tags in HTML (no morph list)", () => {
    const html = format(
      {
        headword: "sense",
        pos: "participle",
        senses: [{ id: "S0", gloss: "participle of sensus" }],
        form_of: { lemma: "sensus", label: "participle of sensus", tags: ["voc", "m", "s"] },
        source: {
          site: "en.wiktionary.org",
          title: "sense",
          language_section: "Latin",
          etymology_index: 0,
          pos_heading: "Participle",
        },
      } as unknown as Lexeme,
      { mode: "html-fragment" }
    );
    expect(html).toContain("form-of-inline-morph");
    expect(html).toContain("vocative singular");
    expect(html).not.toContain("form-of-morph-lines");
  });

  it("renders single morph gloss inline (no ul)", () => {
    const html = format(
      {
        headword: "writing",
        pos: "verb",
        senses: [{ id: "S0", gloss: "ing-form of write", subsenses: [{ gloss: "ing-form" }] }],
        form_of: { lemma: "write", label: "ing-form of" },
        source: {
          site: "en.wiktionary.org",
          title: "writing",
          language_section: "English",
          etymology_index: 0,
          pos_heading: "Verb",
        },
      } as unknown as Lexeme,
      { mode: "html-fragment" }
    );
    expect(html).toContain("form-of-compact-line");
    expect(html).toContain("ing-form");
    expect(html).not.toContain("form-of-morph-lines");
  });

  it("lowercases form_of label on compact headline", () => {
    const entry = {
      form_of: { lemma: "sens", label: "Plural of" },
    } as unknown as Lexeme;
    expect(formOfLabelDisplayLower(entry)).toBe("plural of");
  });

  it("enables ultra-compact inflected HTML for single gloss (L-05)", () => {
    const lex = {
      id: "en:cats#1",
      type: "INFLECTED_FORM",
      form: "cats",
      language: "en",
      part_of_speech: "noun",
      form_of: {
        lemma: "cat",
        label: "Plural of",
        lang: "en",
        tags: [],
        named: {},
        template: "inflection of",
      },
      senses: [{ id: "S1", gloss: "Domesticated felid" }],
      source: {
        wiktionary: {
          site: "en.wiktionary.org",
          title: "cats",
          language_section: "English",
          etymology_index: 1,
          pos_heading: "Noun",
        },
      },
    } as unknown as Lexeme;
    expect(formOfUltraCompactEligible(lex)).toBe(true);
    const html = format(lex, { mode: "html-fragment" });
    expect(html).toContain("form-of-ultra-compact-line");
    expect(html).toContain("plural of:");
    expect(html).toContain("Domesticated felid");
    expect(html).not.toContain("form-of-lemma-row");
  });
});

describe("hardening: FetchResult HTML (homonym merge + empty)", () => {
  const source = (i: number) => ({
    wiktionary: {
      site: "en.wiktionary.org",
      title: "bank",
      language_section: "English",
      etymology_index: i,
      pos_heading: "Noun",
    },
  });

  it("merges consecutive homonym lexemes into one HTML card", () => {
    const html = formatFetchResult(
      {
        schema_version: "3.0.0",
        rawLanguageBlock: "",
        notes: [],
        lexemes: [
          {
            id: "a",
            type: "LEXEME",
            form: "bank",
            language: "en",
            part_of_speech: "noun",
            etymology_index: 1,
            etymology: { chain: [{ template: "inh", relation: "inherited", source_lang: "enm", term: "banke" }] },
            senses: [{ id: "s1", gloss: "slope of earth" }],
            templates: {},
            source: source(1),
          } as unknown as Lexeme,
          {
            id: "b",
            type: "LEXEME",
            form: "bank",
            language: "en",
            part_of_speech: "noun",
            etymology_index: 2,
            etymology: { chain: [{ template: "der", relation: "derived", source_lang: "fr", term: "banque" }] },
            senses: [{ id: "s2", gloss: "financial institution" }],
            templates: {},
            source: source(2),
          } as unknown as Lexeme,
        ],
      },
      { mode: "html-fragment" }
    );
    expect(html).toContain("wiktionary-entry-homonym-group");
    expect(html).toContain("slope of earth");
    expect(html).toContain("financial institution");
    expect(html.match(/class="lemma"/g)?.length).toBe(1);
  });

  it("shows empty-result banner when lexemes array is empty", () => {
    const html = formatFetchResult(
      {
        schema_version: "3.0.0",
        rawLanguageBlock: "",
        notes: ["No page found"],
        lexemes: [],
      },
      { mode: "html-fragment" }
    );
    expect(html).toContain("wiktionary-fetch-notes");
    expect(html).toContain("wiktionary-fetch-empty");
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

