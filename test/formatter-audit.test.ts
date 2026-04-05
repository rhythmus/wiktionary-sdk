/**
 * Audit §13.9 — formatFetchResult, homonym grouping, morph helpers.
 */
import { describe, it, expect } from "vitest";
import { expandDualPersonInflectionLine, formatFetchResult, format } from "../src/present/formatter";
import { groupLexemesForIntegratedHomonyms } from "../src/present/lexeme-display-groups";
import type { FetchResult, Lexeme } from "../src/model";
import type { WordStems } from "../src/convenience/stem";

function minimalLexeme(over: Partial<Lexeme>): Lexeme {
  return {
    id: "x",
    language: "en",
    query: "q",
    type: "LEXEME",
    form: "bank",
    etymology_index: 1,
    part_of_speech_heading: "Noun",
    lexicographic_section: "noun",
    lexicographic_family: "pos",
    part_of_speech: "noun",
    templates: {},
    source: {
      wiktionary: {
        site: "en.wiktionary.org",
        title: "bank",
        language_section: "English",
        etymology_index: 1,
        pos_heading: "Noun",
      },
    },
    ...over,
  } as Lexeme;
}

describe("formatter audit: expandDualPersonInflectionLine", () => {
  it("splits first/third-person combined glosses", () => {
    expect(expandDualPersonInflectionLine("first/third-person singular present")).toEqual([
      "first-person singular present",
      "third-person singular present",
    ]);
  });

  it("returns single-element array for non-matching lines", () => {
    expect(expandDualPersonInflectionLine("plural of foo")).toEqual(["plural of foo"]);
  });
});

describe("formatter audit: groupLexemesForIntegratedHomonyms (consecutive-only)", () => {
  it("merges only consecutive homonyms with same lang+form+pos", () => {
    const a = minimalLexeme({ id: "a", etymology_index: 1 });
    const noise = minimalLexeme({ id: "m", type: "INFLECTED_FORM", etymology_index: 0 });
    const b = minimalLexeme({ id: "b", etymology_index: 2 });
    const groups = groupLexemesForIntegratedHomonyms([a, noise, b]);
    expect(groups.length).toBe(3);
    expect(groups.every((g) => g.type === "single")).toBe(true);
  });

  it("groups two consecutive LEXEME rows with different etymology_index", () => {
    const a = minimalLexeme({ id: "a", etymology_index: 1 });
    const b = minimalLexeme({ id: "b", etymology_index: 2 });
    const groups = groupLexemesForIntegratedHomonyms([a, b]);
    expect(groups.length).toBe(1);
    expect(groups[0].type).toBe("homonym");
    expect(groups[0].items).toHaveLength(2);
  });
});

describe("formatter audit: formatFetchResult", () => {
  const base: FetchResult = {
    schema_version: "3.0.0",
    rawLanguageBlock: "",
    lexemes: [],
    notes: [],
  };

  it("includes notes in html-fragment output", () => {
    const html = formatFetchResult(
      { ...base, notes: ["Redirected from X."], lexemes: [] },
      { mode: "html-fragment" }
    );
    expect(html).toContain("wiktionary-fetch-notes");
    expect(html).toContain("Redirected from X.");
  });

  it("renders empty-state banner when lexemes empty", () => {
    const html = formatFetchResult({ ...base, lexemes: [] }, { mode: "html-fragment" });
    expect(html).toContain("wiktionary-fetch-empty");
  });
});

describe("formatter audit: GroupedLexemeResults branch in format() (§13.9)", () => {
  it("formats wrapper row arrays with lexeme_id + value", () => {
    const rows = [
      { lexeme_id: "en:x#1", language: "en", pos: "noun", etymology_index: 1, value: ["a", "b"] },
    ];
    const out = format(rows, { mode: "text" });
    expect(out).toContain("[1]");
    expect(out).toContain("en:x#1");
    expect(out).toContain("a");
  });

  it("appends LexemeResult.support_warning after formatted value (text + html)", () => {
    const rows = [
      {
        lexeme_id: "el:test#1",
        language: "el",
        pos: "verb",
        etymology_index: 0,
        value: [],
        support_warning: "Decoder gap: syn templates present but list empty.",
      },
    ];
    expect(format(rows, { mode: "text" })).toContain("Support:");
    expect(format(rows, { mode: "text" })).toContain("Decoder gap");
    const html = format(rows, { mode: "html-fragment" });
    expect(html).toContain("stem-support-warning");
    expect(html).toContain("Decoder gap");
  });

  it("includes stem support_warning after Stems line (text + ansi)", () => {
    const sample: WordStems = {
      aliases: [],
      support_warning: "Empty output reflects SDK template coverage, not missing wikitext.",
    };
    expect(format(sample, { mode: "text" })).toContain("Support:");
    expect(format(sample, { mode: "text" })).toContain("SDK template coverage");
    expect(format(sample, { mode: "ansi" })).toContain("Support:");
  });
});
