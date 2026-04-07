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

function mockPage(title: string, wikitext: string) {
  vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue({
    exists: true,
    title,
    wikitext,
    pageprops: {},
    categories: [],
    langlinks: [],
    images: [],
    page_links: [],
    external_links: [],
    info: { last_modified: "2026-04-07", length: 500, pageid: 1, lastrevid: 1 },
    pageid: 1,
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchWikidataEntity).mockResolvedValue(null as any);
  vi.mocked(api.fetchWikidataEntityByWiktionaryTitle).mockResolvedValue(null as any);
  vi.mocked(api.fetchWikidataEntityByWikipediaTitle).mockResolvedValue(null as any);
  vi.mocked(api.fetchWikipediaDisambiguationLinks).mockResolvedValue([]);
});

describe("sense-relation linker", () => {
  it("links template-id relations to senses with high confidence", async () => {
    mockPage("run", `
== English ==
=== Verb ===
{{en-verb}}
# To move quickly by foot.
# To operate a program.
{{syn|en|sprint|id=S1}}
{{syn|en|execute|id=S2}}
`);
    const res = await wiktionary({ query: "run", lang: "en", enrich: false });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");

    expect(lex?.semantic_relations?.synonyms).toHaveLength(2);
    const sprint = lex?.semantic_relations?.synonyms?.find((s) => s.term === "sprint");
    expect(sprint?.source_evidence).toBe("template_id");
    expect(sprint?.confidence).toBe("high");
    expect(sprint?.matched_sense_id).toBe("S1");

    const execute = lex?.semantic_relations?.synonyms?.find((s) => s.term === "execute");
    expect(execute?.source_evidence).toBe("template_id");
    expect(execute?.confidence).toBe("high");
    expect(execute?.matched_sense_id).toBe("S2");

    expect(lex?.semantic_relations_by_sense?.["S1"]?.synonyms?.[0]?.term).toBe("sprint");
    expect(lex?.semantic_relations_by_sense?.["S2"]?.synonyms?.[0]?.term).toBe("execute");
  });

  it("links section-qualifier relations to senses with medium confidence", async () => {
    mockPage("bank", `
== English ==
=== Noun ===
{{en-noun}}
# A financial institution.
# The side of a river.
====Synonyms====
* (financial institution) {{l|en|depository}}
* (river) {{l|en|shore}}
`);
    const res = await wiktionary({ query: "bank", lang: "en", enrich: false });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");

    expect(lex?.semantic_relations?.synonyms).toHaveLength(2);
    const depository = lex?.semantic_relations?.synonyms?.find((s) => s.term === "depository");
    expect(depository?.qualifier).toBe("financial institution");
    expect(depository?.matched_sense_id).toBe("S1");
    expect(depository?.confidence).toBe("medium");

    const shore = lex?.semantic_relations?.synonyms?.find((s) => s.term === "shore");
    expect(shore?.qualifier).toBe("river");
    expect(shore?.matched_sense_id).toBe("S2");
    expect(shore?.confidence).toBe("medium");

    expect(lex?.semantic_relations_by_sense?.["S1"]?.synonyms).toHaveLength(1);
    expect(lex?.semantic_relations_by_sense?.["S2"]?.synonyms).toHaveLength(1);
  });

  it("falls back to heuristic matching with low confidence", async () => {
    mockPage("fast", `
== English ==
=== Adjective ===
{{en-adj}}
# Moving with speed.
# Firmly fixed.
====Synonyms====
{{l|en|quick}}
`);
    const res = await wiktionary({ query: "fast", lang: "en", enrich: false });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");

    expect(lex?.semantic_relations?.synonyms).toHaveLength(1);
    expect(lex?.semantic_relations?.synonyms?.[0]?.term).toBe("quick");
  });

  it("handles all relation families", async () => {
    mockPage("car", `
== English ==
=== Noun ===
{{en-noun}}
# A motor vehicle.
====Synonyms====
{{l|en|automobile}}
====Antonyms====
{{l|en|bicycle}}
====Hypernyms====
{{l|en|vehicle}}
====Hyponyms====
{{l|en|sedan}}
====Holonyms====
{{l|en|fleet}}
====Meronyms====
{{l|en|engine}}
====Coordinate terms====
{{l|en|truck}}
`);
    const res = await wiktionary({ query: "car", lang: "en", enrich: false });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");

    expect(lex?.semantic_relations?.synonyms?.[0]?.term).toBe("automobile");
    expect(lex?.semantic_relations?.antonyms?.[0]?.term).toBe("bicycle");
    expect(lex?.semantic_relations?.hypernyms?.[0]?.term).toBe("vehicle");
    expect(lex?.semantic_relations?.hyponyms?.[0]?.term).toBe("sedan");
    expect(lex?.semantic_relations?.holonyms?.[0]?.term).toBe("fleet");
    expect(lex?.semantic_relations?.meronyms?.[0]?.term).toBe("engine");
    expect(lex?.semantic_relations?.coordinate_terms?.[0]?.term).toBe("truck");
  });

  it("preserves unresolved relations without dropping them", async () => {
    mockPage("foo", `
== English ==
=== Noun ===
{{en-noun}}
# Something.
{{syn|en|bar}}
`);
    const res = await wiktionary({ query: "foo", lang: "en", enrich: false });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");

    expect(lex?.semantic_relations?.synonyms).toHaveLength(1);
    expect(lex?.semantic_relations?.synonyms?.[0]?.term).toBe("bar");
  });

  it("does not create semantic_relations_by_sense when senses are absent", async () => {
    mockPage("hmm", `
== English ==
=== Interjection ===
{{en-interj}}
{{syn|en|huh}}
`);
    const res = await wiktionary({ query: "hmm", lang: "en", enrich: false });
    const lex = res.lexemes.find((l) => l.type === "LEXEME");

    expect(lex?.semantic_relations?.synonyms?.[0]?.term).toBe("huh");
    expect(lex?.semantic_relations_by_sense).toBeUndefined();
  });

  it("backward compat: existing flat synonyms wrapper still works", async () => {
    mockPage("dog", `
== English ==
=== Noun ===
{{en-noun}}
# An animal.
====Synonyms====
{{l|en|hound}}
{{l|en|canine}}
`);
    const { synonyms } = await import("../src/convenience/relations");
    const { asLexemeRows } = await import("../src/convenience/grouped-results");
    const result = await synonyms("dog", "en");
    const rows = asLexemeRows(result);
    expect(rows[0].value).toEqual(["hound", "canine"]);
  });
});
