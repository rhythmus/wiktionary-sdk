import { describe, it, expect } from "vitest";
import {
  mapHeadingToLexicographic,
  mapHeadingToStrictPartOfSpeech,
  isLexemeSectionHeading,
  lexemeMatchesPosQuery,
  getLexicographicTaxonomyStats,
} from "../src/lexicographic-headings";
import { mapHeadingToPos } from "../src/parser";

describe("lexicographic headings", () => {
  it("maps strict PoS headings with strict_pos set", () => {
    const v = mapHeadingToLexicographic("Verb");
    expect(v).toEqual({ family: "pos", section_slug: "verb", strict_pos: "verb" });
    expect(mapHeadingToStrictPartOfSpeech("Noun")).toBe("noun");
    expect(mapHeadingToPos("Proper noun")).toBe("proper_noun");
  });

  it("maps morpheme/symbol headings with strict_pos null", () => {
    expect(mapHeadingToLexicographic("Suffix")).toEqual({
      family: "morpheme",
      section_slug: "suffix",
      strict_pos: null,
    });
    expect(mapHeadingToPos("Suffix")).toBeNull();
    expect(mapHeadingToLexicographic("Symbol")?.section_slug).toBe("symbol");
    expect(mapHeadingToStrictPartOfSpeech("Abbreviation")).toBeNull();
  });

  it("isLexemeSectionHeading matches registered headings only", () => {
    expect(isLexemeSectionHeading("Verb")).toBe(true);
    expect(isLexemeSectionHeading("Suffix")).toBe(true);
    expect(isLexemeSectionHeading("Usage notes")).toBe(false);
  });

  it("lexemeMatchesPosQuery matches section slug, strict pos, or heading", () => {
    const lex = {
      part_of_speech: null as const,
      lexicographic_section: "suffix",
      part_of_speech_heading: "Suffix",
    };
    expect(lexemeMatchesPosQuery(lex, "suffix")).toBe(true);
    expect(lexemeMatchesPosQuery(lex, "Suffix")).toBe(true);
    expect(lexemeMatchesPosQuery({ ...lex, part_of_speech: "noun" }, "noun")).toBe(true);
  });

  it("taxonomy stats are internally consistent", () => {
    const s = getLexicographicTaxonomyStats();
    expect(s.heading_count).toBeGreaterThan(40);
    expect(s.distinct_section_slugs).toBeGreaterThan(20);
    const sum = Object.values(s.by_family).reduce((a, b) => a + b, 0);
    expect(sum).toBe(s.heading_count);
  });
});
