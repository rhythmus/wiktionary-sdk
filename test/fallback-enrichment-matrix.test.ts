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
    fetchWikipediaDisambiguationLinks: vi.fn(),
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
    vi.mocked(api.fetchWikipediaDisambiguationLinks).mockResolvedValue([]);
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

  it("tries capitalized Wikipedia title when lowercase misses", async () => {
    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue({
      exists: true,
      title: "writing",
      wikitext: BASE_WIKITEXT,
      pageprops: {},
      categories: [],
      langlinks: [],
      info: { last_modified: "2026-03-31", length: 100, pageid: 1, lastrevid: 1 },
      pageid: 1,
    } as any);
    vi.mocked(api.fetchWikidataEntityByWiktionaryTitle).mockResolvedValue(null as any);
    vi.mocked(api.fetchWikidataEntityByWikipediaTitle)
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce({
        id: "Q37260",
        labels: { en: { language: "en", value: "writing" } },
        claims: {},
      } as any);

    const res = await wiktionary({ query: "writing", lang: "en", enrich: true });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");
    expect(lex?.wikidata?.qid).toBe("Q37260");
    expect(api.fetchWikidataEntityByWikipediaTitle).toHaveBeenCalledWith("Writing");
  });

  it("tries disambiguation Wikipedia title when base title misses", async () => {
    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue({
      exists: true,
      title: "write",
      wikitext: BASE_WIKITEXT,
      pageprops: {},
      categories: [],
      langlinks: [],
      info: { last_modified: "2026-03-31", length: 100, pageid: 1, lastrevid: 1 },
      pageid: 1,
    } as any);
    vi.mocked(api.fetchWikidataEntityByWiktionaryTitle).mockResolvedValue(null as any);
    vi.mocked(api.fetchWikidataEntityByWikipediaTitle)
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce({
        id: "Q1215628",
        labels: { en: { language: "en", value: "Write (disambiguation)" } },
        claims: {},
      } as any);

    const res = await wiktionary({ query: "write", lang: "en", enrich: true });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");
    expect(lex?.wikidata?.qid).toBe("Q1215628");
    expect(api.fetchWikidataEntityByWikipediaTitle).toHaveBeenCalledWith("write (disambiguation)");
  });

  it("enriches disambiguation candidates and sense matches when qid is Q4167410", async () => {
    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue({
      exists: true,
      title: "write",
      wikitext: `
== English ==
=== Verb ===
{{en-verb}}
# The act of writing symbols on a surface.
`,
      pageprops: {},
      categories: [],
      langlinks: [],
      info: { last_modified: "2026-03-31", length: 100, pageid: 1, lastrevid: 1 },
      pageid: 1,
    } as any);
    vi.mocked(api.fetchWikidataEntityByWiktionaryTitle).mockResolvedValue({
      id: "Q1215628",
      labels: { en: { language: "en", value: "Write (disambiguation)" } },
      claims: {
        P31: [{ mainsnak: { datavalue: { value: { id: "Q4167410" } } } }],
      },
      sitelinks: { enwiki: { site: "enwiki", title: "Write (disambiguation)" } },
    } as any);
    vi.mocked(api.fetchWikipediaDisambiguationLinks).mockResolvedValue([
      { title: "Writing" },
      { title: "Write system call" },
    ] as any);
    vi.mocked(api.fetchWikidataEntityByWikipediaTitle).mockImplementation(async (title: string) => {
      if (title === "Writing") return { id: "Q37260" } as any;
      if (title === "Write system call") return { id: "Q987654" } as any;
      return null as any;
    });

    const res = await wiktionary({ query: "write", lang: "en", enrich: true });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");
    expect(lex?.wikidata?.qid).toBe("Q37260");
    expect(lex?.wikidata?.disambiguation?.source_qid).toBe("Q1215628");
    expect(lex?.wikidata?.disambiguation?.unresolved).toBeFalsy();
    expect(lex?.wikidata?.disambiguation?.candidates).toEqual([
      {
        title: "Writing",
        qid: "Q37260",
        url: "https://en.wikipedia.org/wiki/Writing",
      },
      {
        title: "Write system call",
        qid: "Q987654",
        url: "https://en.wikipedia.org/wiki/Write_system_call",
      },
    ]);
    expect(lex?.wikidata?.disambiguation?.sense_matches?.[0]?.candidate_qid).toBe("Q37260");
    expect(lex?.wikidata?.disambiguation?.sense_matches?.[0]?.match_reasons).toEqual(
      expect.objectContaining({ title_phrase_hit: true }),
    );
    expect(lex?.senses?.[0]?.wikidata_qid).toBe("Q37260");
    expect(lex?.wikidata?.instance_of).not.toContain("Q4167410");
  });

  it("uses candidate descriptions/aliases to improve sense mapping", async () => {
    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue({
      exists: true,
      title: "write",
      wikitext: `
== English ==
=== Verb ===
{{en-verb}}
# To compose scripts for film.
`,
      pageprops: {},
      categories: [],
      langlinks: [],
      info: { last_modified: "2026-03-31", length: 100, pageid: 1, lastrevid: 1 },
      pageid: 1,
    } as any);
    vi.mocked(api.fetchWikidataEntityByWiktionaryTitle).mockResolvedValue({
      id: "Q1215628",
      labels: { en: { language: "en", value: "Write (disambiguation)" } },
      claims: {
        P31: [{ mainsnak: { datavalue: { value: { id: "Q4167410" } } } }],
      },
      sitelinks: { enwiki: { site: "enwiki", title: "Write (disambiguation)" } },
    } as any);
    vi.mocked(api.fetchWikipediaDisambiguationLinks).mockResolvedValue([
      { title: "Writing" },
      { title: "Screenwriting" },
    ] as any);
    vi.mocked(api.fetchWikidataEntityByWikipediaTitle).mockImplementation(async (title: string) => {
      if (title === "Writing") {
        return {
          id: "Q37260",
          labels: { en: { language: "en", value: "Writing" } },
          descriptions: { en: { language: "en", value: "medium of human communication" } },
        } as any;
      }
      if (title === "Screenwriting") {
        return {
          id: "Q103916",
          labels: { en: { language: "en", value: "Screenwriting" } },
          descriptions: { en: { language: "en", value: "writing scripts for film and television" } },
          aliases: { en: [{ language: "en", value: "script writing" }] },
        } as any;
      }
      return null as any;
    });

    const res = await wiktionary({ query: "write", lang: "en", enrich: true });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");
    expect(lex?.wikidata?.disambiguation?.sense_matches?.[0]?.candidate_qid).toBe("Q103916");
    expect(lex?.wikidata?.disambiguation?.sense_matches?.[0]?.match_reasons).toEqual(
      expect.objectContaining({ aux_token_hits: expect.any(Number) }),
    );
  });

  it("keeps lexeme without wikidata when all enrichment lookups miss", async () => {
    const res = await wiktionary({ query: "dog", lang: "en", enrich: true });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");
    expect(lex).toBeTruthy();
    expect(lex?.wikidata).toBeUndefined();
    expect(api.fetchWikidataEntityByWiktionaryTitle).toHaveBeenCalledWith("dog");
    expect(api.fetchWikidataEntityByWikipediaTitle).toHaveBeenCalledWith("dog");
  });

  it("does not perform any Wikidata lookups when enrich is false", async () => {
    const res = await wiktionary({ query: "dog", lang: "en", enrich: false });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");
    expect(lex).toBeTruthy();
    expect(lex?.wikidata).toBeUndefined();
    expect(api.fetchWikidataEntity).not.toHaveBeenCalled();
    expect(api.fetchWikidataEntityByWiktionaryTitle).not.toHaveBeenCalled();
    expect(api.fetchWikidataEntityByWikipediaTitle).not.toHaveBeenCalled();
  });
});

