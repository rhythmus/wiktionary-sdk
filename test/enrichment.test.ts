import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { wiktionary, interwiki, pageMetadata, isCategory, asLexemeRows } from "../src/index";
import * as api from "../src/ingress/api";

const FIXTURES_DIR = resolve(__dirname, "fixtures");

vi.mock("../src/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/index")>();
  return {
    ...actual,
    wiktionary: vi.fn(),
  };
});

vi.mock("../src/ingress/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ingress/api")>();
  return {
    ...actual,
    fetchWikitextEnWiktionary: vi.fn(),
    fetchWikidataEntity: vi.fn(),
  };
});

describe("API Enrichment", () => {
  const rows = <T>(grouped: any) => asLexemeRows(grouped) as Array<{ value: T; language: string }>;
  const mockResult = {
    metadata: {
      categories: ["Greek verbs", "Ancient Greek terms"],
      langlinks: [{ lang: "fr", title: "γράφω" }],
      info: { last_modified: "2026-03-28T00:00:00Z", length: 1234, pageid: 34918 }
    },
    lexemes: [
      {
        id: "el:γράφω#E0#verb#LEXEME",
        language: "el",
        part_of_speech_heading: "Verb",
        categories: ["Greek verbs"],
        langlinks: [{ lang: "fr", title: "γράφω" }]
      }
    ]
  };

  beforeEach(() => {
    const wikitext = readFileSync(resolve(FIXTURES_DIR, "γράφω.wikitext"), "utf-8");
    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue({
      exists: true,
      title: "γράφω",
      wikitext: wikitext.normalize("NFC"),
      pageprops: {},
      pageid: 34918,
      categories: ["Greek verbs", "Ancient Greek terms"],
      langlinks: [{ lang: "fr", title: "γράφω" }],
      info: {
        last_modified: "2026-03-28T00:00:00Z",
        length: 1234,
        pageid: 34918,
      },
    });
    vi.mocked(api.fetchWikidataEntity).mockResolvedValue(null);
  });

  it("should fetch and attach categories for a Greek word", async () => {
    vi.mocked(wiktionary).mockResolvedValue(mockResult as any);
    
    const res = await wiktionary({ query: "γράφω", lang: "el" });
    expect(res.metadata).toBeDefined();
    expect(res.metadata?.categories).toBeInstanceOf(Array);
    
    const cats = res.metadata?.categories || [];
    expect(cats).toContain("Greek verbs");
    
    const entry = res.lexemes[0];
    expect(entry.categories).toBeDefined();
    expect(entry.categories).toContain("Greek verbs");
  });

  it("should fetch interwiki langlinks", async () => {
    vi.mocked(wiktionary).mockResolvedValue(mockResult as any);
    
    const res = await interwiki("γράφω", "el");
    const r = rows<any[]>(res);
    expect(r.length).toBeGreaterThan(0);
    const frResult = r.find(x => x.value.some((l: any) => l.lang === "fr"));
    expect(frResult).toBeDefined();
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
    expect(rows<boolean>(isVerb)[0].value).toBe(true);
    
    const isNoun = await isCategory("γράφω", "nouns", "el");
    expect(rows<boolean>(isNoun)[0].value).toBe(false);
  });
});
