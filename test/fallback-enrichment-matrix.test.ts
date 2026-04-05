import { describe, it, expect, vi, beforeEach } from "vitest";
import { wiktionary } from "../src/index";
import * as api from "../src/ingress/api";

vi.mock("../src/ingress/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ingress/api")>();
  return {
    ...actual,
    fetchWikitextEnWiktionary: vi.fn(),
    fetchWikidataEntity: vi.fn(),
    fetchWikidataEntityByWiktionaryTitle: vi.fn(),
    fetchWikidataEntityByWikipediaTitle: vi.fn(),
  };
});

const BASE_WIKITEXT = `
== English ==
=== Noun ===
{{en-noun}}
# A domesticated canid.
`;

function mockPage(pageprops?: Record<string, any>) {
  vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue({
    exists: true,
    title: "dog",
    wikitext: BASE_WIKITEXT,
    pageprops: pageprops ?? {},
    categories: [],
    langlinks: [],
    info: { last_modified: "2026-03-31", length: 100, pageid: 1, lastrevid: 1 },
    pageid: 1,
  } as any);
}

describe("fallback/enrichment matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPage();
    vi.mocked(api.fetchWikidataEntity).mockResolvedValue(null as any);
    vi.mocked(api.fetchWikidataEntityByWiktionaryTitle).mockResolvedValue(null as any);
    vi.mocked(api.fetchWikidataEntityByWikipediaTitle).mockResolvedValue(null as any);
  });

  it("uses pageprops wikibase_item directly when present", async () => {
    mockPage({ wikibase_item: "Q144" });
    vi.mocked(api.fetchWikidataEntity).mockResolvedValue({
      labels: { en: { language: "en", value: "dog" } },
      sitelinks: { enwiki: { site: "enwiki", title: "Dog" } },
      claims: {},
    } as any);

    const res = await wiktionary({ query: "dog", lang: "en", enrich: true });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");
    expect(lex?.wikidata?.qid).toBe("Q144");
    expect(api.fetchWikidataEntityByWiktionaryTitle).not.toHaveBeenCalled();
    expect(api.fetchWikidataEntityByWikipediaTitle).not.toHaveBeenCalled();
    expect(api.fetchWikidataEntity).toHaveBeenCalledWith("Q144");
  });

  it("falls back to Wiktionary title entity lookup when pageprops missing", async () => {
    vi.mocked(api.fetchWikidataEntityByWiktionaryTitle).mockResolvedValue({
      id: "Q144",
      labels: { en: { language: "en", value: "dog" } },
      claims: {},
    } as any);

    const res = await wiktionary({ query: "dog", lang: "en", enrich: true });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");
    expect(lex?.wikidata?.qid).toBe("Q144");
    expect(api.fetchWikidataEntityByWiktionaryTitle).toHaveBeenCalledWith("dog");
    expect(api.fetchWikidataEntityByWikipediaTitle).not.toHaveBeenCalled();
    // resolved fallback entity should be reused without another fetch by qid
    expect(api.fetchWikidataEntity).not.toHaveBeenCalled();
  });

  it("falls back to Wikipedia title lookup when Wiktionary fallback misses", async () => {
    vi.mocked(api.fetchWikidataEntityByWiktionaryTitle).mockResolvedValue(null as any);
    vi.mocked(api.fetchWikidataEntityByWikipediaTitle).mockResolvedValue({
      id: "Q144",
      labels: { en: { language: "en", value: "dog" } },
      claims: {},
    } as any);

    const res = await wiktionary({ query: "dog", lang: "en", enrich: true });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");
    expect(lex?.wikidata?.qid).toBe("Q144");
    expect(api.fetchWikidataEntityByWiktionaryTitle).toHaveBeenCalledWith("dog");
    expect(api.fetchWikidataEntityByWikipediaTitle).toHaveBeenCalledWith("dog");
    expect(api.fetchWikidataEntity).not.toHaveBeenCalled();
  });

  it("keeps lexeme without wikidata when all enrichment lookups miss", async () => {
    const res = await wiktionary({ query: "dog", lang: "en", enrich: true });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");
    expect(lex).toBeTruthy();
    expect(lex?.wikidata).toBeUndefined();
    expect(api.fetchWikidataEntityByWiktionaryTitle).toHaveBeenCalledWith("dog");
    expect(api.fetchWikidataEntityByWikipediaTitle).toHaveBeenCalledWith("dog");
  });
});

