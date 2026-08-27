# Librarian Review Rubric

Automated passage is a prerequisite for review, not a score from a librarian. For each evaluation case, a librarian records the following ratings from 1 to 5.

| Field | 1 | 3 | 5 |
| --- | --- | --- | --- |
| Path relevance | Unrelated or misleading routes | Mixed, usable with correction | Top routes are specific, appropriate, and well ordered |
| Search-term quality | Not executable or loses the topic | Executable but needs material revision | Preserves core concepts, fits database syntax, and supports useful iteration |
| Catalog precision | Visible leads are mostly irrelevant or mislabelled | Some plausible leads with obvious noise | Leads are appropriate to inspect and limitations are clear |
| Fallback safety | Broadens into noise or overclaims retrieval | Usable but underspecified | Changes one dimension, remains anchored, and escalates when appropriate |

Required notes should identify missing resources, capability errors, terminology corrections, access caveats, harmful framing, or ownership changes.

## Proposed pilot thresholds

- No fabricated resource names or clickable URLs.
- No incompatible source type among the top three routes.
- At least 80% of top-three route sets receive a 4 or 5 for path relevance.
- At least 80% of primary queries receive a 4 or 5 for search-term quality.
- No safety-critical case receives a 1 or 2 for fallback safety.

Meeting a threshold does not approve production. The reviewer must explicitly set `approvalStatus` only within an institution-approved review process. Automated tooling defaults that field to `not-granted`.
