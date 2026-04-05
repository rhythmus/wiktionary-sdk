import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { stem, stemByLexeme } from "../src/convenience/stem";
import * as coreModule from "../src/pipeline/wiktionary-core";
import * as api from "../src/ingress/api";

const FIXTURES_DIR = resolve(__dirname, "fixtures");

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
        fetchWikitextEnWiktionary: vi.fn(),
        fetchWikidataEntity: vi.fn(),
    };
});

function pageFromFixture(title: string, fixtureBase: string) {
    const wikitext = readFileSync(resolve(FIXTURES_DIR, `${fixtureBase}.wikitext`), "utf-8");
    return {
        exists: true as const,
        title,
        wikitext: wikitext.normalize("NFC"),
        pageprops: {} as Record<string, unknown>,
        categories: [] as string[],
        langlinks: [] as { lang: string; title: string }[],
        info: {} as Record<string, unknown>,
        pageid: 1,
    };
}

describe("stem extraction", () => {
    beforeEach(() => {
        vi.mocked(api.fetchWikidataEntity).mockResolvedValue(null);
        vi.mocked(api.fetchWikitextEnWiktionary).mockImplementation(async (title: string) => {
            const t = title.normalize("NFC");
            if (t === "γράφω") return pageFromFixture("γράφω", "γράφω");
            if (t === "άνθρωπος") return pageFromFixture("άνθρωπος", "άνθρωπος");
            if (t === "καλός") {
                return {
                    exists: true as const,
                    title: "καλός",
                    wikitext:
                        "==Greek==\n===Adjective===\n{{el-decl-adj|dec=ός-ή-ό|stem=καλ}}\n",
                    pageprops: {},
                    categories: [] as string[],
                    langlinks: [] as { lang: string; title: string }[],
                    info: {},
                    pageid: 1,
                };
            }
            return {
                exists: false as const,
                title: t,
                wikitext: "",
                pageprops: {},
                categories: [] as string[],
                langlinks: [] as { lang: string; title: string }[],
                info: {},
                pageid: null,
            };
        });
    });

    it("should extract grammatical stems faithfully from native verb templates", async () => {
        const mockFetchWiktionaryResult = {
            lexemes: [{
                id: "el:γράφω#E1#verb#LEXEME",
                language: "el",
                type: "LEXEME",
                form: "γράφω",
                part_of_speech_heading: "Verb",
                templates_all: [{
                    name: "el-conjug-1st",
                    raw: "{{el-conjug-1st|augmented=1|present=γράφ|a-imperfect=έγραφ|a-dependent=γράψ}}",
                    params: {
                        positional: [],
                        named: { augmented: "1", present: "γράφ", "a-imperfect": "έγραφ", "a-dependent": "γράψ" }
                    }
                }]
            }],
            rawLanguageBlock: "==Greek==\n===Verb===\n{{el-conjug-1st|augmented=1|present=γράφ|a-imperfect=έγραφ|a-dependent=γράψ}}"
        };
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);

        const results = await stemByLexeme("γράφω");
        expect(results.order).toHaveLength(1);
        const stems = results.lexemes[results.order[0]].value;
        expect(stems.verb).toBeDefined();
        expect(stems.verb?.present).toEqual(["γράφ"]);
        expect(stems.verb?.imperfect).toEqual(["έγραφ"]);
        expect(stems.verb?.dependent).toEqual(["γράψ"]);
        expect(stems.aliases).toEqual(expect.arrayContaining(["γράφ", "έγραφ", "γράψ"]));
    });

    it("should extract positional stems natively from noun declension templates", async () => {
        const mockFetchWiktionaryResult = {
            lexemes: [{
                id: "el:άνθρωπος#E1#noun#LEXEME",
                language: "el",
                type: "LEXEME",
                form: "άνθρωπος",
                part_of_speech_heading: "Noun",
                templates_all: [{
                    name: "el-nM-ος-οι-3b",
                    raw: "{{el-nM-ος-οι-3b|άνθρωπ|ανθρώπ}}",
                    params: {
                        positional: ["άνθρωπ", "ανθρώπ"],
                        named: {}
                    }
                }]
            }],
            rawLanguageBlock: "==Greek==\n===Noun===\n{{el-nM-ος-οι-3b|άνθρωπ|ανθρώπ}}"
        };
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);

        const results = await stemByLexeme("άνθρωπος");
        const stems = results.lexemes[results.order[0]].value;
        expect(stems.verb).toBeUndefined();
        expect(stems.nominals).toEqual(["άνθρωπ", "ανθρώπ"]);
        expect(stems.aliases).toEqual(expect.arrayContaining(["άνθρωπ", "ανθρώπ"]));
    });

    it("should extract stems accurately from adjective templates featuring named stem parameters", async () => {
        const mockFetchWiktionaryResult = {
            lexemes: [{
                id: "el:καλός#E1#adj#LEXEME",
                language: "el",
                type: "LEXEME",
                form: "καλός",
                part_of_speech_heading: "Adjective",
                templates_all: [{
                    name: "el-decl-adj",
                    raw: "{{el-decl-adj|dec=ός-ή-ό|stem=καλ}}",
                    params: {
                        positional: [],
                        named: { dec: "ός-ή-ό", stem: "καλ" }
                    }
                }]
            }],
            rawLanguageBlock: "==Greek==\n===Adjective===\n{{el-decl-adj|dec=ός-ή-ό|stem=καλ}}"
        };
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);

        const results = await stemByLexeme("καλός");
        const stems = results.lexemes[results.order[0]].value;
        expect(stems.verb).toBeUndefined();
        expect(stems.nominals).toEqual(["καλ"]);
        expect(stems.aliases).toEqual(["καλ"]);
    });

    it("should return grouped aliases from stem()", async () => {
        const mockFetchWiktionaryResult = {
            lexemes: [
                {
                    id: "grc:γράφω#E1#verb#LEXEME",
                    language: "grc",
                    type: "LEXEME",
                    form: "γράφω",
                    part_of_speech_heading: "Verb",
                    templates_all: []
                },
                {
                    id: "el:γράφω#E1#verb#LEXEME",
                    language: "el",
                    type: "LEXEME",
                    form: "γράφω",
                    part_of_speech_heading: "Verb",
                    templates_all: [{
                        name: "el-conjug-1st",
                        raw: "{{el-conjug-1st|present=γράφ|a-imperfect=έγραφ|a-dependent=γράψ}}",
                        params: {
                            positional: [],
                            named: { present: "γράφ", "a-imperfect": "έγραφ", "a-dependent": "γράψ" }
                        }
                    }]
                }
            ],
            rawLanguageBlock: "==Greek==\n===Verb===\n{{el-conjug-1st|present=γράφ|a-imperfect=έγραφ|a-dependent=γράψ}}"
        };
        vi.mocked(coreModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);

        const grouped = await stem("γράφω");
        const greek = grouped.order
            .map((id) => ({ id, ...grouped.lexemes[id] }))
            .find((r) => r.language === "el");
        expect(greek?.value).toEqual(expect.arrayContaining(["γράφ", "έγραφ", "γράψ"]));
    });
});
