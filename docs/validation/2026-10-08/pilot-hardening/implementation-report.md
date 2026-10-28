# Pilot hardening implementation — October 8, 2026

## Status of the five workstreams

1. **Backup and exposure review:** created and byte-verified a 322-file pre-change local archive and verified a Git history bundle under `.local-backups/2026-10-08-pre-fixes`. Created a separate PRIVATE GitHub repository, `aidanoliss/ZSR-Navigator-private-backup`, and pushed a reviewed code-only snapshot on `codex/pilot-hardening`. The snapshot excludes credentials, runtime logs, staff documents, historical Git objects and unrelated modules/projects; its file manifest is retained locally. Restrictive permissions are not encryption. The existing public repository remains public. Cached public history contains 98 query records; their provenance and present remote exposure still require review before any history cleanup. No public history was rewritten.
2. **Search correctness:** provider document types govern article classification. A narrow title fallback preserves generic oral-history recordings. Comparative questions retain both groups; conversational method exclusions are preserved and compiled into queries. Regression checks exercise Boolean semantics and provider requests. Natural-language parsing remains fallible, and provider NOT filters can overexclude records mentioning a method only in passing.
3. **Evidence discipline:** new replies enforce an evidence-only pilot policy. Free-form model conclusions are discarded server-side; database explanations and orientation come from controlled templates. Accepted evidence notes must match complete sentences from the supplied abstract, with neighboring sentences displayed. Older saved conversations retain their original warning. Exact quotation and context checks reduce misgrounding; they do not prove entailment, relevance, completeness, or eliminate hallucination risk in source selection/metadata.
4. **Delivery, recovery, measurement:** streaming publishes source records before optional AI notes, and preserves records if guidance fails. AI retries share a total time budget. Empty-result recovery opens the editor, offers conservative phrase relaxation, and requires explicit rerun. Unconfigured Open Access options are identified. Public provider diagnostics and readiness distinguish configuration from reachability. Private pilot storage supports a dedicated directory, retention and explicit write failures; a verified persistent deployment mount and restart/redeploy test remain outstanding.
5. **Release validation:** all software release checks passed. Prepared an empty independent-case template, release fingerprint, complete-response review packet workflow and human-review gate. No student questions, librarian ratings, or human accuracy results were invented. Independent faculty review has NOT occurred.

## Verification

- `npm run qa:release`: 393 tests passed; resource audit passed; 56/56 developer evaluation cases and 1,232/1,232 automated checks passed; browser fixture self-test and production build passed.
- Browser checks: empty-result recovery opened and focused the editor without submitting; accepting suggested terms enabled explicit rerun and showed the change list; discard restored the original draft. A delayed synthetic response displayed three accessible source records before optional guidance completed and then finished without another result panel.
- Final real-provider developer capture: 28 searches, 24 nonempty (85.7%), 19 with at least five candidates, 341 total candidates, 108 displayed top-five candidates, zero detected duplicates, and no provider failure outcomes. Mean recorded retrieval latency: 1.947 seconds in this run, not a production service-level guarantee.
- Earlier matched developer capture also had 24/28 nonempty. More candidates are not proof of better source quality. Precision@5, usefulness, claim accuracy and human-verified identity remain **not measured**.
- Four empty cases: three sparse topics and one Open Access-only request with that provider unconfigured. Honest recovery is implemented; these retrieval gaps remain.
- No paid model call was used to claim end-to-end AI quality. Synthetic tests validate protocol and failure handling only.
- Local app restarted on http://127.0.0.1:3002/ with current backend and build. No public deployment was performed.

## Next steps

1. Have a librarian supply and freeze 30–50 anonymized, previously unseen questions with assignment constraints and approve pilot acceptance criteria before seeing outputs. Use `docs/pilot-review-2026-10-08.md`; 30–50 is a proposed pilot size, not a validated statistical standard.
2. Configure approved provider access, verify a persistent storage mount through redeploy, and review the existing public history for actual student/staff material. Do not republish historical logs.
3. Review every returned top-five source and every displayed claim, double-review disagreements, then run supervised student usability sessions. Record empty outcomes separately from relevance.
4. Use those findings to improve sparse-topic retrieval and ranking. Only report accuracy after independent judgments exist; recapture and re-review after material changes.

Artifacts: `provider-report.md`, `provider-capture.json`, `release-checks.txt`, `release-manifest.json`, `independent-cases-template.json`, `recovery-editor.png`, and `source-first-synthetic.png` in this directory. The earlier intermediate capture preserves the oral-history regression caught and fixed before the final run.
