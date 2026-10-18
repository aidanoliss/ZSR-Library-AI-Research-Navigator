# Six research-guidance features

Implemented optional clarification, required/preferred scope controls, visible metadata-fit explanations, seed-source exploration, a source-linked evidence notebook, local structured relevance feedback, and transparent search coverage.

## Evidence and limits

- Focused regressions cover semantic clarification, skip behavior, preference round trips and repeated searches, method contradictions, citation direction and identity checks, bounded queries, relationship deduplication, access-scope preservation, notebook import/export and confirmation invalidation, feedback queue normalization/private behavior, and attempted versus confirmed search coverage.
- Browser checks exercised the sanctions clarification, actual resulting Boolean query, source save, optional feedback, note creation/confirmation/edit invalidation/reload persistence, preferred population/location and repeated search, and coverage display. The synthetic fixture data is clearly marked; it is not a retrieval accuracy test.
- Mobile check: 390px viewport and 390px document width, without horizontal overflow. Screenshots are local test evidence.
- `live-exploration.json` records a fresh public Crossref smoke test through the production HTTP handler: 10 related metadata results, 8 DOI-linked references, and an explicit unavailable state for incoming citations without an indexed provider. These numbers are returned records, not human-verified relevant sources. Invalid request body returned HTTP 400.
- Incoming citing-work retrieval uses OpenAlex when configured. Without it, the application explains the limitation and links to a Scholar title search. Crossref does not silently relax open-access-only scope.
- Private-session browser verification confirmed feedback persists across searches and clears on reload.
- The real-provider browser search used a private session. No student feedback was transmitted or emails sent.

## Remaining limitations

No feature establishes that a claim is supported by full text. A real DOI and a real citation connection do not establish agreement, relevance, or research quality. Notebook confirmation is the student's own attestation. Feedback exports need independent human review before becoming evaluation labels. Provider indexing, deadlines, sample limits, unavailable providers, and absent abstracts can still yield incomplete or empty results.

The production bundle retains the existing over-500KB advisory. No account system, server-side feedback collection, or automated institutional endorsement was added.

## Final automated checks

493/493 tests passed. The strict planner baseline passed 56/56 cases and 1,232/1,232 assertions. The resource audit reported zero technical errors. The HTTP fixture self-test and production build passed. Human relevance ratings and librarian approvals remain pending; these pass rates are not search accuracy measurements.
