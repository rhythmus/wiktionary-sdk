/**
 * Audit §13.8 — parseMorphologyTags combinations.
 */
import { describe, it, expect } from "vitest";
import { parseMorphologyTags } from "../src/convenience/morphology";

describe("parseMorphologyTags audit (§13.8)", () => {
  it("maps person+number shorthand tags", () => {
    expect(parseMorphologyTags(["1", "s"])).toMatchObject({ person: "1", number: "singular" });
    expect(parseMorphologyTags(["3", "pl"])).toMatchObject({ person: "3", number: "plural" });
    expect(parseMorphologyTags(["2sg"])).toMatchObject({ person: "2", number: "singular" });
  });

  it("maps tense, mood, voice, case, gender", () => {
    expect(parseMorphologyTags(["pres", "indc", "actv"])).toMatchObject({
      tense: "present",
      mood: "indicative",
      voice: "active",
    });
    expect(parseMorphologyTags(["acc", "f"])).toMatchObject({
      case: "accusative",
      gender: "feminine",
    });
  });

  it("last tag wins on conflicting slots in one array scan", () => {
    const t = parseMorphologyTags(["1", "2", "s"]);
    expect(t.person).toBe("2");
    expect(t.number).toBe("singular");
  });
});
