/**
 * Library wrapper tests: hybrid mocking.
 * All lexeme-scoped wrappers return grouped per-lexeme output.
 *
 * Fixture-backed in this file:
 * - translate gloss path (Greek verb fixture)
 * - synonyms basic extraction (Greek verb fixture)
 *
 * Remaining tests are intentionally mock-result based where fixture parity is
 * not yet wired for the exact edge asserted by the test.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { 
    asLexemeRows,
    translate, 
    lemma, 
    synonyms, 
    antonyms, 
    derivations,
    phonetic,
    ipa,
    pronounce,
    hyphenate,
    etymology,
    hypernyms,
    hyponyms,
    derivedTerms,
    relatedTerms,
    wikidataQid,
    image,
    wikipediaLink,
    partOfSpeech,
    usageNotes
} from "../src/convenience";
import * as coreModule from "../src/pipeline/wiktionary-core";
import * as apiModule from "../src/ingress/api";

vi.mock("../src/pipeline/wiktionary-core", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/pipeline/wiktionary-core")>();
    return {
        ...actual,
        wiktionary: vi.fn(),
    };
});

vi.mock("../src/ingress/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/ingress/api")>();
    return {
        ...actual,
        mwFetchJson: vi.fn(),
        fetchWikitextEnWiktionary: vi.fn(),
        fetchWikidataEntity: vi.fn(),
    };
});

beforeEach(() => {
    vi.mocked(apiModule.fetchWikitextEnWiktionary).mockResolvedValue({
        exists: false,
        title: "",
        wikitext: "",
        pageprops: {},
        categories: [],
        langlinks: [],
        info: {},
        pageid: null,
    });
    vi.mocked(apiModule.fetchWikidataEntity).mockResolvedValue(null);
});

const rows = <T>(grouped: any) => asLexemeRows(grouped) as Array<{ value: T; language: string }>;
let realWiktionary: typeof coreModule.wiktionary;

beforeAll(async () => {
    const actual = await vi.importActual<typeof import("../src/pipeline/wiktionary-core")>(
        "../src/pipeline/wiktionary-core",
    );
    realWiktionary = actual.wiktionary;
});

function fixturePath(name: string): string {
    return resolve(__dirname, "fixtures", name);
}

function mkPage(title: string, wikitext: string) {
    return {
        exists: true,
        title,
        wikitext,
        pageprops: {},
        categories: [],
        images: [],
        page_links: [],
        external_links: [],
        langlinks: [],
        info: {},
        pageid: 1,
    };
}

function mockFixturePages(pages: Record<string, string>) {
    vi.mocked(apiModule.fetchWikitextEnWiktionary).mockImplementation(async (title: string) => {
        const wikitext = pages[title];
        if (!wikitext) {
            return {
                exists: false,
                title,
                wikitext: "",
                pageprops: {},
                categories: [],
                images: [],
                page_links: [],
                external_links: [],
                langlinks: [],
                info: {},
                pageid: null,
            };
        }
        return mkPage(title, wikitext);
    });
}

describe("translate library function", () => {
    it("should extract translations for a target language from the LEXEME", async () => {
        const wrote = readFileSync(fixturePath("έγραψε.wikitext"), "utf-8");
        const write = readFileSync(fixturePath("translations-multi.wikitext"), "utf-8");
        mockFixturePages({
            "έγραψε": wrote,
            "γράφω": write,
        });
        vi.mocked(coreModule.wiktionary).mockImplementation((args: any) => realWiktionary(args));

        const resultNl = await translate("έγραψε", "el", "de");
        const resultEn = await translate("έγραψε", "el", "en");
        const resultFr = await translate("έγραψε", "el", "fr");

        expect(coreModule.wiktionary).toHaveBeenCalledWith({ query: "έγραψε", lang: "el", pos: "Auto" });
        
        const nlTerms = rows<string[]>(resultNl).find(r => r.value.length > 0)?.value;
        expect(nlTerms).toEqual(["schreiben"]);

        const enTerms = rows<string[]>(resultEn).find(r => r.value.length > 0)?.value;
        expect(enTerms).toEqual(["write"]);

        expect(rows<string[]>(resultFr).find(r => r.value.length > 0)?.value).toEqual(["écrire"]);
    });

    it("should return empty array if no LEXEME is found in gloss mode", async () => {
        const mockResult = {
            schema_version: "1.0",
            rawLanguageBlock: "",
            notes: [],
            lexemes: [
                {
                    id: "test:verb:εγραψε",
                    language: "el",
                    type: "INFLECTED_FORM",
                    form: "έγραψε",
                    part_of_speech_heading: "Verb"
                }
            ]
        };
        
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);

        const resultNl = await translate("έγραψε", "el", "nl", { mode: "gloss" });
        expect(rows<string[]>(resultNl).every(r => r.value.length === 0)).toBe(true);
    });

    it("should extract English senses via wiktionary when mode is 'senses' and target is 'en'", async () => {
        const mockResult = {
            schema_version: "1.0",
            rawLanguageBlock: "",
            notes: [],
            lexemes: [
                {
                    id: "test:verb:γραφω",
                    language: "el",
                    type: "LEXEME",
                    form: "γράφω",
                    part_of_speech_heading: "Verb",
                    senses: [
                        { gloss: "to write, pen" },
                        { gloss: "to record" }
                    ]
                }
            ]
        };
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);

        const resultEn = await translate("γράφω", "el", "en", { mode: "senses" });
        expect(rows<string[]>(resultEn)[0].value).toEqual(["to write, pen", "to record"]);
    });

    it("should scrape fr.wiktionary directly when mode is 'senses' and target is 'fr'", async () => {
        const mockWikitext = `
== {{langue|el}} ==
=== {{S|verbe|el}} ===
'''γράφω''' {{pron|ˈɡɾa.fɔ|el}}
# [[écrire|Écrire]].
# [[dessiner|Dessiner]].
        `;

        vi.mocked(apiModule.mwFetchJson).mockResolvedValue({
            query: {
                pages: [{
                    revisions: [{ slots: { main: { content: mockWikitext } } }]
                }]
            }
        });

        const resultFr = await translate("γράφω", "el", "fr", { mode: "senses" });
        expect(apiModule.mwFetchJson).toHaveBeenCalledWith(
            "https://fr.wiktionary.org/w/api.php",
            expect.objectContaining({ titles: "γράφω" })
        );
        expect(rows<string[]>(resultFr)[0].value).toHaveLength(2);
        expect(rows<string[]>(resultFr)[0].value[0]).toBe("écrire");
        expect(rows<string[]>(resultFr)[0].value[1]).toBe("dessiner");
    });

    it("should call onError and return empty native-senses result on scrape failure", async () => {
        const onError = vi.fn();
        vi.mocked(apiModule.mwFetchJson).mockRejectedValue(new Error("network down"));

        const result = await translate("γράφω", "el", "fr", { mode: "senses", onError });

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ query: "γράφω", sourceLang: "el", targetLang: "fr" }),
        );
        expect(rows<string[]>(result)[0].value).toEqual([]);
    });
});

describe("convenience wrappers", () => {
    const mockResult = {
        lexemes: [
            {
                id: "el:γράφω#E1#verb#LEXEME",
                language: "el",
                type: "LEXEME",
                form: "γράφω",
                part_of_speech_heading: "Verb",
                semantic_relations: {
                    synonyms: [{ term: "σημειώνω" }],
                    antonyms: [{ term: "σβήνω" }],
                    hypernyms: [{ term: "δημιουργώ" }],
                    hyponyms: [{ term: "γράφω κώδικα" }]
                },
                derived_terms: {
                    items: [{ term: "συγγραφέας" }]
                },
                related_terms: {
                    items: [{ term: "γραπτός" }]
                },
                pronunciation: { IPA: "ˈɣra.fo", audio: "https://example.com/audio.ogg" },
                hyphenation: { syllables: ["γρά", "φω"] },
                etymology: {
                    chain: [
                        { template: "inh", relation: "inherited", source_lang: "grc", term: "γράφω" },
                        { template: "inh", relation: "inherited", source_lang: "grk-pro", term: "*grápʰō" },
                        { template: "der", relation: "derived", source_lang: "ine-pro", term: "*gerbʰ-" }
                    ]
                },
                wikidata: {
                    qid: "Q123",
                    media: {
                        thumbnail: "https://example.com/thumb.jpg"
                    },
                    sitelinks: {
                        enwiki: { url: "https://en.wikipedia.org/wiki/Write" }
                    }
                },
                usage_notes: ["Use carefully"],
                part_of_speech: "verb"
            },
            {
                id: "el:έγραψε#E1#verb#INFLECTED_FORM",
                language: "el",
                type: "INFLECTED_FORM",
                form: "έγραψε",
                part_of_speech_heading: "Verb",
                form_of: { lemma: "γράφω" },
                pronunciation: { IPA: "ˈe.ɣrap.se" },
                hyphenation: { syllables: ["έ", "γρα", "ψε"] }
            }
        ]
    };

    it("lemma should resolve inflected form to lemma or return query", async () => {
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(await lemma("έγραψε", "el")).toBe("γράφω");
        expect(await lemma("γράφω", "el")).toBe("γράφω");
        expect(await lemma("unknown", "el")).toBe("unknown");
    });

    it("synonyms should return synonyms", async () => {
        const write = readFileSync(fixturePath("γράφω.wikitext"), "utf-8");
        mockFixturePages({ "γράφω": write });
        vi.mocked(coreModule.wiktionary).mockImplementation((args: any) => realWiktionary(args));
        const syns = await synonyms("γράφω", "el");
        expect(rows<string[]>(syns)[0].value).toEqual(["σημειώνω", "καταγράφω"]);
    });

    it("antonyms should return antonyms", async () => {
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);
        const ants = await antonyms("έγραψε", "el");
        expect(rows<string[]>(ants)[0].value).toEqual(["σβήνω"]);
    });

    it("derivedTerms should return derived term items", async () => {
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);
        const der = await derivedTerms("έγραψε", "el");
        expect(rows<any[]>(der)[0].value).toEqual([{ term: "συγγραφέας" }]);
    });

    it("derivations should match derivedTerms (alias)", async () => {
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);
        const d1 = await derivations("έγραψε", "el");
        const d2 = await derivedTerms("έγραψε", "el");
        expect(rows<any[]>(d1)[0].value).toEqual(rows<any[]>(d2)[0].value);
    });

    it("phonetic should return correct phonetic", async () => {
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);
        const res = await phonetic("έγραψε", "el");
        expect(rows<string | null>(res)[0].value).toBe("ˈɣra.fo");
        expect(rows<string | null>(res)[1].value).toBe("ˈe.ɣrap.se");
    });

    it("hyphenate should return array of syllables", async () => {
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);
        const res1 = await hyphenate("γράφω", "el");
        expect(rows<any>(res1)[0].value).toEqual(["γρά", "φω"]);
        const res2 = await hyphenate("έγραψε", "el");
        expect(rows<any>(res2)[1].value).toEqual(["έ", "γρα", "ψε"]);
    });

    it("hyphenate should return array if requested", async () => {
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);
        const res = await hyphenate("έγραψε", "el", { format: "array" });
        expect(rows<any>(res)[1].value).toEqual(["έ", "γρα", "ψε"]);
    });

    it("hyphenate should return null if no hyphenation found", async () => {
        const emptyResult = {
            ...mockResult,
            lexemes: mockResult.lexemes.map(e => ({ ...e, hyphenation: undefined }))
        };
        vi.mocked(coreModule.wiktionary).mockResolvedValue(emptyResult as any);
        const res = await hyphenate("unknown", "el");
        expect(rows<any>(res)[0].value).toBeNull();
    });

    it("etymology should return structured graph mapping macros to BCP-47 / labels", async () => {
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);
        const result = await etymology("έγραψε", "el");
        expect(rows<any>(result)[0].value).toEqual([
            { lang: "grc", form: "γράφω" },
            { lang: "Proto-Greek", form: "*grápʰō" },
            { lang: "PIE", form: "*gerbʰ-" }
        ]);
    });

    it("hypernyms, hyponyms, derivedTerms, relatedTerms should return accurate arrays", async () => {
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(rows<any>(await hypernyms("έγραψε", "el"))[0].value).toEqual(["δημιουργώ"]);
        expect(rows<any>(await hyponyms("έγραψε", "el"))[0].value).toEqual(["γράφω κώδικα"]);
        expect(rows<any>(await derivedTerms("έγραψε", "el"))[0].value).toEqual([{ term: "συγγραφέας" }]);
        expect(rows<any>(await relatedTerms("έγραψε", "el"))[0].value).toEqual([{ term: "γραπτός" }]);
    });

    it("ipa and pronounce should extract phonetics correctly", async () => {
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);
        const ipaRes = await ipa("έγραψε", "el");
        expect(rows<any>(ipaRes)[0].value).toBe("ˈɣra.fo");
        expect(rows<any>(ipaRes)[1].value).toBe("ˈe.ɣrap.se");
        const pronResult = await pronounce("έγραψε", "el");
        expect(rows<any>(pronResult)[0].value).toBe("https://example.com/audio.ogg");
    });

    it("wikidata functions should extract structured qid, image, and wikipedia links", async () => {
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(rows<any>(await wikidataQid("έγραψε", "el"))[0].value).toBe("Q123");
        expect(rows<any>(await image("έγραψε", "el"))[0].value).toBe("https://example.com/thumb.jpg");
        expect(rows<any>(await wikipediaLink("έγραψε", "el", "en"))[0].value).toBe("https://en.wikipedia.org/wiki/Write");
        expect(rows<any>(await wikipediaLink("έγραψε", "el", "fr"))[0].value).toBeNull();
    });

    it("partOfSpeech and usageNotes should extract lexical boundaries", async () => {
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(rows<any>(await partOfSpeech("έγραψε", "el"))[0].value).toBe("verb");
        expect(rows<any>(await usageNotes("έγραψε", "el"))[0].value).toEqual(["Use carefully"]);
    });
});
