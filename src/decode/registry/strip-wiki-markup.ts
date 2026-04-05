function findMatching(text: string, start: number, open: string, close: string): number {
    let depth = 1;
    let j = start;
    while (j < text.length) {
        if (text.startsWith(open, j)) {
            depth++;
            j += open.length;
        } else if (text.startsWith(close, j)) {
            depth--;
            if (depth === 0) return j;
            j += close.length;
        } else {
            j++;
        }
    }
    return -1;
}

/**
 * Brace-aware wiki markup stripper. Handles nested [[links]], {{templates}},
 * '''bold''', ''italic'' without regex-induced duplication or mis-parsing.
 * [[link|display]] → display; [[link]] → link; {{...}} → removed.
 */
export function stripWikiMarkup(text: string, options: { preserveEmphasis?: boolean } = {}): string {
    const { preserveEmphasis = false } = options;
    // Strip inline refs first so they never leak into notes/senses.
    text = text
        .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "")
        .replace(/<ref\b[^>]*\/>/gi, "");

    const out: string[] = [];
    let i = 0;
    while (i < text.length) {
        if (text.startsWith("[[", i)) {
            const end = findMatching(text, i + 2, "[[", "]]");
            if (end !== -1) {
                const inner = text.slice(i + 2, end);
                const pipeIdx = inner.indexOf("|");
                const display = pipeIdx >= 0 ? inner.slice(pipeIdx + 1) : inner;
                out.push(stripWikiMarkup(display, options));
                i = end + 2;
                continue;
            }
        }
        if (text.startsWith("{{", i)) {
            const end = findMatching(text, i + 2, "{{", "}}");
            if (end !== -1) {
                // Keep visible term for link-like templates; drop others.
                const inner = text.slice(i + 2, end);
                const parts = inner.split("|");
                const rawName = (parts[0] || "").trim().toLowerCase();
                if (["l", "link", "m", "mention", "alt", "alter"].includes(rawName)) {
                    const term = parts[2]?.trim();
                    if (term) out.push(term);
                }
                i = end + 2;
                continue;
            }
        }
        if (text.startsWith("'''", i)) {
            const end = text.indexOf("'''", i + 3);
            if (end !== -1) {
                const inner = stripWikiMarkup(text.slice(i + 3, end), options);
                out.push(preserveEmphasis ? `**${inner}**` : inner);
                i = end + 3;
                continue;
            }
        }
        if (text.startsWith("''", i) && !text.startsWith("'''", i)) {
            const end = text.indexOf("''", i + 2);
            if (end !== -1) {
                const inner = stripWikiMarkup(text.slice(i + 2, end), options);
                out.push(preserveEmphasis ? `*${inner}*` : inner);
                i = end + 2;
                continue;
            }
        }
        out.push(text[i]);
        i++;
    }
    return out
        .join("")
        // Drop any leftover HTML tags that are not semantic output.
        .replace(/<\/?[^>]+>/g, "")
        // Normalize whitespace and punctuation spacing after tag/template removal.
        .replace(/\s+/g, " ")
        .replace(/\s+([,;:.!?])/g, "$1")
        .replace(/([,;:.!?])\s*([,;:.!?])+/g, "$1")
        .trim();
}
