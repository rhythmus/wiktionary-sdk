import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { stem } from "../src/stem";
import * as indexModule from "../src/index";
import * as api from "../src/api";

const FIXTURES_DIR = resolve(__dirname, "fixtures");

vi.mock("../src/index", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/index")>();
    return {
        ...actual,
        wiktionary: vi.fn(),
    };
});

// stem() calls lemma() first; lemma uses the real wiktionary from library.ts.
vi.mock("../src/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/api")>();
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
        // Arrange
        const mockFetchWiktionaryResult = {
            entries: [{ type: "LEXEME", form: "γράφω" }],
            rawLanguageBlock: "==Greek==\n===Verb===\n{{el-conjug-1st|augmented=1|present=γράφ|a-imperfect=έγραφ|a-dependent=γράψ}}"
        };
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);

        // Act
        const stems = await stem("γράφω");

        // Assert
        expect(stems.verb).toBeDefined();
        expect(stems.verb?.present).toEqual(["γράφ"]);
        expect(stems.verb?.imperfect).toEqual(["έγραφ"]);
        expect(stems.verb?.dependent).toEqual(["γράψ"]);
        expect(stems.aliases).toEqual(expect.arrayContaining(["γράφ", "έγραφ", "γράψ"]));
    });

    it("should extract positional stems natively from noun declension templates", async () => {
        // Arrange
        const mockFetchWiktionaryResult = {
            entries: [{ type: "LEXEME", form: "άνθρωπος" }],
            rawLanguageBlock: "==Greek==\n===Noun===\n{{el-nM-ος-οι-3b|άνθρωπ|ανθρώπ}}"
        };
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);

        // Act
        const stems = await stem("άνθρωπος");

        // Assert
        expect(stems.verb).toBeUndefined();
        expect(stems.nominals).toEqual(["άνθρωπ", "ανθρώπ"]);
        expect(stems.aliases).toEqual(expect.arrayContaining(["άνθρωπ", "ανθρώπ"]));
    });

    it("should extract stems accurately from adjective templates featuring named stem parameters", async () => {
        // Arrange
        const mockFetchWiktionaryResult = {
            entries: [{ type: "LEXEME", form: "καλός" }],
            rawLanguageBlock: "==Greek==\n===Adjective===\n{{el-decl-adj|dec=ός-ή-ό|stem=καλ}}"
        };
        vi.mocked(indexModule.wiktionary).mockResolvedValue(mockFetchWiktionaryResult as any);

        // Act
        const stems = await stem("καλός");

        // Assert
        expect(stems.verb).toBeUndefined();
        expect(stems.nominals).toEqual(["καλ"]);
        expect(stems.aliases).toEqual(["καλ"]);
    });
});
