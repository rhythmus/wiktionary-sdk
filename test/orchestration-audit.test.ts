/**
 * Audit §13.1 — wiktionary / wiktionaryRecursive orchestration (mocked API).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { wiktionary, wiktionaryRecursive, stripCombiningMarksForPageTitle } from "../src/index";
import * as api from "../src/api";

vi.mock("../src/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api")>();
  return {
    ...actual,
    fetchWikitextEnWiktionary: vi.fn(),
    fetchWikidataEntity: vi.fn(),
    fetchWikidataEntityByWiktionaryTitle: vi.fn(),
    fetchWikidataEntityByWikipediaTitle: vi.fn(),
    mwFetchJson: vi.fn(),
  };
});

function mockPage(title: string, wikitext: string) {
  return {
    exists: true,
    title,
    wikitext,
    pageprops: {},
    categories: [],
    langlinks: [],
    images: [],
    page_links: [],
    external_links: [],
    info: { last_modified: "2026-01-01", length: wikitext.length, pageid: 1, lastrevid: 1 },
    pageid: 1,
  } as any;
}

describe("orchestration audit (§13.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchWikidataEntity).mockResolvedValue(null as any);
    vi.mocked(api.fetchWikidataEntityByWiktionaryTitle).mockResolvedValue(null as any);
    vi.mocked(api.fetchWikidataEntityByWikipediaTitle).mockResolvedValue(null as any);
    vi.mocked(api.mwFetchJson).mockResolvedValue({ parse: { text: "" } } as any);
  });

  it("detects lemma cycle when wiktionaryRecursive is re-entered with same visited key", async () => {
    const wikitext = "==English==\n===Verb===\n# lemma sense\n";
    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue(mockPage("x", wikitext));

    const visited = new Set<string>();
    const first = await wiktionaryRecursive({
      query: "x",
      lang: "en",
      enrich: false,
      debugDecoders: false,
      sort: "source",
      _visited: visited,
    });
    expect(first.lexemes.length).toBeGreaterThan(0);

    const second = await wiktionaryRecursive({
      query: "x",
      lang: "en",
      enrich: false,
      debugDecoders: false,
      sort: "source",
      _visited: visited,
    });
    expect(second.lexemes).toEqual([]);
    expect(second.notes.some((n) => /Cycle detected/i.test(n))).toBe(true);
  });

  it("retries fetch without combining marks when primary title is missing", async () => {
    const queryNfc = "a\u0301b".normalize("NFC");
    const stripped = stripCombiningMarksForPageTitle(queryNfc);
    expect(stripped).not.toBe(queryNfc);

    vi.mocked(api.fetchWikitextEnWiktionary).mockImplementation(async (title: string) => {
      if (title === queryNfc) return { exists: false, title: queryNfc, wikitext: "", pageprops: {}, pageid: null } as any;
      if (title === stripped) return mockPage(stripped, "==English==\n===Verb===\n# ok\n");
      return { exists: false, title, wikitext: "", pageprops: {}, pageid: null } as any;
    });

    const res = await wiktionary({ query: "a\u0301b", lang: "en", enrich: false });
    expect(res.lexemes.length).toBeGreaterThan(0);
    expect(api.fetchWikitextEnWiktionary).toHaveBeenCalledWith(queryNfc);
    expect(api.fetchWikitextEnWiktionary).toHaveBeenCalledWith(stripped);
  });

  it("merges fuzzy variants with duplicate lexeme ids and aligns debug row count", async () => {
    const wt = "==English==\n===Verb===\n# one\n";
    vi.mocked(api.fetchWikitextEnWiktionary).mockImplementation(async () => mockPage("unified", wt));

    const res = await wiktionary({
      query: "Hello",
      lang: "en",
      enrich: false,
      matchMode: "fuzzy",
      debugDecoders: true,
    });

    expect(res.lexemes.length).toBeGreaterThan(0);
    expect(res.debug?.length).toBe(res.lexemes.length);
    const ids = new Set(res.lexemes.map((l) => l.id));
    expect(ids.size).toBe(res.lexemes.length);
  });

  it("sort: priority orders el before grc when both appear on the page", async () => {
    const wt = `==Ancient Greek==
===Verb===
# grc sense
==Greek==
===Verb===
# el sense
`;
    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue(mockPage("pi", wt));

    const src = await wiktionary({ query: "pi", lang: "Auto", enrich: false, sort: "source" });
    const pri = await wiktionary({ query: "pi", lang: "Auto", enrich: false, sort: "priority" });

    const srcLangs = src.lexemes.map((l) => l.language);
    const priLangs = pri.lexemes.map((l) => l.language);

    expect(srcLangs).toContain("grc");
    expect(srcLangs).toContain("el");
    expect(srcLangs.indexOf("grc")).toBeLessThan(srcLangs.indexOf("el"));

    expect(priLangs.indexOf("el")).toBeLessThan(priLangs.indexOf("grc"));
  });

  it("pos filter keeps only matching PoS blocks", async () => {
    const wt = `==English==
===Noun===
# noun gloss
===Verb===
# verb gloss
`;
    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue(mockPage("walk", wt));

    const res = await wiktionary({ query: "walk", lang: "en", pos: "verb", enrich: false });
    expect(res.lexemes.length).toBe(1);
    expect(res.lexemes[0].part_of_speech_heading.toLowerCase()).toContain("verb");
  });

  it("dedupes a single lemma fetch when two etymology slices point to the same lemma", async () => {
    const wt = `==English==
===Etymology 1===
===Verb===
# {{inflection of|en|run||1|s|pres|ind|act}}
===Etymology 2===
===Verb===
# {{inflection of|en|run||2|s|past|ind|act}}
`;
    const lemmaWt = `==English==
===Verb===
# lemma sense
`;
    vi.mocked(api.fetchWikitextEnWiktionary).mockImplementation(async (title: string) => {
      if (title === "jogs") return mockPage("jogs", wt);
      if (title === "run") return mockPage("run", lemmaWt);
      return { exists: false, title, wikitext: "", pageprops: {}, pageid: null } as any;
    });

    await wiktionary({ query: "jogs", lang: "en", enrich: false });

    const runCalls = vi.mocked(api.fetchWikitextEnWiktionary).mock.calls.filter((c) => c[0] === "run");
    expect(runCalls.length).toBe(1);
  });

  it("pads debug for resolved lemma rows with independent arrays (mutation isolation)", async () => {
    const infl = `==English==
===Verb===
# {{inflection of|en|lemma||1|s|pres|ind|act}}
`;
    const lemmaWt = `==English==
===Verb===
# resolved
`;
    vi.mocked(api.fetchWikitextEnWiktionary).mockImplementation(async (title: string) => {
      if (title === "walks") return mockPage("walks", infl);
      if (title === "lemma") return mockPage("lemma", lemmaWt);
      return { exists: false, title, wikitext: "", pageprops: {}, pageid: null } as any;
    });

    const res = await wiktionary({
      query: "walks",
      lang: "en",
      enrich: false,
      debugDecoders: true,
    });

    expect(res.debug).toBeDefined();
    expect(res.debug!.length).toBe(res.lexemes.length);
    const last = res.debug!.length - 1;
    res.debug![last].push({
      decoderId: "probe",
      matchedTemplates: [],
      fieldsProduced: ["test"],
    });
    for (let i = 0; i < last; i++) {
      expect(res.debug![i].some((e) => e.decoderId === "probe")).toBe(false);
    }
  });
});
