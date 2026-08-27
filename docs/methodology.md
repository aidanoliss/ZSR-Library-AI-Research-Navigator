# Research Navigator Evaluation Methodology

The evaluation program tests whether a deterministic research plan is reproducible, source-mode appropriate, concept preserving, inspectable, and safe to use as a starting orientation. It does not measure whether a literature review is complete and does not grant librarian or institutional approval.

## Evidence layers

1. Unit and contract tests validate request handling, routing, query construction, link allowlisting, provider failure, accessibility structure, privacy/security defaults, and institution profiles.
2. The librarian baseline runs common and niche prompts across disciplines against explicit routing and query expectations.
3. The metamorphic matrix runs three paraphrases of each discipline topic through all six governed source modes. It checks mode propagation, mode-capable routes in the top three, per-query concept retention, paraphrase stability, provenance, safety/failure metadata, configuration version, and plan hash.
4. The loaded-question set covers causal overclaim, medical misinformation, political/conspiratorial framing, stigma, determinism, and presentism.
5. Human librarians separately rate path relevance, search quality, catalog precision, and fallback safety. Blank ratings remain pending and cannot be converted into automated approval.

## Reproducibility

Every deterministic plan reports a configuration version and plan hash. The release evidence report also records the source commit, branch, Node version, dirty-tree state, mode summaries, and explicit human-approval status. Re-running identical input against identical configuration must yield the same deterministic hash.

## Metamorphic expectations

- Equivalent paraphrases should retain at least two of the top three routes within the same discipline and mode.
- Changing only source mode should preserve core concepts while changing route capabilities and query treatment.
- Books and scholarly modes must not return the same ordered plan; books should prioritize catalog/monograph paths while scholarly mode prioritizes disciplinary article indexes.
- Every primary recommendation query must preserve all required ResearchSpec concepts.
- The same strong query may be reused across compatible databases. The evaluator does not require artificial variation that drops a concept; it still rejects duplicate moves within the same location or redundant generic/fallback options.
- A weak or invalid plan must report safe-failure metadata and a usable clarification or librarian path.

## Known evaluation boundaries

Automated tests do not confirm licensing, holdings, full-text access, librarian endorsement, accessibility with assistive technology, privacy compliance, application security, or student learning outcomes. Public-provider relevance also requires sampled human review. Those remain separate release gates.
