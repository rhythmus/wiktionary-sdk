import type { EtymologyStep } from "./library";
import type { GrammarTraits } from "./morphology";
import type { WordStems } from "./stem";
import { Sense, RichEntry, InflectionTable, SCHEMA_VERSION, EtymologyData } from "./types";
import Handlebars from "handlebars";
import fs from "fs";
import path from "path";

/**
 * Supported output formats for the generic formatter.
 */
export type FormatMode = "text" | "markdown" | "html" | "ansi" | "terminal-html" | string;

/**
 * Interface defining the requirements for a formatting style.
 * Implementing this interface allows anyone to create new output formats 
 * (e.g. LaTeX, CSV, YAML) for the SDK.
 */
export interface FormatterStyle {
    /** Formats a simple array of strings (Translations, Syllables, Synonyms). */
    array(arr: string[], options: FormatOptions): string;
    /** Formats morphological properties. */
    grammar(traits: Partial<GrammarTraits>, options: FormatOptions): string;
    /** Formats the linguistic stem aliases of a word. */
    stems(stems: WordStems, options: FormatOptions): string;
    /** Formats the etymological lineage steps. */
    etymology(data: EtymologyData | EtymologyStep[], options: FormatOptions): string;
    /** Formats lexical definitions/senses. */
    senses(senses: Sense[], options: FormatOptions): string;
    /** Formats a full inflectional paradigm table. */
    table(table: InflectionTable, options: FormatOptions): string;
    /** Formats a comprehensive dictionary entry. */
    rich(entry: RichEntry, options: FormatOptions): string;
    /** Formats null or undefined values. */
    nullValue(): string;
}

/**
 * Configuration for the smart formatter.
 */
export interface FormatOptions {
    /** Output style ID (e.g. "text", "markdown", "html"). Defaults to "text". */
    mode?: FormatMode;
    /** How to join multiple items: comma-separated, numbered list, or bulleted list. */
    listStyle?: "comma" | "numbered" | "bullet";
    /** Custom character for joining (e.g. "‧" for syllables). If omitted, defaults based on listStyle. */
    separator?: string;
    /** Optional styling override to use for this specific formatting call. */
    style?: FormatterStyle;
}

/**
 * The central registry of formatting styles.
 */
export const styleRegistry: Record<string, FormatterStyle> = {};

/**
 * Registers a new formatting style globally.
 */
export function registerStyle(name: string, style: FormatterStyle) {
    styleRegistry[name] = style;
}

/**
 * Polymorphic formatter that transforms structured linguistic data into human-readable strings.
 */
export function format(data: any, options: FormatOptions = {}): string {
    const mode = options.mode || "text";
    const style = options.style || styleRegistry[mode] || styleRegistry.text;

    if (!style) return String(data);

    if (data === null || data === undefined) {
        return style.nullValue();
    }

    // 1. Handle Rich Entries (RichEntry)
    if (typeof data === "object" && "headword" in data && "inflection_table" in data) {
        return style.rich(data as RichEntry, options);
    }

    // 2. Handle Inflection Tables (InflectionTable)
    if (typeof data === "object" && !Array.isArray(data) && options.mode === "table") {
        return style.table(data as InflectionTable, options);
    }

    // 3. Handle Simple String Arrays (Hyphenation, Translations, Synonyms)
    if (Array.isArray(data) && (data.length === 0 || typeof data[0] === "string")) {
        return style.array(data as string[], options);
    }

    // 4. Handle Etymology Steps (Array of {lang, form}) or data object
    if ((Array.isArray(data) && data.length > 0 && "lang" in data[0] && "form" in data[0]) || 
        (typeof data === "object" && data !== null && ("chain" in data || "cognates" in data))) {
        return style.etymology(data as any, options);
    }

    // 5. Handle Senses (Definitions)
    if (Array.isArray(data) && data.length > 0 && "gloss" in data[0]) {
        return style.senses(data as Sense[], options);
    }

    // 6. Handle Morphological Traits (GrammarTraits)
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
        const keys = Object.keys(data);
        const isTraits = keys.some(k => ["person", "number", "case", "tense", "gender", "mood", "voice", "aspect"].includes(k));
        if (isTraits || (keys.length === 0 && options.mode === "grammar")) {
            return style.grammar(data as Partial<GrammarTraits>, options);
        }
    }

    // 7. Handle Word Stems
    if (typeof data === "object" && data !== null && "aliases" in data) {
        return style.stems(data as WordStems, options);
    }

    // Fallback to stringification
    const str = String(data);
    return str === "[object Object]" ? "{}" : str;
}

// ---------------------------------------------------------
// STANDARD STYLES IMPLEMENTATIONS
// ---------------------------------------------------------

/**
 * Plaintext Style (The default)
 */
class TextStyle implements FormatterStyle {
    array(arr: string[], opts: FormatOptions): string {
        if (arr.length === 0) return "[]";
        const { listStyle = "comma", separator } = opts;
        if (listStyle === "comma") return arr.join(separator || ", ");
        const prefix = listStyle === "numbered" ? (i: number) => `${i + 1}. ` : () => "• ";
        return arr.map((item, i) => `${prefix(i)}${item}`).join("\n");
    }
    grammar(traits: Partial<GrammarTraits>, _options: FormatOptions): string {
        return formatGrammarBase(traits) || "(none)";
    }
    stems(stems: WordStems, _options: FormatOptions): string {
        if (stems.aliases.length === 0) return "Stems: (none)";
        return `Stems: ${stems.aliases.join(", ")}`;
    }
    etymology(data: EtymologyData | EtymologyStep[], _options: FormatOptions): string {
        if (Array.isArray(data)) {
            if (data.length === 0) return "(none)";
            return data.map(s => `${s.lang} ${s.form}`).join(" < ");
        }
        if (!data || (!data.chain && !data.cognates)) return "(none)";
        const chain = (data.chain || []).map((s: any) => `${s.source_lang_name || s.source_lang} ${s.term}`).join(" < ");
        const cogs = (data.cognates || []).map((s: any) => `cog. ${s.source_lang_name || s.source_lang} ${s.term}`).join(", ");
        return [chain, cogs].filter(Boolean).join("; ");
    }
    senses(senses: Sense[], _options: FormatOptions): string {
        if (senses.length === 0) return "(none)";
        return senses.map((s, i) => `${i + 1}. ${s.gloss}`).join("\n");
    }
    table(table: InflectionTable, options: FormatOptions, depth = 0): string {
        const indent = "  ".repeat(depth);
        return Object.entries(table).map(([key, val]) => {
            if (typeof val === "object" && !Array.isArray(val)) {
                return `${indent}${key}:\n${this.table(val as InflectionTable, options, depth + 1)}`;
            }
            const valStr = Array.isArray(val) ? val.join("/") : String(val);
            return `${indent}${key}: ${valStr}`;
        }).join("\n");
    }
    rich(entry: RichEntry, options: FormatOptions): string {
        const parts: string[] = [];
        parts.push(`=== ${entry.headword} (${entry.pos}) ===`);
        if (entry.morphology) parts.push(`Grammar: ${this.grammar(entry.morphology, options)}`);
        if (entry.pronunciation?.IPA) parts.push(`IPA: ${entry.pronunciation.IPA}`);
        if (entry.etymology) parts.push(`Etymology: ${this.etymology(entry.etymology, options)}`);
        if (entry.senses) parts.push(`Definitions:\n${this.senses(entry.senses, options)}`);
        if (entry.inflection_table) parts.push(`Inflection:\n${this.table(entry.inflection_table, options)}`);
        return parts.join("\n\n");
    }
    nullValue(): string {
        return "null";
    }
}

// ---------------------------------------------------------
// HANDLEBARS SETUP
// ---------------------------------------------------------

const templatesDir = path.join(__dirname, "templates");

function loadTemplate(filename: string): string {
    const filePath = path.join(templatesDir, filename);
    if (!fs.existsSync(filePath)) {
        // Fallback for production/dist environments if templates aren't copied
        return "";
    }
    return fs.readFileSync(filePath, "utf-8");
}

// Register Helpers
Handlebars.registerHelper("join", (arr: string[] | undefined, sep: string) => {
    if (!arr) return "";
    return arr.join(sep);
});

Handlebars.registerHelper("addOne", (index: number) => {
    return index + 1;
});

Handlebars.registerHelper("toUpperCase", (str: string | undefined) => {
    return str ? str.toUpperCase() : "";
});

Handlebars.registerHelper("currentDate", () => {
    return new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
});

Handlebars.registerHelper("ifCond", function (this: any, v1: any, operator: string, v2: any, options: Handlebars.HelperOptions) {
    switch (operator) {
        case "==": return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case "===": return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case "!=": return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case "!==": return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case "<": return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case "<=": return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case ">": return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case ">=": return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case "&&": return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case "||": return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default: return options.inverse(this);
    }
});

const htmlEntryTemplate = Handlebars.compile(loadTemplate("entry.html.hbs"));
const mdEntryTemplate = Handlebars.compile(loadTemplate("entry.md.hbs"));
const entryCss = loadTemplate("entry.css");

/**
 * Markdown Style
 */
class MarkdownStyle extends TextStyle {
    grammar(traits: Partial<GrammarTraits>, _options: FormatOptions): string {
        const base = formatGrammarBase(traits);
        return base ? `*${base}*` : "*(none)*";
    }
    stems(stems: WordStems, _options: FormatOptions): string {
        if (stems.aliases.length === 0) return "Stems: *(none)*";
        const items = stems.aliases.map(s => `\`${s}\``);
        return `Stems: ${items.join(", ")}`;
    }
    etymology(data: EtymologyData | EtymologyStep[], _options: FormatOptions): string {
        if (Array.isArray(data)) {
            if (data.length === 0) return "*(none)*";
            return data.map(s => `${s.lang} **${s.form}**`).join(" ← ");
        }
        if (!data || (!data.chain && !data.cognates)) return "*(none)*";
        const chain = (data.chain || []).map((s: any) => `${s.source_lang_name || s.source_lang} **${s.term}**`).join(" ← ");
        const cogs = (data.cognates || []).map((s: any) => `cog. ${s.source_lang_name || s.source_lang} **${s.term}**`).join(", ");
        return [chain, cogs].filter(Boolean).join("; ");
    }
    table(table: InflectionTable, options: FormatOptions, depth = 0): string {
        const indent = "  ".repeat(depth);
        return Object.entries(table).map(([key, val]) => {
            if (typeof val === "object" && !Array.isArray(val)) {
                return `${indent}- **${key}**:\n${this.table(val as InflectionTable, options, depth + 1)}`;
            }
            const valStr = Array.isArray(val) ? val.map(v => `\`${v}\``).join(", ") : `\`${val}\``;
            return `${indent}- **${key}**: ${valStr}`;
        }).join("\n");
    }
    rich(entry: RichEntry, options: FormatOptions): string {
        // Use Handlebars template for the "Gold Standard" markdown design
        const context = {
            ...entry,
            schema_version: SCHEMA_VERSION,
            standalone: options.mode === "markdown"
        };
        return mdEntryTemplate(context);
    }
    nullValue(): string {
        return "`null`";
    }
}

/**
 * HTML Style
 */
class HtmlStyle extends TextStyle {
    array(arr: string[], opts: FormatOptions): string {
        if (arr.length === 0) return "<code>[]</code>";
        const { listStyle = "comma", separator } = opts;
        if (listStyle === "comma") return arr.join(separator || ", ");
        const prefix = listStyle === "numbered" ? (i: number) => `${i + 1}. ` : () => "• ";
        return arr.map((item, i) => `${prefix(i)}${item}`).join("<br/>");
    }
    grammar(traits: Partial<GrammarTraits>, _options: FormatOptions): string {
        const base = formatGrammarBase(traits);
        return base ? `<i>${base}</i>` : "<i>(none)</i>";
    }
    stems(stems: WordStems, _options: FormatOptions): string {
        if (stems.aliases.length === 0) return "Stems: <i>(none)</i>";
        const items = stems.aliases.map(s => `<code>${s}</code>`);
        return `Stems: ${items.join(", ")}`;
    }
    etymology(steps: EtymologyStep[], _options: FormatOptions): string {
        if (steps.length === 0) return "<i>(none)</i>";
        return steps.map(s => `${s.lang} <b>${s.form}</b>`).join(" ← ");
    }
    senses(senses: Sense[], _options: FormatOptions): string {
        if (senses.length === 0) return "<div>(none)</div>";
        return senses.map((s, i) => `<div>${i + 1}. ${s.gloss}</div>`).join("");
    }
    table(table: InflectionTable, options: FormatOptions, depth = 0): string {
        const indent = "&nbsp;".repeat(depth * 4);
        return Object.entries(table).map(([key, val]) => {
            if (typeof val === "object" && !Array.isArray(val)) {
                return `<div>${indent}<b>${key}</b>:</div>${this.table(val as InflectionTable, options, depth + 1)}`;
            }
            const valStr = Array.isArray(val) ? val.join("/") : String(val);
            return `<div>${indent}${key}: <code>${valStr}</code></div>`;
        }).join("");
    }
    rich(entry: RichEntry, options: FormatOptions): string {
        const standalone = options.mode === "html";
        const context = {
            ...entry,
            schema_version: SCHEMA_VERSION,
            standalone
        };

        let html = htmlEntryTemplate(context);

        if (standalone) {
            // If standalone, wrap in basic HTML structure with the premium CSS
            return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${entry.headword} - Wiktionary Entry</title>
    <style>
        ${entryCss}
        body.dictionary-entry-standalone {
            background-color: #fdfcf8;
            color: #1a1a1a;
            padding: 2rem;
            max-width: 800px;
            margin: 0 auto;
        }
    </style>
</head>
<body class="dictionary-entry-standalone">
    ${html}
</body>
</html>
            `.trim();
        }

        return html;
    }
    nullValue(): string {
        return "<code>null</code>";
    }
}

/**
 * ANSI Terminal Style (Color-coded)
 */
class AnsiStyle extends TextStyle {
    protected readonly C = {
        reset: "\x1b[0m",
        bold: "\x1b[1m",
        italic: "\x1b[3m",
        dim: "\x1b[2m",
        green: "\x1b[32m",
        cyan: "\x1b[36m",
        yellow: "\x1b[33m",
        amber: "\x1b[33m",
        magenta: "\x1b[35m",
    };

    array(arr: string[], opts: FormatOptions): string {
        if (arr.length === 0) return `${this.C.dim}[]${this.C.reset}`;
        const { listStyle = "comma", separator } = opts;
        if (listStyle === "comma") return arr.map(i => `${this.C.green}${i}${this.C.reset}`).join(separator || ", ");
        const prefix = listStyle === "numbered" ? (i: number) => `${this.C.yellow}${i + 1}.${this.C.reset} ` : () => `${this.C.yellow}•${this.C.reset} `;
        return arr.map((item, i) => `${prefix(i)}${this.C.green}${item}${this.C.reset}`).join("\n");
    }
    grammar(traits: Partial<GrammarTraits>, _options: FormatOptions): string {
        const base = formatGrammarBase(traits);
        if (!base) return `${this.C.dim}(none)${this.C.reset}`;
        return `${this.C.italic}${this.C.cyan}${base}${this.C.reset}`;
    }
    stems(stems: WordStems, _options: FormatOptions): string {
        if (stems.aliases.length === 0) return `${this.C.bold}Stems${this.C.reset}: ${this.C.dim}(none)${this.C.reset}`;
        const items = stems.aliases.map(s => `${this.C.bold}${this.C.green}${s}${this.C.reset}`);
        return `${this.C.bold}Stems${this.C.reset}: ${items.join(", ")}`;
    }
    etymology(data: EtymologyData | EtymologyStep[], _options: FormatOptions): string {
        if (Array.isArray(data)) {
            if (data.length === 0) return `${this.C.dim}(none)${this.C.reset}`;
            return data.map(s => `${this.C.cyan}${s.lang}${this.C.reset} ${this.C.bold}${this.C.green}${s.form}${this.C.reset}`).join(` ${this.C.dim}←${this.C.reset} `);
        }
        if (!data || (!data.chain && !data.cognates)) return `${this.C.dim}(none)${this.C.reset}`;
        const chain = (data.chain || []).map((s: any) => `${this.C.cyan}${s.source_lang_name || s.source_lang}${this.C.reset} ${this.C.bold}${this.C.green}${s.term}${this.C.reset}`).join(` ${this.C.dim}←${this.C.reset} `);
        const cogs = (data.cognates || []).map((s: any) => `cog. ${this.C.cyan}${s.source_lang_name || s.source_lang}${this.C.reset} ${this.C.bold}${this.C.green}${s.term}${this.C.reset}`).join(", ");
        return [chain, cogs].filter(Boolean).join("; ");
    }
    senses(senses: Sense[], _options: FormatOptions): string {
        if (senses.length === 0) return `${this.C.dim}(none)${this.C.reset}`;
        return senses.map((s, i) => `${this.C.yellow}${i + 1}.${this.C.reset} ${s.gloss}`).join("\n");
    }
    table(table: InflectionTable, options: FormatOptions, depth = 0): string {
        const indent = "  ".repeat(depth);
        return Object.entries(table).map(([key, val]) => {
            if (typeof val === "object" && !Array.isArray(val)) {
                return `${indent}${this.C.bold}${this.C.yellow}${key}${this.C.reset}:\n${this.table(val as InflectionTable, options, depth + 1)}`;
            }
            const valStr = Array.isArray(val) 
                ? val.map(v => `${this.C.green}${v}${this.C.reset}`).join("/") 
                : `${this.C.green}${val}${this.C.reset}`;
            return `${indent}${this.C.cyan}${key}${this.C.reset}: ${valStr}`;
        }).join("\n");
    }
    rich(entry: RichEntry, options: FormatOptions): string {
        const parts: string[] = [];
        parts.push(`${this.C.bold}${this.C.magenta}== ${entry.headword.toUpperCase()} (${entry.pos}) ==${this.C.reset}`);
        if (entry.morphology) parts.push(`${this.C.bold}Grammar${this.C.reset}: ${this.grammar(entry.morphology, options)}`);
        if (entry.pronunciation?.IPA) parts.push(`${this.C.bold}IPA${this.C.reset}: ${this.C.cyan}${entry.pronunciation.IPA}${this.C.reset}`);
        if (entry.etymology) parts.push(`${this.C.bold}Etymology${this.C.reset}: ${this.etymology(entry.etymology, options)}`);
        if (entry.senses) parts.push(`${this.C.bold}${this.C.yellow}Definitions${this.C.reset}:\n${this.senses(entry.senses, options)}`);
        if (entry.inflection_table) parts.push(`${this.C.bold}${this.C.yellow}Inflection Paradigm${this.C.reset}:\n${this.table(entry.inflection_table, options)}`);
        return parts.join("\n\n");
    }
    nullValue(): string {
        return `${this.C.amber}null${this.C.reset}`;
    }
}

/**
 * Web-based Terminal Style (HTML with inline color styles)
 */
class TerminalHtmlStyle extends HtmlStyle {
    private readonly C = {
        reset: "text-inherit",
        fontBold: "font-bold",
        fontItalic: "italic",
        green: "#4ade80",
        cyan: "#22d3ee",
        yellow: "#fbbf24",
        dim: "#9ca3af",
        magenta: "#e879f9",
    };

    array(arr: string[], opts: FormatOptions): string {
        if (arr.length === 0) return `<span style="color: ${this.C.dim}">[]</span>`;
        const { listStyle = "comma", separator } = opts;
        if (listStyle === "comma") return arr.map(i => `<span style="color: ${this.C.green}">${i}</span>`).join(separator || ", ");
        const prefix = listStyle === "numbered" ? (i: number) => `<span style="color: ${this.C.yellow}">${i + 1}.</span> ` : () => `<span style="color: ${this.C.yellow}">•</span> `;
        return arr.map((item, i) => `${prefix(i)}<span style="color: ${this.C.green}">${item}</span>`).join("<br/>");
    }
    grammar(traits: Partial<GrammarTraits>, _options: FormatOptions): string {
        const base = formatGrammarBase(traits);
        if (!base) return `<span style="color: ${this.C.dim}">(none)</span>`;
        return `<span class="${this.C.fontItalic}" style="color: ${this.C.cyan}">${base}</span>`;
    }
    stems(stems: WordStems, _options: FormatOptions): string {
        if (stems.aliases.length === 0) return `<span class="${this.C.fontBold}">Stems</span>: <span style="color: ${this.C.dim}">(none)</span>`;
        const items = stems.aliases.map(s => `<span class="${this.C.fontBold}" style="color: ${this.C.green}">${s}</span>`);
        return `<span class="${this.C.fontBold}">Stems</span>: ${items.join(", ")}`;
    }
    etymology(data: EtymologyData | EtymologyStep[], _options: FormatOptions): string {
        if (Array.isArray(data)) {
            if (data.length === 0) return `<span style="color: ${this.C.dim}">(none)</span>`;
            return data.map(s => `<span style="color: ${this.C.cyan}">${s.lang}</span> <span class="${this.C.fontBold}" style="color: ${this.C.green}">${s.form}</span>`).join(` <span style="color: ${this.C.dim}">←</span> `);
        }
        if (!data || (!data.chain && !data.cognates)) return `<span style="color: ${this.C.dim}">(none)</span>`;
        const chain = (data.chain || []).map((s: any) => `<span style="color: ${this.C.cyan}">${s.source_lang_name || s.source_lang}</span> <span class="${this.C.fontBold}" style="color: ${this.C.green}">${s.term}</span>`).join(` <span style="color: ${this.C.dim}">←</span> `);
        const cogs = (data.cognates || []).map((s: any) => `cog. <span style="color: ${this.C.cyan}">${s.source_lang_name || s.source_lang}</span> <span class="${this.C.fontBold}" style="color: ${this.C.green}">${s.term}</span>`).join(", ");
        return [chain, cogs].filter(Boolean).join("; ");
    }
    senses(senses: Sense[], _options: FormatOptions): string {
        if (senses.length === 0) return `<span style="color: ${this.C.dim}">(none)</span>`;
        return senses.map((s, i) => `<div><span style="color: ${this.C.yellow}">${i + 1}.</span> ${s.gloss}</div>`).join("");
    }
    table(table: InflectionTable, options: FormatOptions, depth = 0): string {
        const indent = "&nbsp;".repeat(depth * 4);
        return Object.entries(table).map(([key, val]) => {
            if (typeof val === "object" && !Array.isArray(val)) {
                return `<div>${indent}<span class="${this.C.fontBold}" style="color: ${this.C.yellow}">${key}</span>:</div>${this.table(val as InflectionTable, options, depth + 1)}`;
            }
            const valStr = Array.isArray(val) 
                ? val.map(v => `<span style="color: ${this.C.green}">${v}</span>`).join("/") 
                : `<span style="color: ${this.C.green}">${val}</span>`;
            return `<div>${indent}<span style="color: ${this.C.cyan}">${key}</span>: ${valStr}</div>`;
        }).join("");
    }
    rich(entry: RichEntry, options: FormatOptions): string {
        return `
            <div style="font-family: monospace; line-height: 1.5;">
                <div class="${this.C.fontBold}" style="color: ${this.C.magenta}; font-size: 1.25em;">== ${entry.headword.toUpperCase()} (${entry.pos}) ==</div>
                <br/>
                <div><span class="${this.C.fontBold}">Grammar</span>: ${this.grammar(entry.morphology || {}, options)}</div>
                ${entry.pronunciation?.IPA ? `<div><span class="${this.C.fontBold}">IPA</span>: <span style="color: ${this.C.cyan}">${entry.pronunciation.IPA}</span></div>` : ""}
                ${entry.etymology ? `<div><span class="${this.C.fontBold}">Etymology</span>: ${this.etymology(entry.etymology, options)}</div>` : ""}
                <br/>
                <div class="${this.C.fontBold}" style="color: ${this.C.yellow}">Definitions:</div>
                ${this.senses(entry.senses || [], options)}
                <br/>
                <div class="${this.C.fontBold}" style="color: ${this.C.yellow}">Inflection Paradigm:</div>
                <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px;">
                    ${this.table(entry.inflection_table || {}, options)}
                </div>
            </div>
        `;
    }
    nullValue(): string {
        return `<span style="color: ${this.C.yellow}">null</span>`;
    }
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function formatGrammarBase(traits: Partial<GrammarTraits>): string {
    const parts: string[] = [];
    const push = (val?: string) => val && parts.push(val);

    const getOrdinalSuffix = (p: string) => {
        if (p === "1") return "st";
        if (p === "2") return "nd";
        if (p === "3") return "rd";
        return "";
    };

    push(traits.person ? `${traits.person}${getOrdinalSuffix(traits.person)} person` : undefined);
    push(traits.number);
    push(traits.gender);
    push(traits.case);
    push(traits.tense);
    push(traits.aspect);
    push(traits.mood);
    push(traits.voice);

    return parts.join(", ");
}

// Initial Registration
registerStyle("text", new TextStyle());
registerStyle("markdown", new MarkdownStyle());
registerStyle("html", new HtmlStyle());
registerStyle("ansi", new AnsiStyle());
registerStyle("terminal-html", new TerminalHtmlStyle());
