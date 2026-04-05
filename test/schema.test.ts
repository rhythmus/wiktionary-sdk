import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Lexeme, FetchResult } from "../src/model";

const schemaPath = resolve(__dirname, "../schema/normalized-entry.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function makeLexemeEntry(overrides?: Partial<Lexeme>): Lexeme {
  return {
    id: "el:γράφω#E1#verb#LEXEME",
    language: "el",
    query: "γράφω",
    type: "LEXEME",
    form: "γράφω",
    etymology_index: 1,
    part_of_speech_heading: "Verb",
    lexicographic_section: "verb",
    lexicographic_family: "pos",
    part_of_speech: "verb",
    templates: {
      "el-verb": [{
        params: { positional: [], named: {} },
        raw: "{{el-verb}}",
      }],
    },
    source: {
      wiktionary: {
        site: "en.wiktionary.org",
        title: "γράφω",
        language_section: "Greek",
        etymology_index: 1,
        pos_heading: "Verb",
      },
    },
    ...overrides,
  };
}

describe("JSON Schema validation", () => {
  it("validates a minimal FetchResult with schema_version", () => {
    const result: FetchResult = {
      schema_version: "1.0.0",
      rawLanguageBlock: "==Greek==\nsome content",
      lexemes: [makeLexemeEntry()],
      notes: [],
    };
    const valid = validate(result);
    if (!valid) console.error(validate.errors);
    expect(valid).toBe(true);
    expect(result.schema_version).toBe("1.0.0");
  });

  it("validates an entry with pronunciation", () => {
    const result: FetchResult = {
      schema_version: "1.0.0",
      rawLanguageBlock: "==Greek==",
      lexemes: [makeLexemeEntry({ pronunciation: { IPA: "/ˈɣra.fo/" } })],
      notes: [],
    };
    expect(validate(result)).toBe(true);
  });

  it("validates an inflected form entry", () => {
    const entry = makeLexemeEntry({
      type: "INFLECTED_FORM",
      form_of: {
        template: "inflection of",
        lemma: "γράφω",
        lang: "el",
        tags: ["1", "s", "pres", "ind", "act"],
        named: {},
      },
    });
    const result: FetchResult = {
      schema_version: "1.0.0",
      rawLanguageBlock: "==Greek==",
      lexemes: [entry],
      notes: [],
    };
    expect(validate(result)).toBe(true);
  });

  it("rejects an entry missing required fields", () => {
    const bad = {
      schema_version: "1.0.0",
      rawLanguageBlock: "",
      lexemes: [{ id: "x" }],
      notes: [],
    };
    expect(validate(bad)).toBe(false);
  });

  it("rejects FetchResult without schema_version", () => {
    const bad = {
      rawLanguageBlock: "",
      lexemes: [makeLexemeEntry()],
      notes: [],
    };
    expect(validate(bad)).toBe(false);
  });
});
