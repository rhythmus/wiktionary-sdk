import type { Lexeme } from "../model";

export type LexemeDisplayGroup =
    | { type: "single"; items: [Lexeme] }
    | { type: "homonym"; items: Lexeme[] };

/** Normalized PoS key for grouping (homonyms share language + surface + PoS). */
export function lexemePosGroupKey(lex: Lexeme): string {
    const raw = String(
        lex.part_of_speech ?? lex.lexicographic_section ?? lex.part_of_speech_heading ?? "",
    ).trim();
    const pos = raw.toLowerCase().replace(/_/g, " ").trim();
    return `${lex.language}\0${lex.form}\0${pos}`;
}

function canMergeConsecutiveHomonyms(prev: Lexeme, cur: Lexeme): boolean {
    if (prev.type !== "LEXEME" || cur.type !== "LEXEME") return false;
    if (lexemePosGroupKey(prev) !== lexemePosGroupKey(cur)) return false;
    const a = prev.etymology_index ?? 0;
    const b = cur.etymology_index ?? 0;
    if (a === b) return false;
    return true;
}

/**
 * Consecutive lexemes with the same language, surface form, and PoS but **different**
 * `etymology_index` are **homonyms** (matrix D3). The formatter merges them into one
 * visual card (`template-coverage-mock-entries.md` · L-02).
 */
export function groupLexemesForIntegratedHomonyms(lexemes: Lexeme[]): LexemeDisplayGroup[] {
    if (lexemes.length === 0) return [];
    const out: LexemeDisplayGroup[] = [];
    let i = 0;
    while (i < lexemes.length) {
        const run: Lexeme[] = [lexemes[i]];
        let j = i + 1;
        while (j < lexemes.length) {
            const last = run[run.length - 1];
            const next = lexemes[j];
            if (canMergeConsecutiveHomonyms(last, next)) {
                run.push(next);
                j++;
            } else break;
        }
        if (run.length >= 2) {
            out.push({ type: "homonym", items: run });
        } else {
            out.push({ type: "single", items: [run[0]] });
        }
        i = j;
    }
    return out;
}
