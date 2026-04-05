import type { FetchResult, Lexeme, LexemeResult } from "../model";
import { unwrapExtraction, type ExtractionEnvelope } from "./extraction-support";

export interface GroupedLexemeResults<T> extends Array<LexemeResult<T>> {
    order: string[];
    lexemes: Record<
        string,
        {
            language: string;
            pos: string;
            etymology_index: number;
            value: T;
            support_warning?: string;
        }
    >;
}

/** @internal Exported for translate() native-senses path. */
export function groupRows<T>(rows: LexemeResult<T>[]): GroupedLexemeResults<T> {
    const out = rows as GroupedLexemeResults<T>;
    out.order = [];
    out.lexemes = {};
    rows.forEach((row) => {
        out.order.push(row.lexeme_id);
        out.lexemes[row.lexeme_id] = {
            language: String(row.language),
            pos: row.pos,
            etymology_index: row.etymology_index ?? 0,
            value: row.value,
            ...(row.support_warning !== undefined ? { support_warning: row.support_warning } : {}),
        };
    });
    return out;
}

/** Convenience accessor for grouped wrapper output. */
export function asLexemeMap<T>(grouped: GroupedLexemeResults<T>) {
    return grouped.lexemes;
}

/** Row-oriented view (ordered) over grouped wrapper output. */
export function asLexemeRows<T>(grouped: GroupedLexemeResults<T>): LexemeResult<T>[] {
    return grouped.order.map((id) => {
        const item = grouped.lexemes[id];
        return {
            lexeme_id: id,
            language: item.language,
            pos: item.pos,
            etymology_index: item.etymology_index,
            value: item.value,
            ...(item.support_warning !== undefined ? { support_warning: item.support_warning } : {}),
        };
    });
}

/**
 * Maps over all lexemes in a FetchResult, applying an extractor to each
 * and tagging the output with lexeme identity metadata.
 */
export function mapLexemes<T>(
    result: FetchResult,
    extractor: (lexeme: Lexeme) => T | ExtractionEnvelope<T>,
): GroupedLexemeResults<T> {
    const rows: LexemeResult<T>[] = result.lexemes.map((lexeme) => {
        const { value, support_warning } = unwrapExtraction(extractor(lexeme));
        return {
            lexeme_id: lexeme.id,
            language: lexeme.language,
            pos:
                lexeme.part_of_speech ??
                lexeme.lexicographic_section ??
                lexeme.part_of_speech_heading ??
                "unknown",
            etymology_index: lexeme.etymology_index,
            value,
            ...(support_warning !== undefined ? { support_warning } : {}),
        };
    });
    return groupRows(rows);
}
