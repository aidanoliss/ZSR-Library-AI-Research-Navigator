# Five quality improvements: implementation and verification

Completed for the October 4, 2026 student-trial preparation. This is a software verification record, not student or librarian approval.

## Final behavior

1. **Interpretation:** Requested format, topic, method, subject period, and publication constraints are separate. Studies of newspaper coverage, book banning, and primary sources are no longer routed as requests for those objects. Historical dates describe the subject unless publication wording makes a publication restriction explicit. Methods and exclusions survive compiled queries and corrections. Longer unmatched clauses use keywords; explicit phrases remain quoted.
2. **Neutral inquiry:** Loaded predicates are removed from actual retrieval terms, and the UI explains the reformulation. An interest in possible harms is retained without assuming the result. Synthetic disconfirming-source tests check retrieval behavior, not just a safety flag.
3. **Source identity and role:** Known-item searches compare title and real author fields, with a bibliographic fallback when necessary. Related works are distinct from the requested work. Format, role, and peer review are separate; inferred labels say so. Combined interventions are not presented as established head-to-head comparisons. Explicit provider method contradictions can fail a requirement; missing method evidence stays unverified.
4. **Evidence:** Retrieval precedes generation. The model receives bounded server-retrieved abstract excerpts, each with a stable source ID. The final public evidence notes contain only source ID, an exact contiguous provider passage, and abstract scope. Unknown IDs, invented quotations, unavailable text, and generated claim fields are rejected or removed. Streaming does not expose unvalidated draft text. The separate AI overview is unverified orientation. No full text is retrieved.
5. **Reading workflow:** Each source has a compact Read & evaluate disclosure with role-specific reading advice, passage/page/limitation prompts, local notes, and citation-chaining guidance. Saving notes adds or updates one saved source without overwriting its other fields. Five unique sources appear initially; remaining sources stay in Show more.

## Evidence design decision

Intermediate live trials retained AI paraphrases beside exact quotations. In `grounding-after.json`, a note added a screening/support implication absent from its quoted study-purpose passage. Stricter instructions reduced that example, but `grounding-final.json` still contained an added risk claim absent from its selected quote. Those files are intermediate diagnostic artifacts, not examples of the released card format.

The final design therefore removes generated source-claim fields from public evidence notes, including legacy or noncompliant model fields. Cards display AI-selected verbatim provider passages, with explicit selection/context limits. See `extractive-evidence-final.json` for the final live API check. This avoids presenting a generated paraphrase as a source finding; it does not establish that AI chose a relevant passage or that the abstract accurately represents the full work. The overview can still hallucinate or misground claims.

## Live retrieval observations

Same 28 prompts and ten-candidate limit as the earlier audit; human ratings remain blank. The final housing case was recaptured after city-scope synonyms were added; its timestamp is included in the combined capture.

| Observation | Before | After |
| --- | ---: | ---: |
| Topics with returned leads | 15/28 | 22/28 |
| Empty result sets | 13 | 6 |
| Empty cases affected by disabled providers | 2 | 2 |
| Candidate records | 119 | 149 |
| Records with provider abstracts | 110 | 131 |
| Detected duplicate candidates | 0 | 0 |
| Human relevance / claim-support accuracy | Unmeasured | Unmeasured |

Examples: qualitative interviews/college food insecurity now returned ten leads; women abolitionists before 1865 returned two; electoral systems/turnout returned three; books introducing environmental justice returned ten. Hardin's original 1968 article ranked first with DOI `10.1126/science.162.3859.1243`; nine related works remained labeled separately. No bibliography identity was hardcoded.

Six cases remain empty: housing policy, a sparse local topic, the makerspaces/language-revitalization intersection, floating wetlands/microplastics, and two OpenAlex-related cases. Zero matches do not establish that literature does not exist. OpenAlex remains unconfigured; no credentials were added or changed. Specialist database prioritization can still need librarian adjustment (for example, a mixed climate/newspaper-coverage request can favor science/general routes).

## Verification

- Full automated suite, strict 56-case pilot regression, production build, and diff whitespace checks run after integration; final counts are reported in the chat.
- Backend tests cover native and Express servers, four response styles, and buffered/streamed responses; retrieval precedes generation and client-supplied source text is not trusted.
- Browser checks: a new sanctions search completed, a selected provider passage appeared on its matching source, five initial cards expanded to ten distinct titles, and a reading note survived reload and appeared in Saved sources. A QA-labeled example note remains for the Brooks sanctions article.
- At a 390px viewport the document width remained 390px. Disclosures, source actions, and reading controls stayed within the viewport. Temporary viewport sizing was reset.
- Build succeeds with the existing Vite bundle-size advisory (main JavaScript bundle is slightly above 500 kB); this does not block the preview.

See `provider-capture-after.json`, `provider-report-after.md`, `known-item-after.json`, and the student testing guide at `docs/student-testing-guide.md`. No live capture is a statistically controlled effectiveness study. Student/faculty usefulness, claim support, and task completion remain to be measured.
