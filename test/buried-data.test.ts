import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
    rhymes, 
    homophones, 
    syllableCount, 
    allImages, 
    audioDetails, 
    exampleDetails, 
    externalLinks, 
    internalLinks, 
    isInstance,
    richEntry
} from "../src/library";
import * as indexModule from "../src/index";

vi.mock("../src/index", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/index")>();
    return {
        ...actual,
        wiktionary: vi.fn(),
    };
});

describe("Buried Data & New Library Functions", () => {
    const mockResult = {
        schema_version: "2.0.0",
        rawLanguageBlock: "",
        notes: [],
        entries: [
            {
                type: "LEXEME",
                form: "γράφω",
                language: "el",
                part_of_speech: "verb",
                part_of_speech_heading: "Verb",
                pronunciation: {
                    IPA: "ˈɣra.fo",
                    rhymes: ["-afo"],
                    homophones: ["γράφω (variant)"],
                    audio_details: [
                        { url: "https://example.com/el-grafo.ogg", label: "Audio (Greece)", filename: "el-grafo.ogg" }
                    ]
                },
                hyphenation: { syllables: ["γρά", "φω"] },
                senses: [
                    {
                        gloss: "to write",
                        examples: [
                            {
                                text: "γράφω ένα γράμμα",
                                translation: "I am writing a letter",
                                raw: "{{ux|el|γράφω ένα γράμμα|t=I am writing a letter}}"
                            },
                            "Simple string example"
                        ]
                    }
                ],
                page_links: ["γράμμα", "μολύβι"],
                external_links: ["https://lsj.gr/wiki/γράφω"],
                images: ["File:Writing_hand.jpg"],
                wikidata: {
                    qid: "Q123",
                    instance_of: ["Q1084", "Q215380"], // verb, activity
                    media: { thumbnail: "https://example.com/wd-thumb.jpg" }
                },
                source: { wiktionary: { title: "γράφω" } }
            }
        ],
        metadata: {
            info: { last_modified: "2024-03-29T10:00:00Z" }
        }
    };

    beforeEach(() => {
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockResult as any);
    });

    it("rhymes() should return rhymes array", async () => {
        const result = await rhymes("γράφω", "el");
        expect(result).toEqual(["-afo"]);
    });

    it("homophones() should return homophones array", async () => {
        const result = await homophones("γράφω", "el");
        expect(result).toEqual(["γράφω (variant)"]);
    });

    it("syllableCount() should return correct count", async () => {
        const result = await syllableCount("γράφω", "el");
        expect(result).toBe(2);
    });

    it("audioDetails() should return structured audio with labels", async () => {
        const result = await audioDetails("γράφω", "el");
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("Audio (Greece)");
        expect(result[0].url).toContain("el-grafo.ogg");
    });

    it("exampleDetails() should return only structured examples", async () => {
        const result = await exampleDetails("γράφω", "el");
        expect(result).toHaveLength(1);
        expect(result[0].text).toBe("γράφω ένα γράμμα");
        expect(result[0].translation).toBe("I am writing a letter");
    });

    it("allImages() should aggregate Wikidata and Wiktionary images", async () => {
        const result = await allImages("γράφω", "el");
        expect(result).toContain("https://example.com/wd-thumb.jpg");
        expect(result).toContain("https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Writing_hand.jpg/420px-Writing_hand.jpg");
    });

    it("externalLinks() and internalLinks() should return lists", async () => {
        expect(await externalLinks("γράφω", "el")).toEqual(["https://lsj.gr/wiki/γράφω"]);
        expect(await internalLinks("γράφω", "el")).toEqual(["γράμμα", "μολύβι"]);
    });

    it("isInstance() should check Wikidata P31", async () => {
        expect(await isInstance("γράφω", "Q1084", "el")).toBe(true);
        expect(await isInstance("γράφω", "Q999", "el")).toBe(false);
    });

    it("richEntry() should include new metadata", async () => {
        const entry = await richEntry("γράφω", "el");
        expect(entry).not.toBeNull();
        expect(entry?.wikidata?.instance_of).toContain("Q1084");
        expect(entry?.pronunciation?.audio_details?.[0].label).toBe("Audio (Greece)");
    });
});
