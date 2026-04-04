import { parseTemplates } from "../parser";
import type { SectionLinkItem } from "../types";

export function extractSectionByLevelHeaders(wikitext: string, headerName: string): { raw: string } | null {
    const re = new RegExp(`^=+\\s*${headerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=+.*$`, "im");
    const m = re.exec(wikitext);
    if (!m) return null;
    const start = m.index + m[0].length;
    const after = wikitext.slice(start);
    const next = after.search(/^=+/m);
    const raw = next === -1 ? after : after.slice(0, next);
    return { raw: raw.trim() };
}

export function parseSectionLinkTemplates(wikitext: string): SectionLinkItem[] {
    const items: SectionLinkItem[] = [];
    const tpls = parseTemplates(wikitext);
    for (const t of tpls) {
        if (t.name !== "l" && t.name !== "link") continue;
        const pos = t.params.positional ?? [];
        const lang = pos[0];
        const term = pos[1];
        if (!lang || !term) continue;
        const named = t.params.named ?? {};
        const gloss = named.gloss ?? named.t ?? pos[3] ?? undefined;
        const alt = named.alt ?? pos[2] ?? undefined;
        items.push({ term, lang, gloss, alt, template: t.name, raw: t.raw });
    }
    return items;
}

/** True if `wikitext` contains a section heading for `headerName` (any `=` run, spacing-tolerant). */
export function matchesSectionHeading(wikitext: string, headerName: string): boolean {
    const re = new RegExp(
        `^=+\\s*${headerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=+.*$`,
        "im",
    );
    return re.test(wikitext);
}
