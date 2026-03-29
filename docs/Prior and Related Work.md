# Prior and Related Work

Wiktionary SDKs and libraries, such as JWKTL (Java), wiktextract (Python), and Wiktionary-Parser (Python), allow developers to query and parse data from Wiktionary, including definitions, etymology, and translations. These tools often interact with Wiktionary dump files or the official MediaWiki API to extract structured data. 

Also see: https://stackoverflow.com/questions/2770547/how-can-i-retrieve-wiktionary-word-content

## Key Wiktionary Access Tools

- JWKTL (Java-based Wiktionary Library): An API for accessing English and German Wiktionary, offering structured access to definitions, translations, and semantic relations. — https://github.com/dkpro/dkpro-jwktl/

- wiktextract (Python): A robust parser for Wiktionary dump files, capable of extracting, restructuring, and expanding Lua modules for comprehensive data access. — https://github.com/tatuylonen/wiktextract & https://tatuylonen.github.io/wiktextract/

- Wiktionaryparser (Python): A PyPI package that parses word content into a manageable JSON format. — https://pypi.org/project/wiktionaryparser/

- MediaWiki API: The direct way to request data in XML or JSON format from en.wiktionary.org/w/api.php. 

- https://kaikki.org/

## Key Considerations

- Structure: Wiktionary is a wiki, not a structured database, making parsing challenging. Using existing libraries like wiktextract on GitHub is generally preferred over writing custom parsers.
- API Limits: Direct API requests should be mindful of usage limits.
- Alternatives: For specific languages, alternatives like the Oxford Dictionary API may be used. 