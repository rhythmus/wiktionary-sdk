import { stripWikiMarkup } from "./strip-wiki-markup";

/** Strip refs and flatten usage-note section lines for structured output. */
export function formatUsageNoteLine(rawLine: string): string {
    const refs: string[] = [];
    const withMarkers = rawLine
        .replace(/<ref\b[^>]*>([\s\S]*?)<\/ref>/gi, (_m, inner: string) => {
            const cleaned = stripWikiMarkup(inner, { preserveEmphasis: true }).trim();
            if (!cleaned) return "";
            refs.push(cleaned);
            return ` [${refs.length}]`;
        })
        .replace(/<ref\b[^>]*\/>/gi, "");

    const base = stripWikiMarkup(withMarkers, { preserveEmphasis: true }).trim();
    if (!base) return "";
    if (refs.length === 0) return base;

    const footnotes = refs.map((r, idx) => `[${idx + 1}] ${r}`).join(" ");
    return `${base} (${footnotes})`;
}
