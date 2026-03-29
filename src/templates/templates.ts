/**
 * Verbatim Handlebars template for the high-fidelity HTML dictionary entry.
 * Designed as a font-agnostic fragment to be embedded in any host environment.
 * Supports both primary LEXEME entries and INFLECTED_FORM redirects.
 */
export const HTML_ENTRY_TEMPLATE = `<div class="wiktionary-entry {{#if form_of}}is-redirect{{/if}}">
    <div class="entry-body">
        <div class="entry-head">
            {{#if form_of}}
            <div class="inflected-header">
                <span class="lemma">{{headword}}</span>
                <span class="inflection-label">{{form_of.label}} of:</span>
            </div>
            <div class="lemma-redirect">
                <span class="etym-arrow">→</span>
                <span class="lemma">{{form_of.lemma}}</span>
            {{else}}
                <span class="lemma">{{headword}}</span>
            {{/if}}

            {{#if pronunciation.romanization}}
            <span class="romanization">({{pronunciation.romanization}})</span>
            {{/if}}
            <span class="pos">{{#if pos}}{{pos}}{{else}}{{part_of_speech}}{{/if}}</span>
            
            {{#if headword_morphology.principal_parts}}
            <div class="morphology-summary">
                <b>Principal Parts:</b> 
                {{#each headword_morphology.principal_parts}}
                <i>{{@key}}</i> {{this}}{{#unless @last}}, {{/unless}}
                {{/each}}
            </div>
            {{/if}}
            
            {{#if pronunciation.IPA}}
            <div style="font-size: 1.1em; margin-top: 0.5rem;">
                <b>Pronunciation:</b> 
                [{{pronunciation.IPA}}]
            </div>
            {{/if}}

            {{#if form_of}}
            </div> {{!-- end .lemma-redirect --}}
            {{/if}}
        </div>

        {{#if etymology.chain}}
        <div class="section">
            <h2>I. Etymology & Origins</h2>
            <div class="etym-chain">
                {{#each etymology.chain}}
                <b class="lang-tag">{{source_lang_name}}</b> {{term}} {{#if gloss}}({{gloss}}){{/if}}
                {{#unless @last}}<span class="etym-arrow">←</span>{{/unless}}
                {{/each}}
            </div>
            {{#if etymology.cognates}}
            <div class="cognate-list">
                <span class="rel-label">Cognates:</span> 
                <span class="rel-terms">
                    {{#each etymology.cognates}}
                    {{source_lang_name}} <b>{{term}}</b>{{#if gloss}} ({{gloss}}){{/if}}{{#unless @last}}, {{/unless}}
                    {{/each}}
                </span>
            </div>
            {{/if}}
        </div>
        {{/if}}

        {{#if senses}}
        <div class="section">
            <h2>II. Senses & Citations</h2>
            <ul class="senses">
                {{#each senses}}
                <li class="sense-item">
                    <span class="sense-num">{{addOne @index}}.</span>
                    {{#if labels}}
                    <span class="tag">{{join labels ", "}}</span>
                    {{/if}}
                    <span class="gloss">{{gloss}}.</span>
                    {{#if definition}}
                    <span class="definition">{{definition}}</span>
                    {{/if}}
                    
                    {{#each examples}}
                    <span class="example">
                        {{#if author}}
                        <span class="example-cite">{{author}}{{#if year}} {{year}}{{/if}}</span>
                        {{/if}}
                        {{#if source}}
                        <span class="example-cite">{{source}}</span>
                        {{/if}}
                        {{{text}}}
                        {{#if translation}}
                        <span class="example-trans">{{translation}}</span>
                        {{/if}}
                    </span>
                    {{/each}}

                    {{#if subsenses}}
                    <div style="font-size: 0.9em; padding-left: 1rem; display: block; margin-top: 0.5rem;">
                        {{#each subsenses}}
                        <div class="subsense">
                            {{#if labels}}<span class="tag">{{join labels ", "}}</span> {{/if}}
                            {{gloss}}
                        </div>
                        {{/each}}
                    </div>
                    {{/if}}
                </li>
                {{/each}}
            </ul>
        </div>
        {{/if}}

        {{#if relations}}
        <div class="section">
            <h2>III. Lexical Network</h2>
            <div class="lexical-grid">
                {{#if relations.synonyms}}
                <div class="rel-label">Synonyms</div>
                <div class="rel-terms">
                    {{#each relations.synonyms}}
                    {{term}}{{#unless @last}}, {{/unless}}
                    {{/each}}
                </div>
                {{/if}}
                
                {{#if relations.antonyms}}
                <div class="rel-label">Antonyms</div>
                <div class="rel-terms">
                    {{#each relations.antonyms}}
                    {{term}}{{#unless @last}}, {{/unless}}
                    {{/each}}
                </div>
                {{/if}}
                
                {{#if derived_terms.items}}
                <div class="rel-label">Derived</div>
                <div class="rel-terms">
                    {{#each derived_terms.items}}
                    {{term}}{{#unless @last}}, {{/unless}}
                    {{/each}}
                </div>
                {{/if}}

                {{#if descendants.items}}
                <div class="rel-label">Descendants</div>
                <div class="rel-terms">
                    {{#each descendants.items}}
                    {{term}}{{#unless @last}}, {{/unless}}
                    {{/each}}
                </div>
                {{/if}}
            </div>
        </div>
        {{/if}}

        {{#if usage_notes}}
        <div class="section">
            <h2>IV. Usage Notes</h2>
            <div style="font-size: 1em;">
                {{#each usage_notes}}
                <p>{{this}}</p>
                {{/each}}
            </div>
        </div>
        {{/if}}

        {{#if wikidata}}
        <div class="section">
            <h2>V. Ontological Proof</h2>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <span class="metadata-pill">Wikidata {{wikidata.qid}}</span>
                {{#each wikidata.instance_of}}
                <span class="metadata-pill">Instance: {{this}}</span>
                {{/each}}
                {{#each wikidata.subclass_of}}
                <span class="metadata-pill">Subclass: {{this}}</span>
                {{/each}}
                {{#if images}}
                <span class="metadata-pill">Images: {{images.length}} assets</span>
                {{/if}}
            </div>
        </div>
        {{/if}}

        <div class="bib-footer">
            <div class="bib-list">
                {{#each references}}
                <span>{{{this}}}</span>
                {{/each}}
            </div>
            <div>Generated by SDK {{schema_version}} • {{currentDate}}</div>
        </div>
    </div>
</div>`;

/**
 * Verbatim Handlebars template for the high-fidelity Markdown dictionary entry.
 * Designed for premium typographic density in terminal and documentation contexts.
 * Supports both primary LEXEME entries and INFLECTED_FORM redirects.
 */
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
{{#each etymology.chain}}**{{source_lang_name}}** {{term}}{{#if gloss}} (*{{gloss}}*){{/if}} {{#unless @last}}← {{/unless}}{{/each}}

{{#if etymology.cognates}}
> **Cognates:** {{#each etymology.cognates}}{{source_lang_name}} **{{term}}**{{#if gloss}} (*{{gloss}}*){{/if}}{{#unless @last}}, {{/unless}}{{/each}}
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

**Generated by Wiktionary SDK {{schema_version}} • {{currentDate}}**`;

/**
 * Premium CSS stylesheet for the HTML dictionary fragment.
 * Font-agnostic and scoped to .wiktionary-entry.
 * Includes layout logic for inflected form redirects.
 */
export const ENTRY_CSS = `:root {
    --bg-color: transparent;
    --text-color: inherit;
    --accent-color: #7c2d12; /* Deep Brick */
    --label-color: #4b5563;
    --border-color: #e5e7eb;
}

.wiktionary-entry {
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
    max-width: 100%;
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
    font-size: 0.85em;
}

.entry-header {
    margin-bottom: 2rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 0.8rem;
    color: var(--label-color);
}

.sdk-version {
    text-transform: uppercase;
    letter-spacing: 0.1em;
}

.entry-head {
    margin-bottom: 1.5rem;
}

.inflected-header {
    margin-bottom: 0.4rem;
}

.inflected-header .lemma {
    font-size: 1.8rem;
    font-weight: 700;
}

.inflection-label {
    font-size: 1.1rem;
    font-weight: 600;
    color: #374151;
    margin-left: 0.5rem;
}

.lemma-redirect {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-top: 0.2rem;
}

.lemma-redirect .lemma {
    font-size: 1.6rem;
    font-weight: 700;
}

.lemma-redirect .etym-arrow {
    font-size: 1.4rem;
    vertical-align: middle;
}

.lemma {
    font-size: 2.2rem;
    font-weight: 700;
    margin-right: 0.5rem;
}

.romanization {
    font-size: 1.3rem;
    font-style: italic;
    color: var(--label-color);
}

.pos {
    font-size: 1rem;
    font-weight: 700;
    font-variant: small-caps;
    color: var(--accent-color);
    display: block;
    margin-top: -0.1rem;
}

.morphology-summary {
    font-size: 0.9em;
    margin: 0.4rem 0;
    color: #444;
}

.morphology-summary b {
    font-variant: small-caps;
    font-size: 1.1em;
}

.entry-body h2 {
    font-size: 1.1rem;
    font-variant: small-caps;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.2rem;
    margin-top: 1.8rem;
    margin-bottom: 0.8rem;
    color: var(--accent-color);
    letter-spacing: 0.05em;
}

.section {
    margin-bottom: 1.8rem;
}

/* Senses Styling */
.senses {
    padding-left: 0;
    list-style: none;
}

.sense-item {
    margin-bottom: 1.2rem;
    position: relative;
    padding-left: 1.8rem;
}

.sense-num {
    position: absolute;
    left: 0;
    font-weight: 700;
    color: var(--accent-color);
}

.gloss {
    font-weight: 600;
    font-size: 1.05rem;
}

.definition {
    font-size: 0.95rem;
    color: #333;
    margin-top: 0.2rem;
    display: block;
}

.example {
    display: block;
    margin: 0.4rem 0 0.4rem 1rem;
    font-size: 0.95rem;
    border-left: 2px solid var(--border-color);
    padding-left: 0.8rem;
    font-style: italic;
}

.example-trans {
    font-style: normal;
    color: var(--label-color);
    font-size: 0.85rem;
    display: block;
    margin-top: 0.1rem;
}

.example-cite {
    font-size: 0.8em;
    font-weight: 600;
    color: var(--label-color);
    margin-right: 0.4rem;
}

/* Lexical Network */
.lexical-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.4rem 1rem;
    font-size: 0.95rem;
}

.rel-label {
    font-variant: small-caps;
    font-weight: 700;
    color: var(--label-color);
    text-align: right;
}

.rel-terms {
    font-style: italic;
}

/* Etymology Chain */
.etym-chain {
    font-size: 0.95rem;
    line-height: 1.4;
}

.lang-tag {
    font-weight: 700;
}

.etym-arrow {
    color: var(--accent-color);
    font-weight: bold;
    margin: 0 0.3rem;
}

.cognate-list {
    margin-top: 0.5rem;
    font-size: 0.9rem;
    border-top: 1px dashed var(--border-color);
    padding-top: 0.4rem;
}

/* Bibliography & Side Metadata */
.bib-footer {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px double var(--border-color);
    font-size: 0.85rem;
    color: var(--label-color);
    display: flex;
    justify-content: space-between;
}

.bib-list span {
    margin-right: 1.5rem;
}

.metadata-pill {
    display: inline-block;
    background: #f3f4f6;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    margin-right: 0.5rem;
    font-weight: 500;
}

.tag {
    font-size: 0.8em;
    background: #eee;
    padding: 1px 4px;
    border-radius: 2px;
    text-transform: uppercase;
    font-weight: 600;
    vertical-align: middle;
    margin-right: 4px;
}
`;
