/**
 * Non-Vitest guard: fails if a fresh DecoderRegistry’s id sequence drifts from
 * `src/decode/registry/decoder-ids.ts` (e.g. pre-publish or CI).
 */
import { DecoderRegistry } from "../src/decode/registry/decoder-registry";
import { EXPECTED_DECODER_IDS } from "../src/decode/registry/decoder-ids";
import { registerAllDecoders } from "../src/decode/registry/register-all-decoders";

const reg = new DecoderRegistry();
registerAllDecoders(reg);
const actual = reg.getDecoders().map((d) => d.id);
const expected = [...EXPECTED_DECODER_IDS];

let ok = true;
if (actual.length !== expected.length) {
    ok = false;
    console.error(
        `assert-registry-order: length mismatch actual=${actual.length} expected=${expected.length}`,
    );
} else {
    for (let i = 0; i < actual.length; i++) {
        if (actual[i] !== expected[i]) {
            ok = false;
            console.error(
                `assert-registry-order: at index ${i}: actual="${actual[i]}" expected="${expected[i]}"`,
            );
            break;
        }
    }
}

if (!ok) {
    console.error("Full actual:", JSON.stringify(actual));
    process.exit(1);
}

console.log("assert-registry-order: OK (" + actual.length + " decoders)");
