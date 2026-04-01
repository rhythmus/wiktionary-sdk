import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "fs";
import { resolve } from "path";

const schemaPath = resolve(__dirname, "../schema/normalized-entry.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function validBaseResult() {
  return {
    schema_version: "1.0.0",
    rawLanguageBlock: "==English==",
    notes: [],
    lexemes: [
      {
        id: "en:dog#E1#noun#LEXEME",
        language: "en",
        query: "dog",
        type: "LEXEME",
        form: "dog",
        etymology_index: 1,
        part_of_speech_heading: "Noun",
        templates: {
          "en-noun": [{ params: { positional: [], named: {} }, raw: "{{en-noun}}" }],
        },
        source: {
          wiktionary: {
            site: "en.wiktionary.org",
            title: "dog",
            language_section: "English",
            etymology_index: 1,
            pos_heading: "Noun",
          },
        },
      },
    ],
  };
}

describe("negative schema hardening", () => {
  it("rejects malformed nested objects and invalid scalar formats", () => {
    const cases: Array<{ name: string; mutate: (x: any) => void; expectKeyword?: string }> = [
      {
        name: "invalid wikidata qid pattern",
        mutate: (x) => {
          x.lexemes[0].wikidata = { qid: "144" };
        },
        expectKeyword: "pattern",
      },
      {
        name: "invalid media thumbnail uri",
        mutate: (x) => {
          x.lexemes[0].wikidata = { qid: "Q144", media: { thumbnail: "not-a-url" } };
        },
        expectKeyword: "format",
      },
      {
        name: "unknown pronunciation property rejected",
        mutate: (x) => {
          x.lexemes[0].pronunciation = { IPA: "/dɔɡ/", bogus: "x" };
        },
        expectKeyword: "additionalProperties",
      },
      {
        name: "invalid langlinks shape rejected",
        mutate: (x) => {
          x.lexemes[0].langlinks = [{ lang: "fr" }];
        },
        expectKeyword: "required",
      },
      {
        name: "invalid external link uri rejected",
        mutate: (x) => {
          x.lexemes[0].external_links = ["nota-uri"];
        },
        expectKeyword: "format",
      },
      {
        name: "negative etymology index rejected",
        mutate: (x) => {
          x.lexemes[0].source.wiktionary.etymology_index = -1;
        },
        expectKeyword: "minimum",
      },
      {
        name: "extra source.wiktionary fields rejected",
        mutate: (x) => {
          x.lexemes[0].source.wiktionary.extra = "nope";
        },
        expectKeyword: "additionalProperties",
      },
    ];

    for (const c of cases) {
      const sample = validBaseResult();
      c.mutate(sample);
      const ok = validate(sample);
      expect(ok, c.name).toBe(false);
      if (c.expectKeyword) {
        const keywords = (validate.errors || []).map((e) => e.keyword);
        expect(keywords, c.name).toContain(c.expectKeyword);
      }
    }
  });
});

