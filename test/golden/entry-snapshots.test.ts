import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { wiktionary } from "../../src/index";
import * as api from "../../src/ingress/api";

vi.mock("../../src/ingress/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/ingress/api")>();
  return {
    ...actual,
    fetchWikitextEnWiktionary: vi.fn(),
    fetchWikidataEntity: vi.fn(),
  };
});

const FIXTURES = resolve(__dirname, "../fixtures");

function stubTitleToFixture(title: string, basename: string) {
  const wikitext = readFileSync(resolve(FIXTURES, `${basename}.wikitext`), "utf-8").normalize("NFC");
  vi.mocked(api.fetchWikitextEnWiktionary).mockImplementation(async (t: string) => {
    if (t.normalize("NFC") !== title.normalize("NFC")) {
      return {
        exists: false,
        title: t,
        wikitext: "",
        pageprops: {},
        categories: [],
        langlinks: [],
        info: {},
        pageid: null,
      };
    }
    return {
      exists: true,
      title,
      wikitext,
      pageprops: {},
      pageid: 1,
      categories: [],
      langlinks: [],
      info: {},
    };
  });
}

/** Stable subset for regression snapshots (no ids, revision fields, or full template dumps). */
function projectLexemes(lexemes: any[]) {
  return lexemes
    .filter((e) => e.type === "LEXEME")
    .map((e) => ({
      language: e.language,
      form: e.form,
      part_of_speech: e.part_of_speech,
      senses: (e.senses || []).map((s: any) => ({
        gloss: s.gloss,
        subsenses: (s.subsenses || []).map((ss: any) => ({ gloss: ss.gloss })),
      })),
      semantic_relations: e.semantic_relations
        ? {
            synonyms: e.semantic_relations.synonyms?.map((x: any) => x.term),
            antonyms: e.semantic_relations.antonyms?.map((x: any) => x.term),
          }
        : undefined,
      etymology: e.etymology?.chain
        ? {
            chain: e.etymology.chain.map((c: any) => ({
              relation: c.relation,
              source_lang: c.source_lang,
              term: c.term,
            })),
          }
        : undefined,
      hyphenation: e.hyphenation?.syllables,
    }));
}

describe("golden: fixture → wiktionary (offline)", () => {
  beforeEach(() => {
    vi.mocked(api.fetchWikidataEntity).mockResolvedValue(null);
  });

  it("basic-verb Greek lexeme", async () => {
    stubTitleToFixture("golden-basic-verb", "basic-verb");
    const res = await wiktionary({ query: "golden-basic-verb", lang: "el", enrich: false });
    expect(projectLexemes(res.lexemes)).toMatchSnapshot();
  });

  it("form-of-inflected Greek INFLECTED_FORM", async () => {
    stubTitleToFixture("golden-form-of", "form-of-inflected");
    const res = await wiktionary({ query: "golden-form-of", lang: "el", enrich: false });
    const inflected = res.lexemes.filter((e) => e.type === "INFLECTED_FORM");
    expect(
      inflected.map((e) => ({
        type: e.type,
        language: e.language,
        form: e.form,
        form_of: e.form_of
          ? { lemma: e.form_of.lemma, lang: e.form_of.lang, tags: e.form_of.tags }
          : undefined,
      }))
    ).toMatchSnapshot();
  });

  it("γράφω rich Greek entry", async () => {
    stubTitleToFixture("γράφω", "γράφω");
    const res = await wiktionary({ query: "γράφω", lang: "el", enrich: false });
    expect(projectLexemes(res.lexemes)).toMatchSnapshot();
  });

  it("nested-templates parser stress fixture", async () => {
    stubTitleToFixture("golden-nested-templates", "nested-templates");
    const res = await wiktionary({ query: "golden-nested-templates", lang: "el", enrich: false });
    expect(projectLexemes(res.lexemes)).toMatchSnapshot();
  });

  it("translations-multi fixture", async () => {
    stubTitleToFixture("golden-translations-multi", "translations-multi");
    const res = await wiktionary({ query: "golden-translations-multi", lang: "el", enrich: false });
    expect(projectLexemes(res.lexemes)).toMatchSnapshot();
  });

  it("nested-pipe-bug regression fixture", async () => {
    stubTitleToFixture("golden-nested-pipe-bug", "nested-pipe-bug");
    const res = await wiktionary({ query: "golden-nested-pipe-bug", lang: "el", enrich: false });
    expect(projectLexemes(res.lexemes)).toMatchSnapshot();
  });
});
