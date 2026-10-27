# Search query card layout — 2026-10-27

The query list used a two-column grid but rendered only its first option; every alternative was behind More ways to search. Show the first two options, move only the remaining options into the disclosure, and retain consecutive numbering. A list with exactly one query spans both columns.

Validation: clean release QA passed all 638 tests, resource audit, 56 strict planner cases, synthetic fixtures and production build. Browser replay of the sanctions/comparison topic with government-behavior clarification shows Start here and Include related terms together, with 6 more options. DOM inspection confirms 2 initial cards, 8 total queries and 8 unique query texts. A known-book search produces 1 card spanning the full 872px list, with no More disclosure. Screenshot two-query-cards.jpg shows the repaired desktop layout. Synthetic sources were used; this change does not alter retrieval or query generation.
