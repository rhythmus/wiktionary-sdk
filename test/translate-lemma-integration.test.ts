/**
 * Fixture-backed integration for lemma resolution and translate(gloss) paths.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { lemma, translate, asLexemeRows } from "../src/index";
import * as api from "../src/ingress/api";

vi.mock("../src/ingress/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ingress/api")>();
  return {
    ...actual,
    fetchWikitextEnWiktionary: vi.fn(),
    fetchWikidataEntity: vi.fn(),
  };
});

const FIXTURES_DIR = resolve(__dirname, "fixtures");

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, `${name}.wikitext`), "utf-8");
}

function mockMissingPage(title: string) {
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

describe("integration: lemma + translate (gloss) on fixtures", () => {
  beforeEach(() => {
    const inflected = loadFixture("έγραψε").normalize("NFC");
    const lemmaPage = loadFixture("translations-multi").normalize("NFC");

    vi.mocked(api.fetchWikitextEnWiktionary).mockImplementation(async (title: string) => {
      const t = title.normalize("NFC");
      if (t === "έγραψε") {
        return {
          exists: true,
          title: t,
          wikitext: inflected,
          pageprops: {},
          categories: [],
          images: [],
          page_links: [],
          external_links: [],
          langlinks: [],
          info: {},
          pageid: 1001,
        };
      }
      if (t === "γράφω") {
        return {
          exists: true,
          title: t,
          wikitext: lemmaPage,
          pageprops: {},
          categories: [],
          images: [],
          page_links: [],
          external_links: [],
          langlinks: [],
          info: {},
          pageid: 1002,
        };
      }
      return mockMissingPage(t);
    });

    vi.mocked(api.fetchWikidataEntity).mockResolvedValue(null);
  });

  it("resolves INFLECTED_FORM query to lemma from fixture wikitext", async () => {
    const l = await lemma("έγραψε", "el");
    expect(l).toBe("γράφω");
  });

  it("translates via gloss mode after lemma resolution on fixtures", async () => {
    const de = await translate("έγραψε", "el", "de", { mode: "gloss" });
    const deTerms = asLexemeRows(de).flatMap((r) => r.value as string[]);
    expect(deTerms).toContain("schreiben");

    const fr = await translate("έγραψε", "el", "fr", { mode: "gloss" });
    const frTerms = asLexemeRows(fr).flatMap((r) => r.value as string[]);
    expect(frTerms).toContain("écrire");
  });
});
