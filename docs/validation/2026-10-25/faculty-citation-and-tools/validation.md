# Faculty citation and result-tools feedback

October 25, 2026. Added explicit RIS/BibTeX choices for a single result, filtered source groups, and filtered saved collections. Moved result-card More content into a native modal side panel with Details, Read & note, Related sources, and Feedback sections. Main-card identity/requirement warnings remain visible. No hover interaction is required, no new provider lookup is added by opening Source tools, and AI/search ranking behavior is unchanged.

## Verification

- Clean release `npm run qa:release`: 599/599 tests; resource audit; 56/56 strict planner cases and 1,232/1,232 planner assertions; synthetic HTTP fixture self-test; production build. Existing bundle-size advisory remains.
- New BibTeX tests cover article/book/chapter/conference/misc types, multiple and corporate authors, date extraction, missing fields, different editions, DOI deduplication, safe keys/filenames, escaped TeX/BibTeX delimiters, and preserved DOI discrepancy/retraction warnings. Corporate literal names and explicit retraction flags are also supported by the shared RIS normalizer.
- System BibTeX 0.99d (TeX Live 2024), plain.bst, successfully processed exported article, book, chapter, and conference records with no parser or missing-required-field warning for those complete fixtures. This is a syntax/compatibility smoke test, not validation of every bibliography style or TeX engine. BibTeX exports are UTF-8; the user's TeX setup determines non-ASCII rendering and sorting.
- Actual browser download from the single-result Cite control produced a .bib file, inspected as a synthetic article with the supplied authors/year/journal/provider. No invented DOI or missing field was filled.
- Isolated synthetic browser UI: source panel opens with close-button focus; Details includes the provider abstract/access/requirements; reading draft survives section changes; Save notes saves the source; Escape closes and restores the Source tools trigger and background scrolling. Saved-source export exposes the same format selector. At a 390x844 viewport the panel is 390px wide with no horizontal content overflow; section controls wrap and the content scrolls independently. Viewport override was reset.

## Limits

These are engineering regression and usability checks, not a source accuracy rate or librarian/accessibility approval. Citation downloads preserve supplied metadata and known notes; they do not establish that a source supports a claim. Missing bibliographic fields must be checked in the original record. Related-source discovery remains the existing bounded provider service and requires the user to choose a connection type. No faculty email was sent.
