/**
 * Audit §13.5 — parser edge cases (implicit etymology, heading tolerance).
 */
import { describe, it, expect } from "vitest";
import { splitEtymologiesAndPOS, extractLanguageSection } from "../src/parser";

describe("parser audit (§13.5)", () => {
  it("builds implicit etymology slice when no ===Etymology=== heading precedes PoS", () => {
    const langBlock = `==Greek==
===Verb===
# only verb
`;
    const etyms = splitEtymologiesAndPOS(langBlock);
    expect(etyms.length).toBeGreaterThanOrEqual(1);
    expect(etyms[0].posBlocks.length).toBe(1);
    expect(etyms[0].posBlocks[0].posHeading).toBe("Verb");
    expect(etyms[0].posBlocks[0].wikitext).toContain("# only verb");
  });

  it("uses (unknown) bucket when no PoS headings exist (§13.5 fallback)", () => {
    const langBlock = `==Greek==
Some preamble without headings.
`;
    const etyms = splitEtymologiesAndPOS(langBlock);
    expect(etyms.length).toBe(1);
    expect(etyms[0].idx).toBe(0);
    expect(etyms[0].posBlocks[0].posHeading).toBe("(unknown)");
  });

  it("extractLanguageSection tolerates flexible equals in level-2 header", () => {
    const wiki = `==  English  ==
===Noun===
# test
==French==
# other
`;
    const block = extractLanguageSection(wiki, "English");
    expect(block).toBeTruthy();
    expect(block).toContain("===Noun===");
    expect(block).not.toContain("French");
  });
});
