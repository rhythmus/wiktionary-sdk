import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { format } from "../src/formatter";

describe("integration adapters: formatter/cli/webapp contracts", () => {
  it("formats wrapper row arrays without object stringification", () => {
    const wrapperRows = [
      {
        lexeme_id: "en:logos#E1#noun#LEXEME",
        language: "en",
        pos: "Noun",
        etymology_index: 1,
        value: {
          headword: "logos",
          pos: "noun",
          type: "LEXEME",
          senses: [{ id: "S1", gloss: "word, discourse" }],
        },
      },
      {
        lexeme_id: "grc:λόγος#E1#noun#LEXEME",
        language: "grc",
        pos: "Noun",
        etymology_index: 1,
        value: {
          headword: "λόγος",
          pos: "noun",
          type: "LEXEME",
          senses: [{ id: "S1", gloss: "word, reason" }],
        },
      },
    ];

    const ansi = format(wrapperRows, { mode: "ansi" });
    const text = format(wrapperRows, { mode: "text" });

    expect(ansi).toContain("[1]");
    expect(ansi).toContain("en:logos#E1#noun#LEXEME");
    expect(text).toContain("[2]");
    expect(text).toContain("grc:λόγος#E1#noun#LEXEME");
    expect(ansi).not.toContain("[object Object]");
    expect(text).not.toContain("[object Object]");
  });

  it("handles malformed wrapper-like payloads without throwing", () => {
    const oddRows = [
      {
        lexeme_id: "x:1",
        language: "x",
        pos: "unknown",
        value: { nested: { a: 1 }, list: [1, 2, 3] },
      },
      {
        lexeme_id: "x:2",
        language: "x",
        pos: "unknown",
        value: null,
      },
    ];

    const out = format(oddRows, { mode: "ansi" });
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toContain("[object Object]");
  });

  it("keeps webapp API playground method surface in sync", () => {
    const appPath = resolve(__dirname, "../webapp/src/App.tsx");
    const appText = readFileSync(appPath, "utf-8");

    const mustExist = [
      "richEntry",
      "lemma",
      "ipa",
      "pronounce",
      "hyphenate",
      "synonyms",
      "antonyms",
      "hypernyms",
      "hyponyms",
      "comeronyms",
      "parasynonyms",
      "collocations",
      "etymology",
      "stem",
      "morphology",
      "conjugate",
      "decline",
      "wikidataQid",
      "wikipediaLink",
      "image",
      "partOfSpeech",
      "usageNotes",
      "translate",
      "rhymes",
      "homophones",
      "syllableCount",
      "allImages",
      "audioGallery",
      "exampleDetails",
      "externalLinks",
      "internalLinks",
      "isInstance",
      "isSubclass",
      "alternativeForms",
      "seeAlso",
      "anagrams",
      "citations",
      "descendants",
      "referencesSection",
      "etymologyChain",
      "etymologyCognates",
      "etymologyText",
      "categories",
      "langlinks",
      "inflectionTableRef",
      "gender",
      "transitivity",
    ];

    for (const method of mustExist) {
      expect(appText.includes(method)).toBe(true);
    }
  });
});

