# Duke Readiness and Pilot Packet

## Proposed framing

The prototype is a governed pre-search and AI-literacy layer over institution-approved library paths. It is not a replacement for Duke’s discovery system, a literature-review engine, or an authenticated access tool.

The current live application is a Wake Forest student-built prototype. Duke has not approved, configured, branded, hosted, or secured it. `config/institutionProfile.js` contains an intentionally blank Duke template so the integration requirements can be reviewed without inventing Duke resources, contacts, credentials, or policies.

## What is ready to demonstrate

- A normalized ResearchSpec showing how the system interpreted concepts, population, outcome, geography, date, discipline, source type, and purpose.
- Explicit source-mode contracts for scholarly articles, books, news, data, primary sources, and legal/policy materials.
- Capability-based resource selection and database-specific executable searches.
- Recommendation provenance, configuration version, plan hash, and safe-failure reason.
- Premise checking for controversial, causal, medical, political, identity-based, and conspiratorial prompts.
- A deterministic plan that remains usable when Gemini is unavailable.
- Honest zero-result behavior when public discovery is unavailable.
- Automated evaluation across disciplines, modes, paraphrases, and loaded questions, with human approval shown as a separate pending gate.
- A versioned institution profile and field-level configuration difference report.

## What is not ready to claim

- Duke resource or link approval.
- Duke Primo parameters, APIs, credentials, holdings, or authentication.
- Duke branding or accessibility approval.
- Duke privacy, data-retention, security, procurement, or hosting approval.
- Search of licensed full text or confirmation of user access.
- Librarian endorsement based only on automated tests.

## Inputs Duke would need to own

| Area | Institution-owned input | Prototype default |
| --- | --- | --- |
| Resource registry | Approved databases, guides, source capabilities, limitations, owners, and review dates | Blank for Duke |
| Discovery | Approved public or API host, view, scope, tabs, query syntax, keys, and rate limits | Blank for Duke |
| Help | Ask-a-librarian, subject/service routing, ILL, escalation threshold, and ticketing behavior | Blank for Duke |
| Citation and access | Approved citation, Zotero, full-text, and document-delivery routes | Blank for Duke |
| Branding | Product name, visual identity, disclaimer, accessibility owner | Blank for Duke |
| Privacy | Permitted processors, notice, logging fields, retention, deletion, and incident response | Storage-minimizing defaults only |
| Operations | Hosting owner, environments, monitoring, deployment, rollback, support, and decommissioning | Existing independent Render prototype |

## Recommended narrow pilot

Scope the first review to two disciplines with different evidence patterns, for example one humanities area and one health/social-science area. Use two librarians and 8 to 15 volunteer students. Begin on a staging service with synthetic or volunteered non-sensitive topics. Do not activate the blank Duke profile until the fields above are supplied and approved.

### Study tasks

1. Turn an assignment into an executable ResearchSpec.
2. Compare books and scholarly-article modes on the same topic.
3. Locate an appropriate database and execute the provided query.
4. Recover from a query that is too broad, too narrow, or in the wrong source mode.
5. Identify why a recommendation was made and what its limitations are.
6. Escalate to a librarian when the plan reports a weak match.

### Proposed outcome measures

These are pilot targets, not current claims:

- 100% repeatability for identical deterministic plans.
- Zero fabricated resource names or clickable URLs in the governed plan.
- At least two of the top three routes support the selected source type.
- At least 80% of top-three routes receive a librarian rating of 4 or 5.
- At least 80% of visible discovery leads are judged relevant enough to inspect.
- At least 80% of students reach an appropriate database and execute a viable query without intervention.
- 100% of Gemini/discovery failure cases retain an honest deterministic next step.
- Zero raw-query storage by default.

Record time to first appropriate database, executable-query success, mode-selection correctness, first useful source found, refinement use, and librarian rescue rate. Do not collect student identity unless an approved study design requires it.

## Review sequence

1. Librarian content and source-capability review.
2. Assessment/user-experience protocol and accessibility review.
3. Privacy and data-flow review using `docs/data-inventory.md`.
4. Application security and deployment review using `docs/threat-and-failure-model.md`.
5. Staging usability pilot.
6. Joint decision to stop, revise, or move to a limited institutional pilot.

## Evidence to bring to a technical meeting

- `docs/architecture-summary.md`
- `docs/data-inventory.md`
- `docs/threat-and-failure-model.md`
- `docs/duke-demo-10-minute.md`
- `docs/technical-correction-note.md`
- `evals/evaluation-matrix.json`
- `evals/loaded-question-review-set.json`
- Output from `node scripts/build-release-evidence.mjs`
- Output from `node scripts/diff-institution-config.mjs`

The decision request should be small: permission to conduct a governed content and usability review, not permission to launch an official Duke service.
