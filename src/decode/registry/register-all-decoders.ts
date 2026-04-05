import type { DecoderRegistry } from "./decoder-registry";
import { registerCoreAndPronunciation } from "./register-core-pronunciation";
import { registerEtymology } from "./register-etymology";
import { registerFormOfWikidata } from "./register-form-of-wikidata";
import { registerHeadwordsElNlDe } from "./register-headwords-el-nl-de";
import { registerInflectionStems } from "./register-inflection-stems";
import { registerMorphologyLa } from "./register-morphology-la";
import { registerPronunciationExtra } from "./register-pronunciation-extra";
import { registerSections } from "./register-sections";
import { registerSemanticRelations } from "./register-semantic-relations";
import { registerSenses } from "./register-senses";
import { registerTranslations } from "./register-translations";

/**
 * Register all template/section decoders in **historical source order**.
 * Call once per {@link DecoderRegistry} instance (typically the package singleton).
 */
export function registerAllDecoders(reg: DecoderRegistry): void {
    registerCoreAndPronunciation(reg);
    registerHeadwordsElNlDe(reg);
    registerFormOfWikidata(reg);
    registerTranslations(reg);
    registerSenses(reg);
    registerMorphologyLa(reg);
    registerSemanticRelations(reg);
    registerEtymology(reg);
    registerPronunciationExtra(reg);
    registerSections(reg);
    registerInflectionStems(reg);
}
