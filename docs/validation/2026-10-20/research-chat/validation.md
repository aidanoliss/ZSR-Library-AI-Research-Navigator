# Source-bound Research chat release validation

Research chat is a second view in the same research session, with source selection, a shared assignment context, source-card and saved-source discussion actions, persistent cited messages/drafts, and a review step back to Search.

## Evidence boundary

Only server-issued, signed Navigator records may provide evidence. Up to six attached records are authenticated; changed or expired envelopes are rejected. Only usable complete abstract passages support generated interpretations. Records with identity discrepancies, retraction flags, or absent abstract text cannot establish findings. Unknown source IDs, modified quotations, incomplete sentence context, unsupported full-text claims, model-generated links, and numbers absent from the displayed supporting quotation are rejected. No unchecked model prose is streamed.

These controls do not prove semantic entailment. An authentic source and a matching quotation can still be misinterpreted. The interface labels interpretations and shows the supporting passage, source link, and abstract-only scope. Gemini receives the question/excerpts and optional task context, not the student's notebook or every saved source.

## Checks

- 560 automated tests passed, including 25 focused chat/client/saved-evidence integration cases. Strict planner baseline: 56/56 cases and 1,232/1,232 assertions. Resource audit, fixture self-test, and production build passed. Existing large-bundle advisory remains.
- Production HTTP route: empty selection returns `insufficient_evidence`; a forged source token and invalid question return HTTP 400.
- Synthetic browser: Discuss this source selects the record; complete supporting passage is visible; view switching and normal-session reload preserve chat; private-session reload clears it. The fixture uses an in-process mock provider and no network AI call.
- Mobile browser: 390px viewport, 390px document width, composer within the viewport (16px left/right gutters).
- Real provider/Gemini browser: Navigator retrieved Russia-sanctions trade records. A selected record, “Friendly fire: the trade impact of the Russia sanctions and counter-sanctions,” supported a cited interpretation of the abstract's explanation for declining Western exports. The supporting quotation was visible. An instruction to ignore attached sources and report today's local weather produced an explicit insufficient-evidence response.
- Earlier live output included a count from a different abstract sentence outside its displayed quote. Numeric quotation checks were added and covered by regression before release. A further live reply after these checks returned a supported explanation with the correct passage.

Source-grounded question proposals offer **Use this question in Search**, which fills the proposed question for review; insufficient-evidence replies route back to the underlying research topic.

These are functional observations, not a measured general hallucination, misgrounding, or relevance-accuracy rate. Full-text access, external browsing in chat, and arbitrary source uploads are not present. Public source records alone do not make the system a librarian-approved service.
