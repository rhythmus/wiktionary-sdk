/** BCP-47-style language code. Common values: `el`, `grc`, `en`, `nl`, `de`, `fr`. */
export type WikiLang = "el" | "grc" | "en" | "nl" | "de" | "fr" | string;

/** Discriminator for the kind of lexeme. Matches schema enum. */
export type LexemeType = "LEXEME" | "INFLECTED_FORM" | "FORM_OF";
