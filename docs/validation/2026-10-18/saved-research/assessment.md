# Saved research and prompt refinement — October 18, 2026

Release commit: b027a5272307ae484b6c7cc64c9404aa2c8b3929. Render health confirmed `ok: true`, release `b027a5272307`; live browser reload confirmed Refine this prompt and the saved-source navigation.

## Changes

- Save controls on source cards and existing database/resource save controls now become Unsave. The most recently removed item can be restored with its original notes, status and metadata during the current session. Undo does not carry into another research session and is not retained across reloads.
- One reusable saved-source collection powers the results tab and My sources workspace. It includes title/author/notes search, status filtering/editing, automatically saved reading notes, removal, and RIS export for the filtered selection. Databases and other saved options appear separately in the workspace. Existing source comparison and citation editing remain available there.
- The Refine this prompt helper accepts optional population, comparison, location and method details, previews the full request, and applies it to the editable topic. Search remains a separate action. No model call or invented requirements are used. Existing assignment requirements remain subject to the existing revision logic.
- Saved data remains local to this browser and research session; this change does not add account sync.

## Verification

- Full release checks: 414/414 tests passed; resource audit passed; 56/56 automated evaluation cases and 1,232/1,232 assertions passed; deterministic fixture self-test and production build passed. Existing >500 KB bundle warning remains.
- CI passed: https://github.com/aidanoliss/ZSR-Library-AI-Research-Navigator/actions/runs/39165774306
- Browser checks used explicitly synthetic records on port 3006, with no provider calls. Verified result-card unsave, count update, saved-tab empty state, undo with preserved Use status and notes, note editing, no-match filtering, clear filters, and persistence after reload. The workspace displays the same source collection and retained notes.
- Prompt test caught and repaired label leakage into search terms. Final generated query preserved the regime comparison, Canada and systematic reviews, without adding “Location”, “Study” or “method” as required keywords. Applying the preview did not run a search; clicking Search did.
- Desktop and 390px mobile layouts visually checked. Screenshots contain labeled synthetic records, not claimed scholarly evidence.

These are software and interface checks, not a new real-world relevance or hallucination-rate study. All evaluation cases still await human review.

## Outreach

The locally saved partner shortlist is docs/outreach/2026-10-18-library-partners.md. It contains public official-source references and eight prospective institutions, with Wake, Elon, UNCG and Forsyth Tech proposed as the first wave. No outreach was sent; the shortlist was not included in the public release commit.
