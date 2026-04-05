/**
 * Audit §13.10 — lemma() and richEntry() orchestration with mocked API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { lemma, richEntry } from "../src/convenience";
import * as api from "../src/ingress/api";

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

function page(title: string, wikitext: string) {
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
    info: { last_modified: "x", length: 1, pageid: 1, lastrevid: 1 },
    pageid: 1,
  } as any;
}

describe("library audit (§13.10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchWikidataEntity).mockResolvedValue(null as any);
    vi.mocked(api.fetchWikidataEntityByWiktionaryTitle).mockResolvedValue(null as any);
    vi.mocked(api.fetchWikidataEntityByWikipediaTitle).mockResolvedValue(null as any);
    vi.mocked(api.mwFetchJson).mockResolvedValue({ parse: { text: "" } } as any);
  });

  it("lemma() returns form_of lemma for INFLECTED_FORM", async () => {
    const infl = `==English==
===Verb===
# {{inflection of|en|run||1|s|pres|ind|act}}
`;
    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue(page("runs", infl));

    const l = await lemma("runs", "en", "Auto");
    expect(l).toBe("run");
  });

  it("richEntry() attaches inflected headword via lemma_triggered_by_lexeme_id", async () => {
    const infl = `==English==
===Verb===
# {{inflection of|en|see||1|s|pres|ind|act}}
`;
    const lemmaWt = `==English==
===Verb===
# lemma
`;
    vi.mocked(api.fetchWikitextEnWiktionary).mockImplementation(async (t: string) => {
      if (t === "sees") return page("sees", infl);
      if (t === "see") return page("see", lemmaWt);
      return { exists: false, title: t, wikitext: "", pageprops: {}, pageid: null } as any;
    });

    const rows = await richEntry("sees", "en", "Auto");
    const triggered = rows.find((r) => r.value?.headword === "sees");
    expect(triggered).toBeTruthy();
    expect(triggered!.value?.type).toBe("INFLECTED_FORM");
  });
});
