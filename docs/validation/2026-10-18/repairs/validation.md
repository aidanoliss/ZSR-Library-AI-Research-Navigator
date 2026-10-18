# Audit repairs — October 18, 2026

Implemented interpretation, contradiction checks, evidence preservation, research history, and shared-computer privacy repairs. This report documents software validation, not librarian approval or a general accuracy rate.

## What changed

- Comparison instruction words no longer become topics; bounded shared wording such as “online and in-person teaching” becomes two teaching concepts. WWII and publication years retain their distinct meaning. Historical questions route to history resources.
- Explicit incompatible populations, historical periods, and study designs are excluded. Unknown metadata stays unknown. A shared geography alone cannot qualify a comparison source.
- Population/place support requires a linked study passage; separate-country mentions remain unverified. This is conservative metadata interpretation, not full-text verification.
- DOI/title discrepancies survive deduplication, saving, editing, undo, JSON backup/import, Markdown and RIS. Imported checks are historical and unverified.
- Possible book/chapter editions are grouped for display and source-target counts while retaining separately selectable records and citations. Selected edition stays consistent through filters and exports.
- Each search run retains its request, resolved criteria, observed provider queries/outcomes, execution settings, timestamps, result count and release/configuration. Retries append; opened links and manual activity remain separate. Replays use recorded criteria/settings, but provider indexes can change.
- Data and archival requests receive appropriate resource routes and specific no-result guidance. No new dataset/archive search integration or holdings claim is implied.
- Private sessions use memory for research and metrics; the tab stores only a mode flag. Reload/end clears private research and restores prior saved-mode research. Earlier saved research and downloads remain on the computer; provider requests still occur.
- White text on gold Open source buttons uses a darker accessible gold; normal/hover contrast meets WCAG AA for small text. Brand accents remain old gold.

## Validation

- `npm run qa:release`: 446/446 tests passed, resource audit passed, strict evaluation 56/56 cases and 1,232/1,232 assertions, synthetic fixture self-test passed, production build passed.
- Browser: private search/save/reload/end isolation, existing saved research restoration, append-only replay, cancellation after sources arrived, saved discrepancy visibility, distinct-edition links/save, date-filter/reset selection alignment, computed gold-button colors, data-specific empty state.
- Mobile: 390px viewport with 390px document width and 374px drawer; no horizontal overflow in tested search-history view.
- Frozen replay: 32 prior records → 26 retained → 24 possible work groups. All six earlier model-labeled candidates retained; five explicit wrong-constraint records excluded. These labels are not human ground truth. See frozen-replay.md/json for scope and file hashes.

## Fresh public-provider smoke check

No model API calls or full-text verification. Local deterministic pipeline, not production end-to-end. Earlier failing snapshots are retained alongside the final smoke record.

| Request | Returned records | Interpretation |
|---|---:|---|
| Find the book Governing the Commons by Elinor Ostrom. | 3 | Two editions of the requested book plus a separately labeled related book; group editions rather than count twice. |
| Peer-reviewed systematic reviews published since 2020 comparing online and in-person teaching for undergraduate students in the United States. | 2 | Two partial/unverified leads; no complete-request success claim. Unrelated geography-only and incidental online-survey matches removed. |
| Find peer-reviewed articles published since 2020 about women workers in Britain during World War II, 1939 to 1945. | 4 | Four partial/unverified records; possible chapter versions grouped in the UI. Historical scope still needs source reading. |
| Find primary datasets on housing affordability and eviction in Forsyth County, North Carolina from 2015 to 2024. | 0 | No confirmed dataset; routes to data resources, original publishers, codebooks and librarian help. |

## Remaining limitations

These repairs reduce demonstrated failure modes; they do not eliminate hallucination or misgrounding. Metadata may be incomplete or incorrect, narrow requests may still return no fully supported source, and third-party availability changes. Full-text study relevance, claims, source quality and comprehensive coverage still require independent librarian/student evaluation. The production build retains the existing bundle-size warning (over 500 kB).
