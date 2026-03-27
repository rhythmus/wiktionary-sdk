import { describe, it, expect, vi } from "vitest";
import { stem } from "../src/stem";
import * as indexModule from "../src/index";

vi.mock("../src/index", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/index")>();
    return {
        ...actual,
        wiktionary: vi.fn(),
    };
});

describe("stem extraction", () => {
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
