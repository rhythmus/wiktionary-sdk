import { deepMerge } from "../utils";

export function mergePatches(patches: any[]) {
    const out = {};
    for (const p of patches) {
        deepMerge(out, p);
    }
    return out;
}
