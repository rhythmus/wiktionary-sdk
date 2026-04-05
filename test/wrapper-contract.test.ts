import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  synonyms,
  antonyms,
  hypernyms,
  hyponyms,
  comeronyms,
  parasynonyms,
  collocations,
  pronounce,
  ipa,
  hyphenate,
  partOfSpeech,
  usageNotes,
  wikidataQid,
  image,
  wikipediaLink,
  gender,
  rhymes,
  homophones,
  audioGallery,
  citations,
  isInstance,
  morphology,
  richEntry,
  isSubclass,
  etymology,
  etymologyChain,
  etymologyCognates,
  etymologyText,
  transitivity,
  derivedTerms,
  relatedTerms,
  isCategory,
  asLexemeRows,
} from "../src/index";
import type { GroupedLexemeResults } from "../src/library";
import * as api from "../src/api";

vi.mock("../src/api", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    fetchWikitextEnWiktionary: vi.fn(),
    fetchWikidataEntity: vi.fn(),
    mwFetchJson: vi.fn(),
  };
});

function assertGroupedResult<T>(res: GroupedLexemeResults<T>) {
  expect(res).toBeTruthy();
  expect(Array.isArray(res.order)).toBe(true);
  expect(typeof res.lexemes).toBe("object");
  expect(res.order.length).toBeGreaterThanOrEqual(0);

  for (const id of res.order) {
    expect(typeof id).toBe("string");
    expect(res.lexemes[id]).toBeDefined();
    expect(typeof res.lexemes[id].language).toBe("string");
    expect(typeof res.lexemes[id].pos).toBe("string");
  }

  const rows = asLexemeRows(res);
  expect(rows.length).toBe(res.order.length);
  expect(rows.map((r) => r.lexeme_id)).toEqual(res.order);
  if (res.order.length === 0) {
    expect(Object.keys(res.lexemes)).toHaveLength(0);
  }
}

describe("wrapper output contract", () => {
  beforeEach(() => {
    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue({
      exists: true,
      title: "dog",
      wikitext: `
== English ==
===Noun===
{{en-noun}}
# A dog.
#: {{ux|en|The dog barked.|translation=De hond blafte.}}
{{syn|en|hound|canine}}
`,
      pageprops: { wikibase_item: "Q144" },
      categories: [],
      langlinks: [],
      info: { last_modified: "2026-03-31", length: 123, pageid: 1, lastrevid: 1 },
      pageid: 1,
    } as any);

    vi.mocked(api.fetchWikidataEntity).mockResolvedValue({
      qid: "Q144",
      claims: {
        P31: [{ mainsnak: { datavalue: { value: { id: "Q1084" } } } }],
        P279: [{ mainsnak: { datavalue: { value: { id: "Q34770" } } } }],
      },
    } as any);
  });

  it("returns grouped shape for representative wrappers", async () => {
    const syn = await synonyms("dog", "en");
    assertGroupedResult(syn);
    expect(asLexemeRows(syn)[0].value).toEqual(expect.arrayContaining(["hound", "canine"]));

    const ipaRes = await ipa("dog", "en");
    assertGroupedResult(ipaRes);

    const morphRes = await morphology("dog", "en");
    assertGroupedResult(morphRes);
    expect(typeof asLexemeRows(morphRes)[0].value).toBe("object");

    const richRes = await richEntry("dog", "en");
    assertGroupedResult(richRes);
    expect(asLexemeRows(richRes)[0].value?.headword).toBe("dog");

    const subclassRes = await isSubclass("dog", "Q34770", "en");
    assertGroupedResult(subclassRes);
    expect(asLexemeRows(subclassRes)[0].value).toBe(true);
  });

  it("enforces grouped contract across wrapper matrix", async () => {
    const matrix: Array<{ name: string; run: () => Promise<GroupedLexemeResults<any>> }> = [
      { name: "synonyms", run: () => synonyms("dog", "en") as any },
      { name: "antonyms", run: () => antonyms("dog", "en") as any },
      { name: "hypernyms", run: () => hypernyms("dog", "en") as any },
      { name: "hyponyms", run: () => hyponyms("dog", "en") as any },
      { name: "comeronyms", run: () => comeronyms("dog", "en") as any },
      { name: "parasynonyms", run: () => parasynonyms("dog", "en") as any },
      { name: "collocations", run: () => collocations("dog", "en") as any },
      { name: "pronounce", run: () => pronounce("dog", "en") as any },
      { name: "ipa", run: () => ipa("dog", "en") as any },
      { name: "hyphenate", run: () => hyphenate("dog", "en") as any },
      { name: "partOfSpeech", run: () => partOfSpeech("dog", "en") as any },
      { name: "usageNotes", run: () => usageNotes("dog", "en") as any },
      { name: "wikidataQid", run: () => wikidataQid("dog", "en") as any },
      { name: "image", run: () => image("dog", "en") as any },
      { name: "wikipediaLink", run: () => wikipediaLink("dog", "en", "en") as any },
      { name: "gender", run: () => gender("dog", "en") as any },
      { name: "rhymes", run: () => rhymes("dog", "en") as any },
      { name: "homophones", run: () => homophones("dog", "en") as any },
      { name: "audioGallery", run: () => audioGallery("dog", "en") as any },
      { name: "citations", run: () => citations("dog", "en") as any },
      { name: "isInstance", run: () => isInstance("dog", "Q1084", "en") as any },
      { name: "isSubclass", run: () => isSubclass("dog", "Q34770", "en") as any },
      { name: "morphology", run: () => morphology("dog", "en") as any },
      { name: "richEntry", run: () => richEntry("dog", "en") as any },
      { name: "etymology", run: () => etymology("dog", "en") as any },
      { name: "etymologyChain", run: () => etymologyChain("dog", "en") as any },
      { name: "etymologyCognates", run: () => etymologyCognates("dog", "en") as any },
      { name: "etymologyText", run: () => etymologyText("dog", "en") as any },
      { name: "transitivity", run: () => transitivity("dog", "en") as any },
      { name: "derivedTerms", run: () => derivedTerms("dog", "en") as any },
      { name: "relatedTerms", run: () => relatedTerms("dog", "en") as any },
      { name: "isCategory", run: () => isCategory("dog", "animals", "en") as any },
    ];

    for (const item of matrix) {
      const res = await item.run();
      expect(item.name).toBeTruthy();
      assertGroupedResult(res);
    }
  });
});
