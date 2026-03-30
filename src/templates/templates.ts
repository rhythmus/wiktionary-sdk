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
      <span class="lemma {{form_of.subclass}}">{{headword}}</span>
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

      <span class="pos">{{#if pos}}{{pos}}{{else}}{{part_of_speech}}{{/if}}</span>

      {{~#if headword_morphology.principal_parts~}}
      <span class="principal-parts">
        {{#each headword_morphology.principal_parts}}
        <span class="pp-item">{{this}}</span>{{#unless @last}}<span class="inline-sep">–</span>{{/unless}}
        {{/each}}
      </span>
      {{~/if~}}
    </span>

    {{~#if etymology.chain~}}
    <span class="entry-line">
      {{!-- <span class="line-label">ETYM.</span> --}}
      (<span class="etym-inline">
        {{~#each etymology.chain~}}
        <span class="lang-tag">{{langLabel this}}</span> {{term}}{{#if gloss}} ({{gloss}}){{/if}}{{#unless @last}} <span class="etym-arrow">{{etymSymbol relation}}</span> {{/unless}}
        {{~/each~}}
    )</span>
    </span>
    {{~/if~}}

    {{~#if senses~}}
    <span class="entry-line">
      <span class="sense-inline">
        {{#each senses}}
        <span class="sense-item">
          <span class="sense-num">{{addOne @index}}</span>
          {{#if labels}}<span class="tag">{{join labels ", "}}</span>{{/if}}
          {{#if gloss}}<span class="gloss">{{gloss}}</span>{{/if}}
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
    <span class="entry-line">
      <span class="line-label">NOTE.</span>
      <span class="usage-inline">
        {{#each usage_notes}}
        <span>{{this}}</span>{{#unless @last}}<span class="inline-sep">;</span>{{/unless}}
        {{/each}}
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
{{#if pronunciation.romanization}}*({{pronunciation.romanization}})* {{/if}}**{{#if pos}}{{pos}}{{else}}{{part_of_speech}}{{/if}}**
{{#if pronunciation.IPA}}*Pronunciation:* [{{pronunciation.IPA}}]{{/if}}

{{#if headword_morphology.principal_parts}}
**Principal Parts:** {{#each headword_morphology.principal_parts}}*{{@key}}* {{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

---

{{#if etymology.chain}}
### I. Etymology & Origins
{{#each etymology.chain}}**{{langLabel this}}** {{term}}{{#if gloss}} (*{{gloss}}*){{/if}} {{#unless @last}}{{etymSymbol relation}} {{/unless}}{{/each}}

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
.usage-inline,
.relation-group {
    display: inline-block;
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

.definition {
    /* display: block; */
}

.etym-arrow {
    font-weight: bold;
    margin: 0 0.2rem;
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
    text-transform: lowercase;
    font-variant: small-caps;
    letter-spacing: 0.1ex;
    margin-right: 0.35em;
}

.inline-sep {
    display: inline;
    margin: 0 0.15rem;
}
`;
