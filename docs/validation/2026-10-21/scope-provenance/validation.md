# Research scope and visible provenance

## Product boundary

Navigator supports library research across academic subjects: sources, search strategies, evidence evaluation, planning, and draft-review checklists. It redirects requests for finished assignment prose, paragraph-by-paragraph submission writing, fabricated evidence, detection evasion, and common unrelated personal or coding tasks. Academic research about those subjects remains allowed. Current ZSR services questions point to official pages without guessed hours, account status, or policies.

The task screen runs on the server before providers for native and Express Search (ordinary and streaming) and Research chat. A follow-up such as “Continue” checks preceding user requests; assistant messages, source text, and assignment briefs cannot authorize a wider role. An authenticated but expired attachment is omitted for source-independent planning/redirects; forged tokens still fail. Evidence generation also receives explicit scope instructions and retains authenticated-source, quote, identity, and number checks.

Scope matching is a set of conservative task rules, not proof that every possible paraphrase or attack is classified correctly. Source quotation checks still do not prove interpretation support. Refusal alone must not be reported as an accuracy improvement.

## Provenance and privacy

Responses display “Navigator research guidance · verify sources · follow your course’s AI policy.” Explicit Copy response and Export chat include a separate visible footer and prototype notice. Existing research-plan exports carry the same attribution. Original source quotations and citation metadata are not modified; RIS/BibTeX and query copying are unchanged. Normal browser selection/copy is not intercepted. No hidden watermark, student identifier, detector, tracking database, or new analytics was added. Users can remove visible attribution; it is transparency, not proof of misconduct or misuse prevention.

## Verification

- Complete isolated release QA: 579 tests passed; strict planner 56/56 cases and 1,232/1,232 checks; resource audit, browser fixture self-test, and production build passed. Existing bundle-size advisory remains.
- Server route tests cover native and Express `/api/chat`, `/api/chat/stream`, and `/api/research-chat`, with provider fetches prohibited during redirects. Tests cover chunked writing, mixed research/evasion requests, legitimate quoted assignments, academic work about AI detection/coding, and official-service routing.
- Client/export checks preserve exact source quotations and support links, append visible provenance separately, and retain scope replies across normalization and persistence.
- Production local browser: Search rejected “Write my essay on sanctions”; Research chat rejected an introduction request; Copy response reported attribution included; a later essay-structure question still returned a plan; a ZSR closing-time question provided official links without an invented time. Tests used a private session and preserved normal saved research.

## Next engineering priority

Improve retrieval quality before adding more features. Reproduce the full sanctions/civilian-well-being query that recently returned an incomplete provider result and a weak Nigeria/electoral-violence match. Check primary-concept retention, political-science versus generic well-being routing, provider timeout recovery, and ranking against the entire request. Build a fixed set of real student questions, have librarians independently grade the top five records and important constraints, and measure relevance and coverage separately from these software tests. Then use student sessions to test comprehension and task completion.
