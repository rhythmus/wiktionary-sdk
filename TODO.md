έγραψα

  1st pers. singular perfective past of:

    γρά‧φω /ˈɣra.fo/
    v. trans. & intrans.
    < grc γράφω < Proto-Greek *grəpʰō < PIE *gerbʰ-
    γράφ+ω έ+γραψ+α γράψ+ω
    1. to write, pen
    2. to record
    3. to issue a ticket (for traffic violation, etc)
    ant. ξεγράφω
    syn. σημειώνω, καταγράφω
    der. συγγραφέας
    hyper.
    hypo.

18: [DONE] Is there still data or information burried in the full return output we get from the Wiktionary API, that is not yet being extracted by our library's functions? 
    -> Yes, we now extract Principal Parts, Alternative Forms, and Register Labels via high-fidelity template decoding (v2.5.0).


23: [DONE] What should a full, exhaustive and comprehensive, human-readable, nicely formatted dictionary entry look like?

25: [DONE] Please propose a JSON/YAML structure that would be a good representation of the data we can extract from the Wiktionary API.
    -> See `docs/schemata/exhaustive_schema_v2.5.0.yaml` for the Gold Standard representation.

27: [DONE] More than Greek?
    -> The SDK now explicitly supports Dutch (`nl`) and German (`de`) headwords and morphology (Stage 18).

29: [DONE] MetaLang translations
    -> Proposed `external_mappings` field in `exhaustive_schema_v2.5.0.yaml` to support MetaLang concept IDs.


31: [DONE] `conjugate(γράφω)` still returns `[]`:
    -> Fixed. Now correctly extracts stems and resolves paradigms via `el-conjug-` templates.

32: Call decline("γράφω") -> expect null (since it's a verb).
33: Call conjugate("βιβλίο") -> expect null (since it's a noun).


36: [DONE] Alternative Forms: Sections for monotonic/polytonic or archaic variants (e.g., βιβλίον) are currently present in the source but unparsed.
    -> Fixed. Decoded into `entry.alternative_forms` with `type` and `labels`.

37: [DONE] Semantic Context: Register labels like (colloquial) or (nautical) are currently stripped from glosses but could be extracted as structured metadata.
    -> Fixed. Extracted into `sense.labels` and `sense.topics` via `{{lb}}` decoding.


{
  "headword": "γράφω",
  "pos": "verb",
  "morphology": {
    "person": "1",
    "number": "singular",
    "tense": "present",
    "voice": "active",
    "mood": "indicative"
  },
  "pronunciation": { "ipa": "/ˈɣra.fo/" },
  "etymology": [
    { "lang": "grc", "term": "γράφω" },
    { "lang": "ine-pro", "term": "*gerbʰ-" }
  ],
  "senses": [
    { "gloss": "to write, pen", "examples": ["..."] }
  ],
  "relations": {
    "antonyms": ["ξεγράφω"],
    "related": ["αντιγράφω", "εγγράφω"]
  },
  "inflection_table": {
    "indicative": {
      "present": {
        "active": {
          "1s": ["γράφω"],
          "2s": ["γράφεις"],
          "3s": ["γράφει"],
          "1p": ["γράφουμε"],
          "2p": ["γράφετε"],
          "3p": ["γράφουν", "γράφουνε"]
        }
      }
    }
  }
}