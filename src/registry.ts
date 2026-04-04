import { DecoderRegistry } from "./registry/decoder-registry";
import { registerAllDecoders } from "./registry/register-all-decoders";

export { DecoderRegistry } from "./registry/decoder-registry";
export * from "./registry/form-of-predicates";
export { stripWikiMarkup } from "./registry/strip-wiki-markup";

export const registry = new DecoderRegistry();
registerAllDecoders(registry);
