import { describe, it, expect } from "vitest";
import { registry } from "../src/decode/registry";
import { EXPECTED_DECODER_IDS } from "../src/decode/registry/decoder-ids";

describe("registry decoder registration order", () => {
    it("matches the canonical id sequence (phase 4.3)", () => {
        const actual = registry.getDecoders().map((d) => d.id);
        expect(actual).toEqual([...EXPECTED_DECODER_IDS]);
    });
});
