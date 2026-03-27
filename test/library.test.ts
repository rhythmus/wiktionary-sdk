import { describe, it, expect, vi } from "vitest";
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

// Mock wiktionary to return a predictable FetchResult
vi.mock("../src/index", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/index")>();
    return {
        ...actual,
        wiktionary: vi.fn(),
    };
});

// Mock API module for testing the fallback scraper
vi.mock("../src/api", async (importOriginal) => {
    return {
        mwFetchJson: vi.fn(),
    };
});

describe("translate library function", () => {
    it("should extract translations for a target language from the LEXEME", async () => {
        // Arrange
        const mockResult = {
            schema_version: "1.0",
            rawLanguageBlock: "",
            notes: [],
            entries: [
                {
                    id: "test:verb:γραφω",
                    language: "el",
                    type: "LEXEME",
                    form: "γράφω",
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
                    form: "έγραψε"
                }
            ]
        };
        
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);

        // Act
        const resultNl = await translate("έγραψε", "el", "nl");
        const resultEn = await translate("έγραψε", "el", "en");
        const resultFr = await translate("έγραψε", "el", "fr");

        // Assert
        expect(indexModule.wiktionary).toHaveBeenCalledWith({ query: "έγραψε", lang: "el" });
        
        expect(resultNl).toHaveLength(1);
        expect(resultNl[0]).toBe("schrijven");

        expect(resultEn).toHaveLength(1);
        expect(resultEn[0]).toBe("write");

        expect(resultFr).toHaveLength(0);
    });

    it("should return empty array if no LEXEME is found in gloss mode", async () => {
        // Arrange
        const mockResult = {
            schema_version: "1.0",
            rawLanguageBlock: "",
            notes: [],
            entries: [
                {
                    id: "test:verb:εγραψε",
                    language: "el",
                    type: "INFLECTED_FORM",
                    form: "έγραψε"
                }
            ]
        };
        
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);

        // Act
        const resultNl = await translate("έγραψε", "el", "nl", { mode: "gloss" });

        // Assert
        expect(resultNl).toHaveLength(0);
    });

    it("should extract English senses via wiktionary when mode is 'senses' and target is 'en'", async () => {
        const mockResult = {
            schema_version: "1.0",
            rawLanguageBlock: "",
            notes: [],
            entries: [
                {
                    id: "test:verb:γραφω",
                    language: "el",
                    type: "LEXEME",
                    form: "γράφω",
                    senses: [
                        { gloss: "to write, pen" },
                        { gloss: "to record" }
                    ]
                }
            ]
        };
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);

        const resultEn = await translate("γράφω", "el", "en", { mode: "senses" });
        expect(resultEn).toHaveLength(2);
        expect(resultEn[0]).toBe("to write, pen");
        expect(resultEn[1]).toBe("to record");
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
        expect(resultFr).toHaveLength(2);
        expect(resultFr[0]).toBe("écrire"); // markup stripped, lowercase, period removed
        expect(resultFr[1]).toBe("dessiner"); // markup stripped, lowercase, period removed
    });
});

describe("convenience wrappers", () => {
    const mockResult = {
        entries: [
            {
                type: "LEXEME",
                form: "γράφω",
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
                    links: [
                        { template: "inh", source_lang: "grc", term: "γράφω" },
                        { template: "inh", source_lang: "grk-pro", term: "*grápʰō" },
                        { template: "der", source_lang: "ine-pro", term: "*gerbʰ-" }
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
                type: "INFLECTED_FORM",
                form: "έγραψε",
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
        expect(syns).toEqual(["σημειώνω"]);
    });

    it("antonyms should return antonyms", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        const ants = await antonyms("έγραψε", "el");
        expect(ants).toEqual(["σβήνω"]);
    });

    it("derivations should return derived terms", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        const der = await derivations("έγραψε", "el");
        expect(der).toEqual(["συγγραφέας"]);
    });

    it("phonetic should return correct phonetic", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(await phonetic("έγραψε", "el")).toBe("ˈe.ɣrap.se");
        expect(await phonetic("γράφω", "el")).toBe("ˈɣra.fo");
    });

    it("hyphenate should return string joined by config separator or default", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(await hyphenate("γράφω", "el")).toBe("γρά-φω");
        expect(await hyphenate("έγραψε", "el")).toBe("έ-γρα-ψε");
        expect(await hyphenate("έγραψε", "el", { separator: "‧" })).toBe("έ‧γρα‧ψε");
    });

    it("hyphenate should return array if requested", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(await hyphenate("έγραψε", "el", { format: "array" })).toEqual(["έ", "γρα", "ψε"]);
    });

    it("hyphenate should return null if no hyphenation found", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(await hyphenate("unknown", "el")).toBeNull();
    });

    it("etymology should return structured graph mapping macros to BCP-47 / labels", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        const result = await etymology("έγραψε", "el");
        expect(result).toEqual({
            1: { lang: "grc", form: "γράφω" },
            2: { lang: "Proto-Greek", form: "*grápʰō" },
            3: { lang: "PIE", form: "*gerbʰ-" }
        });
    });

    it("hypernyms, hyponyms, derivedTerms, relatedTerms should return accurate arrays", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(await hypernyms("έγραψε", "el")).toEqual(["δημιουργώ"]);
        expect(await hyponyms("έγραψε", "el")).toEqual(["γράφω κώδικα"]);
        expect(await derivedTerms("έγραψε", "el")).toEqual(["συγγραφέας"]);
        expect(await relatedTerms("έγραψε", "el")).toEqual(["γραπτός"]);
    });

    it("ipa and pronounce should extract phonetics correctly", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(await ipa("έγραψε", "el")).toBe("ˈe.ɣrap.se"); // inflected default
        expect(await pronounce("έγραψε", "el")).toBe("https://example.com/audio.ogg"); // falls back to lexeme if inflected doesn't have audio
    });

    it("wikidata functions should extract structured qid, image, and wikipedia links", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(await wikidataQid("έγραψε", "el")).toBe("Q123");
        expect(await image("έγραψε", "el")).toBe("https://example.com/thumb.jpg");
        expect(await wikipediaLink("έγραψε", "el", "en")).toBe("https://en.wikipedia.org/wiki/Write");
        expect(await wikipediaLink("έγραψε", "el", "fr")).toBeNull();
    });

    it("partOfSpeech and usageNotes should extract lexical boundaries", async () => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
        expect(await partOfSpeech("έγραψε", "el")).toBe("verb");
        expect(await usageNotes("έγραψε", "el")).toEqual(["Use carefully"]);
    });
});
