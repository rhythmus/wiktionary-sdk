import { describe, it, expect } from "vitest";
import {
  parseTemplates,
  extractLanguageSection,
  splitEtymologiesAndPOS,
  mapHeadingToPos,
  langToLanguageName,
  splitPipesPreservingLinks,
} from "../src/parser";

describe("parseTemplates", () => {
  it("parses a simple template", () => {
    const result = parseTemplates("{{IPA|el|/ˈɣra.fo/}}");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("IPA");
    expect(result[0].params.positional).toEqual(["el", "/ˈɣra.fo/"]);
  });

  it("parses named parameters", () => {
    const result = parseTemplates("{{t+|fr|écrire|g=m}}");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("t+");
    expect(result[0].params.positional).toEqual(["fr", "écrire"]);
    expect(result[0].params.named).toEqual({ g: "m" });
  });

  it("handles nested templates", () => {
    const result = parseTemplates("{{inflection of|el|γράφω||1|s|pres|ind|act}}");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("inflection of");
    expect(result[0].params.positional[0]).toBe("el");
    expect(result[0].params.positional[1]).toBe("γράφω");
  });

  it("parses multiple templates on one line", () => {
    const result = parseTemplates("{{el-verb}} and {{IPA|el|/ˈɣra.fo/}}");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("el-verb");
    expect(result[1].name).toBe("IPA");
  });

  it("returns empty for text without templates", () => {
    expect(parseTemplates("just plain text")).toEqual([]);
  });

  it("handles unmatched braces gracefully", () => {
    const result = parseTemplates("{{broken|template");
    expect(result).toEqual([]);
  });
});

describe("extractLanguageSection", () => {
  const sampleWikitext = `
==English==
English content here.

==Greek==
Greek content here.
===Etymology===
From {{inh|el|ine-pro|*gerbʰ-}}.

===Verb===
{{el-verb}}

# to [[write]]

==French==
French content here.
`.trim();

  it("extracts the Greek section", () => {
    const section = extractLanguageSection(sampleWikitext, "Greek");
    expect(section).not.toBeNull();
    expect(section).toContain("==Greek==");
    expect(section).toContain("el-verb");
    expect(section).not.toContain("==French==");
    expect(section).not.toContain("==English==");
  });

  it("extracts the English section", () => {
    const section = extractLanguageSection(sampleWikitext, "English");
    expect(section).not.toBeNull();
    expect(section).toContain("==English==");
    expect(section).not.toContain("==Greek==");
  });

  it("returns null for a missing language", () => {
    const section = extractLanguageSection(sampleWikitext, "German");
    expect(section).toBeNull();
  });
});

describe("splitEtymologiesAndPOS", () => {
  it("splits a section with one etymology and one POS", () => {
    const block = `==Greek==
===Etymology===
From old stuff.

===Verb===
{{el-verb}}
# to write`;

    const etyms = splitEtymologiesAndPOS(block);
    expect(etyms.length).toBeGreaterThanOrEqual(1);
    const etym = etyms[0];
    expect(etym.posBlocks.length).toBe(1);
    expect(etym.posBlocks[0].posHeading).toBe("Verb");
    expect(etym.posBlocks[0].wikitext).toContain("el-verb");
  });

  it("splits multiple etymologies", () => {
    const block = `==Greek==
===Etymology 1===
First origin.

===Noun===
{{el-noun}}
# a thing

===Etymology 2===
Second origin.

===Verb===
{{el-verb}}
# to do`;

    const etyms = splitEtymologiesAndPOS(block);
    expect(etyms).toHaveLength(2);
    expect(etyms[0].posBlocks[0].posHeading).toBe("Noun");
    expect(etyms[1].posBlocks[0].posHeading).toBe("Verb");
  });
});

describe("mapHeadingToPos", () => {
  it("maps standard headings", () => {
    expect(mapHeadingToPos("Verb")).toBe("verb");
    expect(mapHeadingToPos("Noun")).toBe("noun");
    expect(mapHeadingToPos("Adjective")).toBe("adjective");
    expect(mapHeadingToPos("Proper noun")).toBe("proper_noun");
  });

  it("returns null for unknown headings", () => {
    expect(mapHeadingToPos("Random Heading")).toBeNull();
  });
});

describe("langToLanguageName", () => {
  it("maps known codes", () => {
    expect(langToLanguageName("el")).toBe("Greek");
    expect(langToLanguageName("grc")).toBe("Ancient Greek");
    expect(langToLanguageName("en")).toBe("English");
  });

  it("returns null for unknown codes", () => {
    expect(langToLanguageName("xx")).toBeNull();
  });
});

describe("splitPipesPreservingLinks", () => {
  it("splits plain pipes", () => {
    expect(splitPipesPreservingLinks("a|b|c")).toEqual(["a", "b", "c"]);
  });

  it("preserves pipes inside wikilinks", () => {
    expect(splitPipesPreservingLinks("[[link|display]]|other")).toEqual([
      "[[link|display]]",
      "other",
    ]);
  });

  it("preserves pipes inside nested templates", () => {
    expect(splitPipesPreservingLinks("a|b|g={{g|m}}|c")).toEqual([
      "a",
      "b",
      "g={{g|m}}",
      "c",
    ]);
  });
});
