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
                const inner = text.slice(i + 2, end);
                const parts = inner.split("|");
                const rawName = (parts[0] || "").trim().toLowerCase();

                // {{l|lang|term}}, {{m|lang|term}} — display term (param 3)
                if (["l", "link", "m", "mention", "alt", "alter"].includes(rawName)) {
                    const term = parts[2]?.trim();
                    if (term) out.push(stripWikiMarkup(term, options));
                }
                // {{w|page|display?}} — Wikipedia link: display or page name
                else if (rawName === "w" || rawName === "w2" || rawName === "pedlink") {
                    const display = (parts[2] ?? parts[1] ?? "").trim();
                    if (display) out.push(stripWikiMarkup(display, options));
                }
                // {{vern|name}} — vernacular name (param 1)
                else if (rawName === "vern") {
                    const name = (parts[1] ?? "").trim();
                    if (name) out.push(stripWikiMarkup(name, options));
                }
                // {{taxlink|name|rank}} / {{taxfmt|name|rank}} — taxon name (param 1)
                else if (rawName === "taxlink" || rawName === "taxfmt") {
                    const name = (parts[1] ?? "").trim();
                    if (name) out.push(stripWikiMarkup(name, options));
                }
                // {{gloss|text}} / {{gl|text}} — inline gloss
                else if (rawName === "gloss" || rawName === "gl") {
                    const g = (parts[1] ?? "").trim();
                    if (g) out.push(stripWikiMarkup(g, options));
                }
                // {{non-gloss definition|text}} / {{non-gloss|text}} / {{ngd|text}}
                else if (rawName === "non-gloss definition" || rawName === "non-gloss" || rawName === "ngd" || rawName === "n-g") {
                    const g = (parts[1] ?? "").trim();
                    if (g) out.push(stripWikiMarkup(g, options));
                }
                // {{taxon|rank|parent_rank|parent_name|description}} — taxonomic definition
                else if (rawName === "taxon") {
                    const rank = stripWikiMarkup(parts[1] ?? "", options).trim();
                    const parentRank = stripWikiMarkup(parts[2] ?? "", options).trim();
                    const parentName = stripWikiMarkup(parts[3] ?? "", options).trim();
                    const desc = stripWikiMarkup(parts[4] ?? "", options).trim();
                    let phrase = `A taxonomic ${rank || "taxon"}`;
                    if (parentRank && parentName) phrase += ` within the ${parentRank} ${parentName}`;
                    if (desc) phrase += ` \u2013 ${desc}`;
                    out.push(phrase);
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
