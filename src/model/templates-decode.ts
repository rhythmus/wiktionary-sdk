import type { WikiLang } from "./primitives";

export interface TemplateCall {
  name: string;
  raw: string;
  params: {
    positional: string[];
    named: Record<string, string>;
  };
}

export interface DecodeContext {
  lang: WikiLang;
  query: string;
  page: {
    exists: boolean;
    title: string;
    wikitext: string;
    pageprops: Record<string, any>;
    pageid: number | null;
  };
  languageBlock: string;
  etymology: {
    idx: number;
    title: string;
    posBlocks: any[];
    /** Raw prose text of the Etymology section (above the template chain). */
    etymology_raw_text?: string;
  };
  posBlock: {
    posHeading: string;
    wikitext: string;
  };
  posBlockWikitext: string;
  templates: TemplateCall[];
  lines: string[];
}

export interface TemplateDecoder {
  id: string;
  handlesTemplates?: string[];
  matches(ctx: DecodeContext): boolean;
  decode(ctx: DecodeContext): any;
}
