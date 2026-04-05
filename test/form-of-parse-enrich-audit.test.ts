/**
 * Audit §13.7 — form-of parse enrichment gates and mwFetchJson integration (mocked).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enrichLexemeFormOfMorphLinesFromParse,
  lexemeNeedsFormOfParseEnrichment,
  extractFormOfMorphLinesFromParsedHtml,
} from "../src/pipeline/form-of-parse-enrich";
import * as api from "../src/ingress/api";
import type { Lexeme } from "../src/types";

vi.mock("../src/ingress/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ingress/api")>();
  return { ...actual, mwFetchJson: vi.fn() };
});

function baseLexeme(over: Partial<Lexeme> = {}): Lexeme {
  return {
    id: "es:sense#1#verb#INFLECTED_FORM",
    language: "es",
    query: "sense",
    type: "INFLECTED_FORM",
    form: "sense",
    etymology_index: 1,
    part_of_speech_heading: "Verb",
    lexicographic_section: "verb",
    lexicographic_family: "pos",
    part_of_speech: "verb",
    templates: {},
    source: {
      wiktionary: {
        site: "en.wiktionary.org",
        title: "sense",
        language_section: "Spanish",
        etymology_index: 1,
        pos_heading: "Verb",
      },
    },
    form_of: {
      template: "es-verb form of",
      lemma: "sensar",
      lang: "es",
      tags: [],
      label: "Verb form",
      named: {},
    },
    senses: [
      {
        id: "S1",
        gloss: "verb form",
        gloss_raw: "{{es-verb form of|sensar}}",
      },
    ],
    ...over,
  } as Lexeme;
}

describe("form-of-parse-enrich audit (§13.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lexemeNeedsFormOfParseEnrichment is true for bare es-verb form of stub", () => {
    expect(lexemeNeedsFormOfParseEnrichment(baseLexeme())).toBe(true);
  });

  it("lexemeNeedsFormOfParseEnrichment is false when subsenses exist", () => {
    const lex = baseLexeme({
      senses: [
        {
          id: "S1",
          gloss: "x",
          gloss_raw: "{{es-verb form of|sensar}}",
          subsenses: [{ id: "S1.1", gloss: "detail" }],
        },
      ],
    });
    expect(lexemeNeedsFormOfParseEnrichment(lex)).toBe(false);
  });

  it("lexemeNeedsFormOfParseEnrichment is false when display_morph_lines already set", () => {
    const lex = baseLexeme({
      form_of: {
        ...baseLexeme().form_of!,
        display_morph_lines: ["already"],
        display_morph_lines_source: "mediawiki_parse",
      },
    });
    expect(lexemeNeedsFormOfParseEnrichment(lex)).toBe(false);
  });

  it("extractFormOfMorphLinesFromParsedHtml returns [] when no nested ol", () => {
    expect(extractFormOfMorphLinesFromParsedHtml("<div><p>plain</p></div>")).toEqual([]);
  });

  it("enrichLexemeFormOfMorphLinesFromParse fills display_morph_lines from parse HTML", async () => {
    const html = `<ol><li><ol><li>first-person singular present subjunctive</li></ol></li></ol>`;
    vi.mocked(api.mwFetchJson).mockResolvedValue({ parse: { text: html } } as any);

    const lex = baseLexeme();
    await enrichLexemeFormOfMorphLinesFromParse(lex, "sense");

    expect(lex.form_of?.display_morph_lines).toEqual(["first-person singular present subjunctive"]);
    expect(lex.form_of?.display_morph_lines_source).toBe("mediawiki_parse");
  });
});
