import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { PART_OF_SPEECH_VALUES } from "../src/types";

const schemaPath = resolve(__dirname, "../schema/normalized-entry.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as {
  $defs: { PartOfSpeech: { enum: string[] } };
};

describe("PartOfSpeech schema parity", () => {
  it("JSON Schema $defs.PartOfSpeech.enum matches PART_OF_SPEECH_VALUES", () => {
    const fromSchema = [...schema.$defs.PartOfSpeech.enum].sort();
    const fromTs = [...PART_OF_SPEECH_VALUES].sort();
    expect(fromSchema).toEqual(fromTs);
  });
});
