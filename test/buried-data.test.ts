import { describe, it, expect, vi, beforeEach } from "vitest";
import { audioGallery, citations, richEntry, isSubclass, asLexemeRows } from "../src/index";
import * as api from "../src/ingress/api";

vi.mock("../src/ingress/api", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    fetchWikitextEnWiktionary: vi.fn(),
    fetchWikidataEntity: vi.fn(),
  };
});

describe("Buried Data Extraction (Integration)", () => {
  const rows = <T>(grouped: any) => asLexemeRows(grouped) as Array<{ value: T; language: string }>;
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts multiple audio files into a gallery", async () => {
    const wikitext = `
== English ==
===Noun===
{{en-noun|-}}
* {{audio|en|En-us-water.ogg|Audio (US)}}
* {{audio|en|En-uk-water.ogg|Audio (UK)}}
* {{audio|en|En-au-water.ogg|Audio (AU)}}

# A clear liquid.
    `;

    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue({
      exists: true,
      title: "water",
      wikitext,
      pageprops: {},
      categories: [],
      images: [],
      page_links: [],
      external_links: [],
      langlinks: [],
      info: { lastrevid: 12345, last_modified: "2024-03-29", length: 100, pageid: 123 },
      pageid: 123
    });

    const galleryResults = await audioGallery("water", "en");
    const gallery = rows<any[]>(galleryResults).find(r => r.value.length > 0)?.value || [];
    expect(gallery).toHaveLength(3);
    expect(gallery[0]).toEqual({
      url: "https://upload.wikimedia.org/wikipedia/commons/En-us-water.ogg",
      label: "Audio (US)",
      filename: "En-us-water.ogg"
    });
    expect(gallery[1].label).toBe("Audio (UK)");
    expect(gallery[2].label).toBe("Audio (AU)");

    const richResults = await richEntry("water", "en");
    const rich = rows<any>(richResults).find(r => r.value !== null)?.value;
    expect(rich?.pronunciation?.audio_details).toHaveLength(3);
    expect(rich?.pronunciation?.audio).toBe("En-us-water.ogg");
  });

  it("extracts structured citations from quote templates", async () => {
    const wikitext = `
== English ==
===Noun===
{{en-noun}}
# A book.
#: {{quote-book|en|year=1851|author=Herman Melville|title=Moby-Dick|passage=Call me Ishmael.}}
#: {{ux|en|I read a book.|translation=Ik las een boek.}}
    `;

    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue({
      exists: true,
      title: "book",
      wikitext,
      pageprops: {},
      categories: [],
      images: [],
      page_links: [],
      external_links: [],
      langlinks: [],
      info: { lastrevid: 67890, last_modified: "2024-03-29", length: 150, pageid: 456 },
      pageid: 456
    });

    const citsResults = await citations("book", "en");
    const cits = rows<any[]>(citsResults).find(r => r.value.length > 0)?.value || [];
    expect(cits).toHaveLength(1);
    expect(cits[0]).toMatchObject({
      author: "Herman Melville",
      year: "1851",
      source: "Moby-Dick",
      text: "Call me Ishmael."
    });

    const richResults = await richEntry("book", "en");
    const rich = rows<any>(richResults).find(r => r.value !== null)?.value;
    const example = rich?.senses?.[0].examples?.[0] as any;
    expect(example.author).toBe("Herman Melville");
    
    const allExamples = rich?.senses?.[0].examples;
    expect(allExamples).toHaveLength(2);
    expect((allExamples?.[1] as any).translation).toBe("Ik las een boek.");
  });

  it("extracts subclass_of (P279) from Wikidata", async () => {
    vi.mocked(api.fetchWikitextEnWiktionary).mockResolvedValue({
      exists: true,
      title: "dog",
      wikitext: "== English ==\n===Noun===\n{{en-noun}}",
      pageprops: { wikibase_item: "Q144" },
      categories: [],
      images: [],
      page_links: [],
      external_links: [],
      langlinks: [],
      info: { lastrevid: 11111, last_modified: "2024-03-29", length: 200, pageid: 789 },
      pageid: 789
    });

    vi.mocked(api.fetchWikidataEntity).mockResolvedValue({
      qid: "Q144",
      claims: {
        P31: [{ mainsnak: { datavalue: { value: { id: "Q1084" } } } }],
        P279: [{ mainsnak: { datavalue: { value: { id: "Q34770" } } } }]
      }
    });

    const subclassResults = await isSubclass("dog", "Q34770", "en");
    expect(rows<boolean>(subclassResults)[0].value).toBe(true);

    const richResults = await richEntry("dog", "en");
    const rich = rows<any>(richResults).find(r => r.value !== null)?.value;
    expect(rich?.wikidata?.subclass_of).toContain("Q34770");
    expect(rich?.wikidata?.instance_of).toContain("Q1084");
  });
});
