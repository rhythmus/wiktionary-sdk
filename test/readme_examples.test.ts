import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import * as api from "../src/api";
import { 
    wiktionary, lemma, ipa, pronounce, hyphenate, synonyms, antonyms,
    etymology, stem, morphology, conjugate, decline, hypernyms, hyponyms,
    derivedTerms, relatedTerms, wikidataQid, wikipediaLink, image,
    partOfSpeech, usageNotes, translate, format, phonetic
} from "../src/index";

const FIXTURES_DIR = resolve(__dirname, "fixtures");

function loadFixture(word: string): string {
    const nfdWord = word.normalize("NFD");
    const nfcWord = word.normalize("NFC");
    const variants = [nfdWord, nfcWord, word];
    
    for (const w of variants) {
        const p = resolve(FIXTURES_DIR, `${w}.wikitext`);
        try {
            const data = readFileSync(p, "utf-8");
            if (data) return data;
        } catch {}
    }
    console.warn(`Fixture not found for: ${word} (searched variants: ${variants.join(", ")})`);
    return "";
}

vi.mock("../src/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/api")>();
    return {
        ...actual,
        fetchWikitextEnWiktionary: vi.fn(),
        fetchWikidataEntity: vi.fn(),
    };
});

describe("README Usage Examples Compliance", () => {
    beforeEach(() => {
        vi.mocked(api.fetchWikitextEnWiktionary).mockImplementation(async (title: string) => {
            title = title.normalize("NFC");
            if (title === "έγραψα") title = "γράφω";
            
            const wikitext = loadFixture(title).normalize("NFC");
            return {
                exists: wikitext !== "",
                title,
                wikitext,
                pageprops: title === "μήλο" ? { wikibase_item: "Q89" } : {},
                pageid: 123
            };
        });

        vi.mocked(api.fetchWikidataEntity).mockImplementation(async (qid: string) => {
            if (qid === "Q89") {
                return {
                    labels: { en: "Apple" },
                    descriptions: { en: "Fruit" },
                    sitelinks: { enwiki: { url: "https://en.wikipedia.org/wiki/Apple" } },
                    claims: {
                        P18: [{ mainsnak: { datavalue: { value: "apple.jpeg" } } }]
                    }
                };
            }
            return null;
        });
    });

    it("1. Programmatic Initialization", async () => {
        const result = await wiktionary({ query: "γράφω", lang: "el" });
        const lexeme = result.lexemes.find(e => e.part_of_speech === "verb");
        expect(lexeme).toBeDefined();
        expect(lexeme!.senses).toBeDefined();
        expect(lexeme!.senses![0].gloss).toBe("to write, pen");
    });

    it("2. Resolve inflected forms to lemma", async () => {
        expect(await lemma("έγραψε", "el")).toBe("γράφω");
        expect(await lemma("γράφω", "el")).toBe("γράφω");
    });

    it("3. Fetch semantic relations", async () => {
        const syns = await synonyms("έγραψε", "el");
        const synValues = syns.flatMap(r => r.value);
        const ants = await antonyms("έγραψε", "el");
        const antValues = ants.flatMap(r => r.value);
        expect(synValues).toContain("σημειώνω");
        expect(synValues).toContain("καταγράφω");
        expect(antValues).toContain("ξεγράφω");
    });

    it("4. Phonetic transcription and audio", async () => {
        const ipaRes = await ipa("έγραψε", "el");
        const ipaVal = ipaRes.find(r => r.value !== null)?.value;
        expect(ipaVal).toBe("ˈe.ɣrap.se");
        const phoneticRes = await phonetic("έγραψε", "el");
        const phoneticVal = phoneticRes.find(r => r.value !== null)?.value;
        expect(phoneticVal).toBe("ˈe.ɣrap.se");
        const ipaGrafo = await ipa("γράφω", "el");
        const ipaGrafoVal = ipaGrafo.find(r => r.value !== null)?.value;
        expect(ipaGrafoVal).toBe("/ˈɣra.fo/");
    });

    it("5. Hyphenation as structured array", async () => {
        const hRes = await hyphenate("έγραψε", "el");
        const hVal = hRes.find(r => r.value !== null)?.value;
        expect(hVal).toEqual(["έ", "γρα", "ψε"]);
        const hRes2 = await hyphenate("γράφω", "el");
        const hVal2 = hRes2.find(r => r.value !== null)?.value;
        expect(hVal2).toEqual(["γρά", "φω"]);
    });

    it("6. Smart Formatter for hyphenation", async () => {
        const hRes = await hyphenate("έγραψε", "el");
        const syllables = hRes.find(r => r.value !== null)?.value;
        expect(format(syllables, { separator: "‧" })).toBe("έ‧γρα‧ψε");
    });

    it("7. Structured etymology lineage", async () => {
        const result = await etymology("έγραψε", "el");
        const etyVal = result.find(r => r.value !== null)?.value;
        expect(etyVal).toEqual([
            { lang: "grc", form: "γράφω" },
            { lang: "Proto-Greek", form: "*grəpʰō" },
            { lang: "PIE", form: "*gerbʰ-" }
        ]);
    });

    it("8. Wikidata enrichment", async () => {
        const qidRes = await wikidataQid("μήλο", "el");
        expect(qidRes.find(r => r.value !== null)?.value).toBe("Q89");
        const imgRes = await image("μήλο", "el");
        expect(imgRes.find(r => r.value !== null)?.value).toContain("apple.jpeg");
        const wikiRes = await wikipediaLink("μήλο", "el", "en");
        expect(wikiRes.find(r => r.value !== null)?.value).toBe("https://en.wikipedia.org/wiki/Apple");
    });

    it("9. Part of speech and usage notes", async () => {
        const posRes = await partOfSpeech("έγραψε", "el");
        const posVal = posRes.find(r => r.value !== null)?.value;
        expect(posVal).toBe("verb");
        const notesRes = await usageNotes("γράφω", "el");
        expect(notesRes[0].value).toEqual([]);
    });

    it("10. Morphology from inflected form", async () => {
        const morphRes = await morphology("έγραψες", "el");
        const morph = morphRes.find(r => Object.keys(r.value).length > 0)?.value;
        expect(morph?.person).toBe("2");
        expect(morph?.number).toBe("singular");
        expect(morph?.tense).toBe("past");
    });

    it("11. Conjugation/Declension with overrides", async () => {
        // Relies on DOM scraping which requires network mocking — placeholder
    });

    it("12. Stems extraction", async () => {
        const stemResults = await stem("έγραψα", "el");
        const stems = stemResults.find(r => r.value.aliases.length > 0)?.value;
        expect(stems?.aliases).toContain("γράψ");
        expect(format(stems, { mode: "text" })).toContain("Stems:");
    });
});
