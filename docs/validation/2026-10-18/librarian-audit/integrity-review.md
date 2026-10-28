# Librarian integrity review — 18 October 2026

Scope: read-only audit of release `b027a52` in `/private/tmp/zsr-live-release-2026-10-16`. This is a simulated ZSR librarian perspective, not approval by a Wake Forest employee. No application code changed. No live model/provider calls were made in this review. Public-deployment settings and institutional agreements were not inspected.

**Assessment:** The evidence-only design is a meaningful strength. I would use the prototype in a supervised discovery exercise after repairing the saved-source provenance defect, while explaining that it is not a comprehensive literature-search service. I would not yet present the saved/exported collection as a reliable audit trail or an institutionally approved service.

## Confirmed findings

### 1. P1 — Saving removes the DOI identity warning students need when citing

**Observed by executable synthetic probe, not just inferred:** a source with `identityCheck.status = "title-difference"`, the alternate registry title, a warning, and a check timestamp loses the entire `identityCheck` object when saved. The warning is then absent from portable JSON, saved-workspace Markdown, and RIS. The live result does show the warning, so the risk grows precisely when a student moves from discovery to using a citation.

Cause: `src/researchWorkspace.js:70`–79 allowlists source fields without `identityCheck`; `normalizeSourceRecord` at line 112 applies that allowlist on save and later normalization. `src/ResultsWorkspace.jsx:108` exports normalized saved sources to RIS. `src/ris.js:175`–179 records provider provenance only, even if an unsaved record contains an identity warning. The generic instruction to check metadata does not communicate a known discrepancy.

**Acceptance:** Preserve a bounded, typed identity-check object through Save, edit notes, Unsave/Undo, JSON backup/import, and review. Show a conspicuous “Citation details need checking” state in the saved card. Carry the registry discrepancy/check date into human-readable export and RIS notes. Imported checks should retain provenance but be labeled historical/unverified, not upgraded to current verification. Add a round-trip test with an actual title disagreement and an unavailable-registry check.

### 2. P2 — Downloaded research plans misstate discovery provenance

**Observed by synthetic export:** a Crossref-only source is headed “Live ZSR discovery leads” and the export ends “This tool does not search live databases…”. The current product does perform live metadata discovery, so that phrasing conflicts with its actual behavior. Exported source rows omit provider-specific provenance and DOI identity warnings even when present in the live response.

Evidence: `src/exportPlan.js:101`–107 and 113–116. The export includes useful passages and clear abstract-only caveats elsewhere; the problem is the outdated source section and footer.

**Acceptance:** Use “Retrieved source records”, label each metadata provider, include retrieval date/identifier and unresolved identity warning, and state the exact limitation: metadata discovery is live; full-text access and study findings are not verified. Test Primo, Crossref, OpenAlex, mixed, and empty results. Ensure Markdown/plain text/PDF exports preserve the same distinctions.

### 3. P2 — “Searches tried” is a click/activity log, not a reproducible search history

**Observed by executable synthetic probe:** two runs of the same query/tool/URL collapse to one record. The timestamp becomes the second run’s time, but the first run’s result note survives. Supplied request facets and result counts are discarded. Markdown omits even the retained time and URL. A librarian cannot reconstruct which search limits produced which result set, and a student cannot use this as the method record for a capstone or review.

Evidence: `src/researchWorkspace.js:158`–169 defines the small schema; 238–246 merges repeated entries and keeps the old note; 374–380 exports only query/tool/note. `src/SourceResults.jsx:50` records opening a source under its article title as a history entry. `src/App.jsx:1013` is the history callback; it is wired to those clicks. Chat messages retain useful context separately, so this is not a claim that all request context is lost everywhere.

**Acceptance:** Separate “Opened resources” from “Search runs”. Store each submitted run with original request, resolved query/query dialect, complete ResearchSpec, provider/lane, active filters, execution time, result count, provider status, and release/config version. Preserve revisions and repeat attempts rather than silently replacing them. Export and replay the resolved criteria; label results as potentially changed on rerun. Add a regression for same query with different population/date requirements and different outcome notes.

### 4. P2 before institutional rollout — Approval and maintenance ownership remain configuration placeholders

**Code-observed governance gap; real-world approvals unknown:** the Wake profile explicitly says `approvedForInstitutionalUse: false`, has no reviewers, and marks its resource registry `pending-librarian-review` with `owner: null`. Resource loading carries governance metadata but does not require librarian approval before use. A “curated” database route is not automatically one a ZSR librarian has reviewed.

Evidence: `config/institutionProfile.js:21`–25 and 50–54; `server/retrieve.js:27`–50. This may be correct for a clearly labeled student prototype. It is a gate to official adoption, not evidence of misconduct or absence of informal faculty collaboration. Configuration supports an approval validator; the missing part is an approved operational profile and lifecycle, not lack of any governance mechanism.

**Acceptance:** A named ZSR owner reviews the database mappings, authentication/access guidance, and subject routes; records scope/date/renewal interval; and approves a versioned profile. Keep the student prototype label until then. Add a deploy readiness gate for an institutionally branded approved mode and a visible route to report obsolete resources. Do not set approval booleans simply to pass a test.

### 5. P2 for shared-library computers — Browser persistence needs a clearer session/privacy mode

**Code-observed limitation:** the app automatically writes draft text, full saved sessions, and folders to localStorage, without expiry or an ephemeral/no-save choice in this path. There is an entry notice that requests go to an AI service and research stays in the browser, plus individual session deletion. Those are real protections and should not be described as missing. However, “in this browser” is easy to read as private on a shared workstation; server retention defaults do not clear browser storage.

Evidence: `src/App.jsx:822`–830 (automatic writes), 1052–1068 (individual session delete), 1572 (entry notice); `src/browserStorage.js:3`–4. `server/log.js:16`–25 has privacy-conscious logging defaults and bounded server retention. This review did not inspect browser profiles or deployment environment flags, and did not find a breach.

**Acceptance:** Offer “Private research session — do not save on this device” before first input; show a shared-device notice and a single clear-local-research control that explains exactly what is deleted. Keep server event retention, external AI-provider handling, and local storage retention distinct in a short privacy explanation. Verify no local write occurs in private mode and that delete covers draft, sessions, active pointer, and folders without deleting unrelated origin data. Have institutional reviewers decide whether SSO is appropriate; it does not by itself erase locally stored data.

## Safety and functionality that held up

- `server/validate.js:113`–122 replaces free-form model answers with deterministic orientation and uses an allowlist. In the synthetic probe, a fabricated causal conclusion and extra summary field did not survive.
- `server/sourceEvidence.js:68`–82 requires a retrieved source ID, abstract scope, an exact supplied quotation, and complete sentence context. The probe retained “did not establish a causal effect”, stripped a generated causal claim attached to that quotation, and rejected a fabricated affirmative quotation. Exact quotation matching still does not prove the source is reliable or the selection relevant; the UI explicitly says so.
- `src/SourceResults.jsx:70`–72 says AI-selected passages are abstract-only, shows surrounding context, and states that no full text was retrieved.
- RIS export fills metadata already present rather than inventing authors/year. Source-type and provider metadata are distinct from student notes.
- Browser storage failures are caught and protected against accidental overwrite. Individual session deletion, import validation, imported-data caution, Unsave/Undo, bounded storage, and note preservation exist.
- Rate limiting and concurrent request budgets exist. `server/ratelimit.js` is explicitly process-local, and `server/httpSecurity.js` restricts admin reads with a bearer token. This is not an unauthenticated admin dashboard. Multi-instance rollout would need a shared rate-limit store; the review did not validate production proxy trust settings or authentication configuration.

## Tests and limits

Ran:

```sh
node --test test/source-evidence.test.js test/research-workspace.test.js test/ris-export.test.js test/security-hardening.test.js test/log.test.js test/browser-storage.test.js
```

**60 tests passed, 0 failed.** These exercise deterministic protection and existing behavior. The search-history test intentionally enshrines one-updated-entry behavior, which demonstrates why a green suite does not establish a librarian-appropriate research log.

Additional focused synthetic probes are recorded in `integrity-review-evidence.json`: Save/export identity loss, mixed-provider export labeling, repeat-search history loss, and fabricated-claim rejection. No accuracy percentage is claimed. This review does not measure recall, ranking relevance across disciplines, students’ reading comprehension, WCAG conformance, live provider uptime, actual licensing/access, or independent human judgments of scholarly quality.

## Librarian follow-through

After the provenance and history repairs, test with a ZSR liaison and students using actual assignments: a first-year paper, a humanities primary-source task, a systematic-review style request, and a known-item book search. Ask students to identify the source type, explain why it fits, find the methods/limitations in the original, and use a second search tool. Score those observed behaviors separately from “a page loaded” or “five results appeared”. This is where the tool can support research learning rather than merely provide a polished list.
