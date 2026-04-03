/**
 * AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
 * Source files:
 * - src/templates/entry.html.hbs
 * - src/templates/entry.md.hbs
 * - src/templates/entry.css
 */

export const HTML_ENTRY_TEMPLATE = `<div class="wiktionary-entry {{#if form_of}}is-redirect{{/if}}">
  <div class="entry-body">
    <span class="entry-line entry-line-head">
      {{~#if form_of~}}
      <span class="form-of-surface {{form_of.subclass}}">{{headword}}</span>
      <span class="inflection-label">{{form_of.label}}</span>
      <span class="inline-sep">of:</span>
      <span class="redirect-arrow">→</span>
      <span class="lemma lemma-target">{{form_of.lemma}}</span>
      {{~else~}}
      <span class="lemma">{{headword}}</span>
      {{~/if~}}

      {{~#if pronunciation.romanization~}}
      <span class="romanization">/{{pronunciation.romanization}}/</span>
      {{~/if~}}

      <span class="pos">{{posLine this}}</span>

      {{~#if headword_morphology.principal_parts~}}
      <span class="principal-parts">
        {{#each headword_morphology.principal_parts}}
        <span class="pp-item">{{this}}</span>{{#unless @last}}<span class="inline-sep">–</span>{{/unless}}
        {{/each}}
      </span>
      {{~/if~}}
    </span>

    {{~#if etymology.chain~}}<span class="entry-line"><span class="etym-inline"><span class="etym-paren-lead">(<span class="etym-arrow etym-arrow-from-lemma">←</span></span>{{~#each etymology.chain~}}<span class="lang-tag">{{langLabel this}}</span>{{#if term}} {{term}}{{/if}}{{#if gloss}} ({{gloss}}){{/if}}{{#unless @last}} <span class="etym-arrow">{{etymSymbol relation}}</span> {{/unless}}{{~/each~}})</span></span>{{~/if~}}

    {{~#if senses~}}
    <span class="entry-line">
      <span class="sense-inline">
        {{#each senses}}
        <span class="sense-item">
          {{#ifCond ../senses.length ">" 1}}<span class="sense-num">{{addOne @index}}</span>{{/ifCond}}
          {{#if labels}}<span class="tag">{{join labels ", "}}</span>{{/if}}
          {{#if only_used_in}}
          <span class="def-only-used-in"><span class="def-oui-lead">only used in</span> <span class="def-oui-terms">{{#each only_used_in.terms}}<span class="def-oui-term">{{this}}</span>{{#unless @last}}<span class="def-oui-sep">, </span>{{/unless}}{{/each}}</span>{{#if only_used_in.t_gloss}} <span class="def-oui-gloss">({{only_used_in.t_gloss}})</span>{{/if}}</span>
          {{else}}
          {{#if gloss}}<span class="gloss">{{gloss}}</span>{{/if}}
          {{/if}}
          {{#if definition}}<span class="definition">{{definition}}</span>{{/if}}
        </span>
        {{/each}}
      </span>
    </span>
    {{~/if~}}

    {{~#if (or relations derived_terms.items)~}}
    <span class="entry-line">
      {{#if relations.antonyms}}
      <span class="line-label">ANT.</span>
      <span class="relation-group">
        {{#each relations.antonyms}}
        <span>{{term}}</span>{{#unless @last}}<span class="inline-sep">,</span>{{/unless}}
        {{/each}}
      </span>
      {{/if}}

      {{#if relations.synonyms}}
      <span class="line-label">SYN.</span>
      <span class="relation-group">
        {{#each relations.synonyms}}
        <span>{{term}}</span>{{#unless @last}}<span class="inline-sep">,</span>{{/unless}}
        {{/each}}
      </span>
      {{/if}}

      {{#if derived_terms.items}}
      <span class="line-label">DER.</span>
      <span class="relation-group">
        {{#each derived_terms.items}}
        <span>{{term}}</span>{{#unless @last}}<span class="inline-sep">,</span>{{/unless}}
        {{/each}}
      </span>
      {{/if}}
    </span>
    {{~/if~}}

    {{~#if usage_notes~}}
    <span class="entry-line entry-line-note">
      <span class="line-label line-label-note">{{#ifCond usage_notes.length ">" 1}}NOTES{{else}}NOTE{{/ifCond}}</span><span class="note-gap" aria-hidden="true">&emsp;</span>
      <span class="usage-inline">
        {{#ifCond usage_notes.length ">" 1}}
          {{#each usage_notes}}
          <span class="usage-note-item"><strong>{{addOne @index}}</strong> {{this}}</span>{{#unless @last}}<span class="note-gap" aria-hidden="true">&emsp;</span>{{/unless}}
          {{/each}}
        {{else}}
          <span class="usage-note-item">{{usage_notes.[0]}}</span>
        {{/ifCond}}
      </span>
    </span>
    {{~/if~}}

    {{~#if wikidata~}}
    <span class="entry-line entry-line-meta">
      <span class="metadata-pill">Wikidata {{wikidata.qid}}</span>
      {{#each wikidata.instance_of}}
      <span class="metadata-pill">Instance: {{this}}</span>
      {{/each}}
      {{#each wikidata.subclass_of}}
      <span class="metadata-pill">Subclass: {{this}}</span>
      {{/each}}
    </span>
    {{~/if~}}
  </div>
</div>
`;

export const MD_ENTRY_TEMPLATE = `# {{headword}}
{{#if form_of}}**{{form_of.label}} of:**

## → {{form_of.lemma}}
{{/if}}
{{#if pronunciation.romanization}}*({{pronunciation.romanization}})* {{/if}}**{{posLine this}}**
{{#if pronunciation.IPA}}*Pronunciation:* [{{pronunciation.IPA}}]{{/if}}

{{#if headword_morphology.principal_parts}}
**Principal Parts:** {{#each headword_morphology.principal_parts}}*{{@key}}* {{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

---

{{#if etymology.chain}}
### I. Etymology & Origins
← {{#each etymology.chain}}**{{langLabel this}}**{{#if term}} {{term}}{{/if}}{{#if gloss}} (*{{gloss}}*){{/if}} {{#unless @last}}{{etymSymbol relation}} {{/unless}}{{/each}}

{{#if etymology.cognates}}
> **Cognates:** {{#each etymology.cognates}}{{langLabel this}} **{{term}}**{{#if gloss}} (*{{gloss}}*){{/if}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

---
{{/if}}

{{#if senses}}
### II. Senses & Citations
{{#each senses}}
**{{addOne @index}}.** {{#if labels}}[{{toUpperCase (join labels ", ")}}] {{/if}}**{{gloss}}**
{{#if definition}}> {{definition}}{{/if}}

{{#each examples}}
- {{#if author}}*{{author}}{{#if year}} {{year}}{{/if}}* {{/if}}{{{text}}}
  {{#if translation}}  *({{translation}})*{{/if}}
{{/each}}

{{#if subsenses}}
  {{#each subsenses}}
  - {{#if labels}}*{{join labels ", "}}* {{/if}}{{gloss}}
  {{/each}}
{{/if}}
{{/each}}

---
{{/if}}

{{#if relations}}
### III. Lexical Network
{{#if relations.synonyms}}
- **Synonyms (SYN):** {{#each relations.synonyms}}**{{term}}**{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{#if relations.antonyms}}
- **Antonyms (ANT):** {{#each relations.antonyms}}**{{term}}**{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{#if derived_terms.items}}
- **Derived terms:** {{#each derived_terms.items}}**{{term}}**{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{#if descendants.items}}
- **Descendants:** {{#each descendants.items}}*{{term}}*{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

---
{{/if}}

{{#if usage_notes}}
### IV. Usage Notes
{{#each usage_notes}}
{{this}}
{{/each}}

---
{{/if}}

{{#if wikidata}}
### V. Ontological Proof
- **Wikidata:** {{wikidata.qid}}
- **Instance of:** {{#each wikidata.instance_of}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Subclass of:** {{#each wikidata.subclass_of}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}

---
{{/if}}

**Generated by Wiktionary SDK {{schema_version}} • {{currentDate}}**
`;

export const ENTRY_CSS = `:root {
    --bg-color: transparent;
    --text-color: inherit;
    --error-color: #ef4444;
}

.wiktionary-entry {
    font-family: 'Alegreya', serif;
    line-height: 1.2;
    font-size: 1.5em;
    padding-left: 1em;
    text-indent: -1em;
}

@media (max-width: 640px) {
    .wiktionary-entry {
        font-size: 1em;
    }
}
.wiktionary-entry * {
    padding-left: 0;
    text-indent: 0;
}

.wiktionary-entry i, 
.wiktionary-entry em {
    font-style: italic;
}

.wiktionary-entry b, 
.wiktionary-entry strong {
    font-weight: bold;
}

.wiktionary-entry small {

}

.entry-body {
    display: inline;
    white-space: normal;
}

.entry-line {
    display: inline !important;
    margin-right: 0.5rem;
    white-space: normal;
}

.entry-line-head {
    margin-right: 0.6rem;
}

.lemma {
    display: inline-block;
    font-size: 1.5em;
    /* transform: scale(1.2); */
    font-weight: 700;
    margin-right: 1rem;
    /* vertical-align: baseline; */
}

/* Non-lemma surface form: regular weight, tight spacing before label (mockup). */
.form-of-surface {
    display: inline;
    font-weight: 400;
    font-size: 1.5em;
    margin-right: 0.35em;
}

.lemma.abbreviation {
    text-transform: lowercase;
    font-variant: small-caps;
    letter-spacing: 0.05em;
}

.lemma.clipping {
    font-style: italic;
}

.lemma.diminutive {
    opacity: 0.9;
}

.lemma.augmentative {
    opacity: 0.9;
}

.lemma.misspelling {
    text-decoration: underline wavy var(--error-color);
}

.lemma-target {
    font-size: inherit;
    font-weight: 700;
}

.redirect-arrow {
    font-size: inherit;
    margin: 0 0.2rem;
    font-variant-emoji: text;
}

.inflection-label {
    font-variant: all-small-caps;
    letter-spacing: 0.05em;
}

.romanization {
    display: inline-block;
    font-size: inherit;
    font-style: italic;
    color: var(--label-color);
    margin-right: 0.45rem;
}

.pos {
    display: inline-block;
    font-variant: small-caps;
    margin-right: 0.4rem;
}

/* Space lemma from PoS when inline spans touch (Handlebars ~ strips whitespace; no romanization). */
.entry-line-head .lemma ~ .pos {
    margin-left: 0.35rem;
}

.principal-parts {
    display: inline-block;
    font-size: inherit;
}

.pp-item {
    display: inline;
    font-style: italic;
}

.line-label {
    display: inline-block;
    text-transform:lowercase;
    font-variant: small-caps;
    letter-spacing: 0.05em;
    margin-right: 0.4rem;
}

.lang-tag {
    font-variant: small-caps;
    letter-spacing: 0.05em;
    margin-right: 0.4rem;
}

.etym-inline,
.relation-group {
    display: inline-block;
}

/* Keep "(" glued to the lemma connector arrow (no wrap, no orphan paren before inline-block). */
.etym-paren-lead {
    white-space: nowrap;
}

.usage-inline {
    display: inline;
    margin-top: 0;
}

.usage-note-item {
    display: inline;
    text-indent: 0;
    margin-top: 0;
}

.line-label-note {
    text-transform: lowercase;
    font-variant: small-caps;
    letter-spacing: 0.05em;
}

.note-gap {
    display: inline;
}

.entry-line-note {
    font-size: 0.8em;
}

.sense-item {
    display: inline-block;
    margin-right: 1.1rem;
    vertical-align: baseline;
}

.sense-num {
    display: inline-block;
    font-weight: 700;
    margin-right: 0.35rem;
}

.gloss {
    font-size: inherit;
}

/* {{only used in|lang|term}} — definitional phrase + lemma phrase (not raw wikitext) */
.def-only-used-in {
    font-size: inherit;
}

.def-oui-lead {
    font-variant: small-caps;
    letter-spacing: 0.04em;
    color: var(--label-color, #64748b);
}

.def-oui-terms {
    font-weight: 500;
}

.def-oui-term {
    font-style: italic;
}

.def-oui-sep {
    font-weight: 400;
    font-style: normal;
}

.def-oui-gloss {
    font-style: italic;
    color: var(--label-color, #64748b);
    font-weight: 400;
}

.definition {
    /* display: block; */
}

.etym-arrow {
    font-weight: bold;
    margin: 0 0.2rem;
    font-variant-emoji: text;
}

.metadata-pill {
    display: inline-block;
    background: rgba(148, 163, 184, 0.15);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: inherit;
    margin-right: 0.5rem;
    font-weight: 500;
}

.tag {
    text-transform: none;
    font-variant: normal;
    font-style: italic;
    letter-spacing: 0;
    margin-right: 0.35em;
}

.inline-sep {
    display: inline;
    margin: 0 0.15rem;
}

/* Webapp: inflected/form-of headline, then → + lemma on one line, hanging body (mockup). */
.dict-entry-form-of-wrap {
    display: block;
}

.dict-entry-nested-row {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.35em;
    align-items: baseline;
    margin-top: 0.35rem;
}

.dict-entry-nested-arrow {
    grid-column: 1;
    grid-row: 1;
    font-weight: 700;
    font-size: 1.5em;
    line-height: 1.2;
    /* Outside .wiktionary-entry: match entry serif so U+2192 is not a UI/symbol glyph */
    font-family: 'Alegreya', serif;
    font-variant-emoji: text;
}

.dict-entry-nested-body {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
}

.dict-entry-lemma-nested {
    margin-left: 0;
    padding-left: 0;
    border-left: none;
}

.dict-entry-lemma-nested .wiktionary-entry {
    padding-left: 1em;
    text-indent: -1em;
}

.wiktionary-entry.is-form-headline {
    padding-left: 0;
    text-indent: 0;
}

.wiktionary-entry.is-form-headline .inflection-label {
    font-weight: 700;
    font-variant: normal;
    letter-spacing: normal;
    margin-right: 0.2em;
    text-transform: lowercase;
}

.wiktionary-entry.is-form-headline .inline-sep {
    font-weight: 400;
    margin-left: 0;
    margin-right: 0;
}

.wiktionary-entry.is-form-headline .entry-line-head {
    margin-right: 0;
}

.dict-entry-lemma-loading {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
    color: var(--text-color, #444);
}

.dict-entry-lemma-error {
    font-family: 'Inter', sans-serif;
    font-size: 0.88rem;
    color: var(--error-color, #b45309);
}

@media (max-width: 640px) {
    .dict-entry-nested-arrow {
        font-size: 1em;
    }
}
`;
