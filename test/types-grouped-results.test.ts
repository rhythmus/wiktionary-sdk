/**
 * Audit §13.10 — compile-time shape checks for GroupedLexemeResults wrappers.
 */
import { describe, it, expect, expectTypeOf, vi, beforeEach } from "vitest";
import { synonyms, mapLexemes, type GroupedLexemeResults } from "../src/convenience";
import * as api from "../src/ingress/api";
import type { FetchResult, Lexeme } from "../src/model";

vi.mock("../src/ingress/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ingress/api")>();
  return {
    ...actual,
    fetchWikitextEnWiktionary: vi.fn(),
    fetchWikidataEntity: vi.fn(),
    fetchWikidataEntityByWiktionaryTitle: vi.fn(),
    fetchWikidataEntityByWikipediaTitle: vi.fn(),
    mwFetchJson: vi.fn(),
  };
});

describe("GroupedLexemeResults typing (§13.10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchWikidataEntity).mockResolvedValue(null as any);
    vi.mocked(api.fetchWikidataEntityByWiktionaryTitle).mockResolvedValue(null as any);
    vi.mocked(api.fetchWikidataEntityByWikipediaTitle).mockResolvedValue(null as any);
    vi.mocked(api.mwFetchJson).mockResolvedValue({ parse: { text: "" } } as any);
  });
  it("mapLexemes returns GroupedLexemeResults with order and lexemes map", () => {
    const result: FetchResult = {
      schema_version: "3.0.0",
      rawLanguageBlock: "",
      lexemes: [
        {
          id: "1",
          language: "en",
          query: "x",
          type: "LEXEME",
          form: "x",
          etymology_index: 1,
          part_of_speech_heading: "Noun",
          templates: {},
          source: {
            wiktionary: {
              site: "en.wiktionary.org",
              title: "x",
              language_section: "English",
              etymology_index: 1,
              pos_heading: "Noun",
            },
          },
        } as Lexeme,
      ],
      notes: [],
    };
    const grouped = mapLexemes(result, () => [] as string[]);
    expectTypeOf(grouped).toMatchTypeOf<GroupedLexemeResults<string[]>>();
    expect(Array.isArray(grouped)).toBe(true);
    expect(grouped.order).toEqual(["1"]);
    expect(grouped.lexemes["1"].value).toEqual([]);
  });

  it("synonyms resolves to GroupedLexemeResults envelope when wiktionary is mocked", async () => {
    const wt = `==English==
===Noun===
# gloss
`;
    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue({
      exists: true,
      title: "zzz",
      wikitext: wt,
      pageprops: {},
      categories: [],
      langlinks: [],
      images: [],
      page_links: [],
      external_links: [],
      info: { last_modified: "x", length: 1, pageid: 1, lastrevid: 1 },
      pageid: 1,
    } as any);

    const g = await synonyms("zzz", "en");
    expectTypeOf(g).toMatchTypeOf<GroupedLexemeResults<string[]>>();
    expect(g.order.length).toBeGreaterThanOrEqual(0);
    expect(typeof g.lexemes).toBe("object");
  });
});
