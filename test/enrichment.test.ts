import { describe, it, expect, vi } from "vitest";
import { wiktionary, interwiki, pageMetadata, isCategory } from "../src/index";
import * as indexModule from "../src/index";

// Mock the main wiktionary function
vi.mock("../src/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/index")>();
  return {
    ...actual,
    wiktionary: vi.fn(),
  };
});

describe("API Enrichment", () => {
  const mockResult = {
    metadata: {
      categories: ["Greek verbs", "Ancient Greek terms"],
      langlinks: [{ lang: "fr", title: "γράφω" }],
      info: { last_modified: "2026-03-28T00:00:00Z", length: 1234, pageid: 34918 }
    },
    entries: [
      {
        id: "el:γράφω#E0#verb#LEXEME",
        language: "el",
        categories: ["Greek verbs"]
      }
    ]
  };

  it("should fetch and attach categories for a Greek word", async () => {
    vi.mocked(wiktionary).mockResolvedValue(mockResult as any);
    
    const res = await wiktionary({ query: "γράφω", lang: "el" });
    expect(res.metadata).toBeDefined();
    expect(res.metadata?.categories).toBeInstanceOf(Array);
    
    // Check global metadata
    const cats = res.metadata?.categories || [];
    expect(cats).toContain("Greek verbs");
    
    // Check entry-specific categories
    const entry = res.entries[0];
    expect(entry.categories).toBeDefined();
    expect(entry.categories).toContain("Greek verbs");
  });

  it("should fetch interwiki langlinks", async () => {
    vi.mocked(wiktionary).mockResolvedValue(mockResult as any);
    
    const res = await interwiki("γράφω", "el");
    expect(res).toBeInstanceOf(Array);
    expect(res.length).toBeGreaterThan(0);
    const fr = res.find(l => l.lang === "fr");
    expect(fr).toBeDefined();
    expect(fr?.title).toBeDefined();
  });

  it("should fetch page metadata (info)", async () => {
    vi.mocked(wiktionary).mockResolvedValue(mockResult as any);
    
    const meta = await pageMetadata("γράφω", "el");
    expect(meta).toBeDefined();
    expect(meta.last_modified).toBeDefined();
    expect(meta.length).toBeGreaterThan(0);
    expect(meta.pageid).toBeDefined();
  });

  it("should verify category membership with isCategory", async () => {
    vi.mocked(wiktionary).mockResolvedValue(mockResult as any);
    
    const isVerb = await isCategory("γράφω", "verbs", "el");
    expect(isVerb).toBe(true);
    
    const isNoun = await isCategory("γράφω", "nouns", "el");
    expect(isNoun).toBe(false);
  });
});
