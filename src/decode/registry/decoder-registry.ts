import type { DecodeContext, TemplateDecoder, DecoderDebugEvent } from "../../types";
import { mergePatches } from "./merge-patches";

export class DecoderRegistry {
    private decoders: TemplateDecoder[] = [];
    constructor() {}
    register(decoder: TemplateDecoder) {
        this.decoders.push(decoder);
    }
    decodeAll(ctx: DecodeContext, options?: { debug?: boolean }): { patch: any; debug?: DecoderDebugEvent[] } {
        const patches: any[] = [];
        const debugEvents: DecoderDebugEvent[] = [];
        for (const d of this.decoders) {
            if (!d.matches(ctx)) continue;
            const patch = d.decode(ctx);
            patches.push(patch);
            if (options?.debug) {
                const entryPatch = patch?.entry ?? {};
                const fieldsProduced = Object.keys(entryPatch).filter((k) => k !== "templates");
                const matchedTemplates = ctx.templates
                    .filter((t) => decoderMatchesTemplate(d, t, ctx))
                    .map((t) => ({ raw: t.raw, name: t.name }));
                if (matchedTemplates.length > 0 || fieldsProduced.length > 0) {
                    debugEvents.push({
                        decoderId: d.id,
                        matchedTemplates,
                        fieldsProduced: fieldsProduced.length > 0 ? fieldsProduced : ["templates"],
                    });
                }
            }
        }
        const merged = mergePatches(patches);
        if (options?.debug) {
            return { patch: merged, debug: debugEvents };
        }
        return merged as any;
    }
    getDecoders(): TemplateDecoder[] {
        return [...this.decoders];
    }
    /** All template names declared as handled by registered decoders. */
    getHandledTemplates(): Set<string> {
        const out = new Set<string>();
        for (const d of this.decoders) {
            for (const t of d.handlesTemplates ?? []) {
                out.add(t);
            }
        }
        return out;
    }
}

function decoderMatchesTemplate(d: TemplateDecoder, t: { name: string }, ctx: DecodeContext): boolean {
    if (d.handlesTemplates) return d.handlesTemplates.includes(t.name);
    const singleTplCtx = { ...ctx, templates: [t as any], posBlockWikitext: ctx.posBlockWikitext };
    return d.matches(singleTplCtx);
}
