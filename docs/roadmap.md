# ZSR Research Navigator Roadmap

## Current demo

- Normalized, editable ResearchSpec with concept/facet corrections
- Six enforceable source-mode contracts with capability-based routing
- Subject-aware, variable-length ZSR path recommendations
- Keyword/Boolean searches with per-query concept-retention validation
- Intent-gated, relevance-filtered live ZSR discovery leads
- Topic-angle brainstorming and guided planning
- Source evaluation, citation, responsible-AI, and limitation guidance
- Bounded too-broad, too-narrow, wrong-discipline, and wrong-source-type refinement moves
- Recommendation provenance, ownership/review status, configuration version, and plan hash
- Per-chat folders and browser-local research workspaces
- Assignment briefs, saved trails, search history, and librarian review packets
- Restricted, read-only librarian QA with local review-packet export
- RIS export from returned citation metadata
- Governed named-librarian routing with generic fallback
- Provider-reported book location, call number, and availability guidance
- Optional separate OpenAlex open-access metadata lane with rights provenance

## Next pilot priorities

1. Have librarians score the baseline and 54-case discipline-by-mode-by-paraphrase matrix.
2. Replace unassigned resource owners and pending review states with approved institutional records.
3. Conduct manual keyboard-only, screen-reader, zoom, contrast, reduced-motion, and mobile usability review.
4. Add configuration writes, approval, import, and rollback only after institutional authentication, authorization, persistence, and audit ownership exist. The current QA console is intentionally read-only.
5. Run the narrow two-discipline student pilot described in `docs/duke-readiness-packet.md`.
6. Sample and librarian-score OpenAlex relevance, OA-location accuracy, and license/version display before making the combined lane the default.

## Hardening completed on the pilot branch

- Shared request validation for both Node server entry points
- Normalized ResearchSpec, source contracts, query compiler, plan validation, and safe-failure metadata
- 47-prompt automated librarian regression set and strict runner
- 54-case metamorphic matrix across three disciplines, six modes, and three paraphrases
- Loaded-question premise-check metadata and model-instruction suite
- Reliability tests for malformed requests, topic switching, retries, and zero-result behavior
- Provider timeout/retry/circuit handling, request limits, rate limits, CORS restrictions, and protected administrative reads
- Explicit resource ownership and pending-librarian-review metadata
- Generic institution-profile adapter and blank, unapproved Duke template
- Structural and optional live URL resource audits
- Handoff focus management, workspace tab semantics, and reduced-motion support
- Release evidence and institution-config-diff scripts
- Official integration proposal and staff decision packet

## Official integration track

- Replace hand-maintained database metadata with a reviewed LibGuides/A-Z export when available.
- Use an approved Primo API endpoint and key rather than relying only on public discovery requests.
- Confirm LibKey/Third Iron configuration and preferred full-text workflow.
- Obtain and monitor a server-side OpenAlex API key if the OA lane is enabled in a shared deployment.
- Pilot full-text summaries only after exact-version rights enforcement, privacy/retention approval, and citation-preserving summary evaluation exist.
- Integrate Scite MCP only after subscription permission, OAuth/data-flow privacy review, and an institution-owned pilot are approved.
- Select a repository software license strategically; do not describe a visible repository as open source before that decision.
- Decide whether authentication, course-system context, or account sync is appropriate.
- Approve student notice, retention, logging, support ownership, branding, and incident-response policies before production use.

## Production readiness gates

- Librarian evaluation thresholds are defined and met.
- Privacy, accessibility, security, and records-retention reviews are complete.
- API ownership, billing, monitoring, uptime, and support escalation are institutionally owned.
- Every external link and database label has a documented reviewer and review date.
