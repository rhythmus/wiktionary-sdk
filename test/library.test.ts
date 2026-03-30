/**
 * Library wrapper tests: hybrid mocking.
 * All lexeme-scoped wrappers now return LexemeResult<T>[] — assertions
 * check result[i].value for the extracted payload.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
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
} from "../src/library";
import * as indexModule from "../src/index";
import * as apiModule from "../src/api";

vi.mock("../src/index", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/index")>();
    return {
        ...actual,
        wiktionary: vi.fn(),
    };
});

vi.mock("../src/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/api")>();
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

describe("translate library function", () => {
    it("should extract translations for a target language from the LEXEME", async () => {
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
                    translations: {
                        nl: [
                            { term: "schrijven", gloss: "to write", sense: "put text on paper" }
                        ],
                        en: [
                            { term: "write" }
                        ]
                    }
                },
                {
                    id: "test:verb:εγραψε",
                    language: "el",
                    type: "INFLECTED_FORM",
                    form: "έγραψε",
                    part_of_speech_heading: "Verb"
                }
            ]
        };
        
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);

        const resultNl = await translate("έγραψε", "el", "nl");
        const resultEn = await translate("έγραψε", "el", "en");
        const resultFr = await translate("έγραψε", "el", "fr");

        expect(indexModule.wiktionary).toHaveBeenCalledWith({ query: "έγραψε", lang: "el", pos: "Auto" });
        
        const nlTerms = resultNl.find(r => r.value.length > 0)?.value;
        expect(nlTerms).toEqual(["schrijven"]);

        const enTerms = resultEn.find(r => r.value.length > 0)?.value;
        expect(enTerms).toEqual(["write"]);

        expect(resultFr.every(r => r.value.length === 0)).toBe(true);
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
        
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);

        const resultNl = await translate("έγραψε", "el", "nl", { mode: "gloss" });
        expect(resultNl.every(r => r.value.length === 0)).toBe(true);
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
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);

        const resultEn = await translate("γράφω", "el", "en", { mode: "senses" });
        expect(resultEn[0].value).toEqual(["to write, pen", "to record"]);
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
        expect(resultFr[0].value).toHaveLength(2);
        expect(resultFr[0].value[0]).toBe("écrire");
        expect(resultFr[0].value[1]).toBe("dessiner");
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
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(await lemma("έγραψε", "el")).toBe("γράφω");
        expect(await lemma("γράφω", "el")).toBe("γράφω");
        expect(await lemma("unknown", "el")).toBe("unknown");
    });

    it("synonyms should return synonyms", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        const syns = await synonyms("έγραψε", "el");
        expect(syns[0].value).toEqual(["σημειώνω"]);
    });

    it("antonyms should return antonyms", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        const ants = await antonyms("έγραψε", "el");
        expect(ants[0].value).toEqual(["σβήνω"]);
    });

    it("derivedTerms should return derived term items", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        const der = await derivedTerms("έγραψε", "el");
        expect(der[0].value).toEqual([{ term: "συγγραφέας" }]);
    });

    it("derivations should match derivedTerms (alias)", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        const d1 = await derivations("έγραψε", "el");
        const d2 = await derivedTerms("έγραψε", "el");
        expect(d1[0].value).toEqual(d2[0].value);
    });

    it("phonetic should return correct phonetic", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        const res = await phonetic("έγραψε", "el");
        expect(res[0].value).toBe("ˈɣra.fo");
        expect(res[1].value).toBe("ˈe.ɣrap.se");
    });

    it("hyphenate should return array of syllables", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        const res1 = await hyphenate("γράφω", "el");
        expect(res1[0].value).toEqual(["γρά", "φω"]);
        const res2 = await hyphenate("έγραψε", "el");
        expect(res2[1].value).toEqual(["έ", "γρα", "ψε"]);
    });

    it("hyphenate should return array if requested", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        const res = await hyphenate("έγραψε", "el", { format: "array" });
        expect(res[1].value).toEqual(["έ", "γρα", "ψε"]);
    });

    it("hyphenate should return null if no hyphenation found", async () => {
        const emptyResult = {
            ...mockResult,
            lexemes: mockResult.lexemes.map(e => ({ ...e, hyphenation: undefined }))
        };
        vi.mocked(indexModule.wiktionary).mockResolvedValue(emptyResult as any);
        const res = await hyphenate("unknown", "el");
        expect(res[0].value).toBeNull();
    });

    it("etymology should return structured graph mapping macros to BCP-47 / labels", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        const result = await etymology("έγραψε", "el");
        expect(result[0].value).toEqual([
            { lang: "grc", form: "γράφω" },
            { lang: "Proto-Greek", form: "*grápʰō" },
            { lang: "PIE", form: "*gerbʰ-" }
        ]);
    });

    it("hypernyms, hyponyms, derivedTerms, relatedTerms should return accurate arrays", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        expect((await hypernyms("έγραψε", "el"))[0].value).toEqual(["δημιουργώ"]);
        expect((await hyponyms("έγραψε", "el"))[0].value).toEqual(["γράφω κώδικα"]);
        expect((await derivedTerms("έγραψε", "el"))[0].value).toEqual([{ term: "συγγραφέας" }]);
        expect((await relatedTerms("έγραψε", "el"))[0].value).toEqual([{ term: "γραπτός" }]);
    });

    it("ipa and pronounce should extract phonetics correctly", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        const ipaRes = await ipa("έγραψε", "el");
        expect(ipaRes[0].value).toBe("ˈɣra.fo");
        expect(ipaRes[1].value).toBe("ˈe.ɣrap.se");
        const pronResult = await pronounce("έγραψε", "el");
        expect(pronResult[0].value).toBe("https://example.com/audio.ogg");
    });

    it("wikidata functions should extract structured qid, image, and wikipedia links", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        expect((await wikidataQid("έγραψε", "el"))[0].value).toBe("Q123");
        expect((await image("έγραψε", "el"))[0].value).toBe("https://example.com/thumb.jpg");
        expect((await wikipediaLink("έγραψε", "el", "en"))[0].value).toBe("https://en.wikipedia.org/wiki/Write");
        expect((await wikipediaLink("έγραψε", "el", "fr"))[0].value).toBeNull();
    });

    it("partOfSpeech and usageNotes should extract lexical boundaries", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        expect((await partOfSpeech("έγραψε", "el"))[0].value).toBe("verb");
        expect((await usageNotes("έγραψε", "el"))[0].value).toEqual(["Use carefully"]);
    });
});
