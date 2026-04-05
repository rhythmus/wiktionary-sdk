/** Single item from {{l}}/{{link}} in Derived/Related/Descendants sections. */
export interface SectionLinkItem {
  term: string;
  lang: string;
  gloss?: string;
  alt?: string;
  template: string;
  raw: string;
}

/** Section with structured items and verbatim raw text. */
export interface SectionWithLinks {
  raw_text: string;
  items: SectionLinkItem[];
}
