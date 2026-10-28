# Independent faculty review and durable pilot measurement

This workflow prepares a release for an independent review. **No student cases, human judgments, or accuracy results have been invented.** The existing developer cases remain regression tests. They cannot establish independent usefulness or accuracy.

## Persistent measurement storage

`PILOT_DATA_DIR` selects a dedicated absolute directory for aggregate query, feedback, and handoff JSONL files. On a deployment with a persistent disk, use a subdirectory of the mounted disk, for example `/var/data/zsr-pilot`. Configuring a path alone does **not** make it durable. The deployment owner must provision the disk, verify its mount, and demonstrate that an aggregate test record survives redeploy/restart before enrolling users.

The implementation creates the dedicated directory with mode 0700 and files with mode 0600. Do not point it to a shared directory: its permissions will be tightened. Storage is for a single Node process; use a transactional datastore before scaling to multiple writers or replicas. Restrictive Unix permissions are not encryption at rest, a backup policy, or an access review.

Query logging remains opt-in; query text, feedback text/topics, handoff detail/contact remain off by default. Keep these defaults for student trials. Aggregate records contain counts, fixed identifiers, and boolean presence flags rather than student wording. `LOG_RETENTION_DAYS` and `LOG_MAX_RECORDS` bound retention; files are pruned on writes and periodically in production. Backups require a separate agreed deletion/retention policy.

`probePilotStorage()` attempts a private temporary write and reports writable status without disclosing paths. `loggingStatus().storage` reports the latest observed write/probe error. Query-event write errors do not interrupt search, but remain visible in storage status; feedback/handoff writes and admin reads propagate failures so the API must report failure instead of pretending events were saved. A health probe must not label a writable local filesystem as durable.

Deployment checklist owned by the pilot administrator:

- Approve hosting, provider billing/data terms, participant eligibility, notice/consent and retention.
- Provision and verify persistent storage; keep the service at one writer.
- Set `PILOT_DATA_DIR`, retain text-storage flags off, and decide whether aggregate query events are needed.
- Verify a non-sensitive aggregate event survives restart/redeploy; verify admin access and deletion.
- Keep an institution-approved private backup; do not publish raw queries or review captures in Git.

## Freeze independent cases before evaluating

Ask a librarian or faculty collaborator to collect anonymized questions from intended users **without showing them the curated topic profiles or tuned examples**. Record collection date, a pseudonymous collector identifier, consent, and independent authorship. Remove student names, account identifiers, assignment uploads, and identifying personal context. Questions used to change ranking or prompts become development cases; collect a new held-out set afterward.

Generate an intentionally empty template in an institution-approved private directory outside the repository:

```sh
node scripts/prepare-independent-review.mjs --template --out /absolute/private/cases.json
```

Fill `provenance` and add case objects with unique `id` and anonymized `query`. Optional request fields are `modeId`, `subjectFocusId`, `accessScopeId`, and `requestContext`; preserve them exactly during capture. Include comparative questions, exclusions, known items, sparse topics, source-type restrictions, and several disciplines based on independently collected needs. Do not manufacture alleged student questions just to satisfy coverage.

Before seeing results, the librarian fills `acceptanceCriteria`: `approvedBy`, `minimumCases`, `minimumUsefulProportion` (0–1), and `maximumEmptyProportion` (0–1). These values intentionally start null. As a discussion starting point, a small 30–50-question pilot with 80% useful returned top-five sources and at most 10% empty outcomes may be reasonable; these are **proposed operational goals, not validated industry standards or statistical guarantees**. The gate additionally requires every reviewed source identity/context to pass, no observed unsupported claims, and no intent reversals. Zero observed failures does not prove zero real-world risk.

Freeze the final application code after implementation and testing:

```sh
node scripts/prepare-independent-review.mjs --manifest --out /absolute/private/release.json
node scripts/prepare-independent-review.mjs --cases /absolute/private/cases.json --out /absolute/private/planned-review.json
```

The manifest fingerprints actual application files including uncommitted changes, without reading credentials or user logs. It complements a proper private release backup; it is not a replacement. Record nonsecret runtime configuration and provider availability separately with the capture. The planned packet necessarily fails readiness because it contains no results or reviews.

## Capture the frozen release, then judge it

The evaluation operator runs those exact questions and settings on the frozen release. Capture provider records and **the complete displayed response**, including guidance, fallback text, evidence notes and source descriptions. Use the existing `zsr-search-quality-review` capture format, adding:

- `releaseSha256`: fingerprint from the saved release manifest.
- `capturedBy`: operator identifier, and `generatedAt`: capture timestamp.
- `cases`: exactly the frozen cases and settings; each has `status`, `candidates`, `retrieval` and `displayedResponse` (a JSON object containing the full user-visible response). Include `generatedOverview` and `evidenceNotes` when present.

The CLI is offline: it neither submits questions nor invents search responses. Existing source-only captures are useful for ranking development but cannot pass a whole-response review gate. Runtime configuration should accompany each complete displayed-response capture; exclude tokens and credentials.

```sh
node scripts/prepare-independent-review.mjs --cases /absolute/private/cases.json --capture /absolute/private/capture.json --out /absolute/private/review.json
```

This discards any existing model or developer ratings, initializes all judgments to null, and fingerprints the request and evidence. Reviewers edit only the `review` object for each case and the `judgment`, `reviewer`, `notes`, `identityVerified`, and `evidenceContextAccurate` fields for each top-five source. Changing frozen evidence requires a new packet and review.

For each result, open the original record and, where available, the abstract/full text. Mark:

1. **Usefulness:** `useful` means it directly helps answer this question under its stated constraints; `not-useful` includes incidental keyword overlap. `uncertain` remains unresolved and blocks readiness.
2. **Identity:** confirm the title, author, document type and identifier/link describe the same real work. A resolving DOI alone is insufficient.
3. **Context:** verify any displayed quotation or description preserves negation, qualifications, population, design and outcomes. Do not treat an abstract as reviewed full text. `evidenceContextAccurate` covers what was actually displayed; note when no substantive claim was displayed.

For every case, review the entire `displayedResponse`, mark `intentPreserved`, count `unsupportedClaims`, and record `reviewer`, `reviewedAt` and `independentHumanReview: true`. For an empty result, also mark `emptyOutcomeAppropriate`: check whether the tool honestly described the outcome and supplied useful alternatives, and whether a reasonable independent library search finds obvious missed material. A technically successful request is not proof that no literature exists.

Have a second librarian independently review at least a preselected subset and all disagreements, intent failures or questionable claims. Keep both original reviews privately and adjudicate discrepancies before filling final determinate judgments. The tool records attestations; it cannot prove that a named reviewer is human or independent.

## Evaluate and report honestly

```sh
node scripts/prepare-independent-review.mjs --check /absolute/private/review.json --out /absolute/private/decision.json
```

The command exits nonzero when required review/capture metadata is missing, evidence changes, the current application differs from the frozen release, a critical defect is reported, or approved thresholds are unmet. Output distinguishes completeness, useful/judged counts, empty proportion, and readiness for the **reviewed pilot only**. The usefulness fraction is among returned top-five sources, not overall accuracy or precision@5; missing slots are captured by the separate empty-outcome measure. Report sample size and unjudged/uncertain counts and do not generalize a small convenience sample to all subjects.

Only after faculty review is complete should supervised student usability testing begin. Watch whether students understand source types, verify claims, recover from empty results, and find library-access options. Findings can guide another iteration, followed by a new held-out evaluation for material retrieval or guidance changes.
