# ZSR Research Navigator — current project audit

October 7, 2026. Scope: current local code, deterministic probes, the existing live empty-results flow at `http://127.0.0.1:3002/`, and the latest saved retrieval evaluation. This is a prioritized development backlog, not a certification of research accuracy or hosted security.

**Assessment:** suitable for a focused faculty review that explicitly tests its limitations. I would fix the query-interpretation and evidence-context defects before an independent student pilot. Broader sharing also needs a reproducible release, working provider configuration, and agreed access/data practices.

**Evidence:** all 367 local tests passed and the production build succeeded today. The build reports a large JavaScript bundle; that is a lower priority than the correctness issues below. The October 6 saved capture returned results for 24/28 queries (85.7%), with four empty searches and no detected duplicates. Its 104 displayed top-five records have no human relevance judgments. **There is no defensible overall accuracy percentage yet.** No new live retrieval benchmark or paid AI calls were made during this audit.

Evidence files: [fresh test output](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/audits/2026-10-07/test-results.txt>), [deterministic probe inputs and outputs](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/audits/2026-10-07/source-probes.json>), [October 6 retrieval report](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/validation/2026-10-06/search-recovery/provider-report.md>).

1. **Fix first: query interpretation can change the student's question.**

   A current probe compiled “Compare loneliness in adolescents and older adults” to `loneliness AND adolescent*`, with no comparison retained. Another probe interpreted “I do not want systematic reviews” as an instruction to include systematic reviews, and introduced a spurious `"but not"` topic term. These are reproduced parser defects, not guesses about model behavior.

   **Next:** retain all requested populations, recognize clause-level exclusions, and separate instructions from subject terms. Test paraphrases and ambiguous requests. When interpretation is uncertain, expose the uncertainty in the editable brief instead of silently dropping a condition. Completion means these cases and unseen equivalent phrasings preserve the original intent.

   References: [population selection](</Users/aidanoliss/Desktop/ZSR AI Assistant/config/researchSpec.js:205>), [method exclusions](</Users/aidanoliss/Desktop/ZSR AI Assistant/config/researchSpec.js:243>), [concept extraction](</Users/aidanoliss/Desktop/ZSR AI Assistant/config/researchSpec.js:418>).

2. **Fix first: real quotations can still convey a false claim, and generated prose remains unverified.**

   In a synthetic adversarial fixture, an abstract said a study “did not establish that” a proposition was true. The validator accepted a quotation containing only the proposition because it was an exact substring. A deliberately false overview also survived reply validation. These fixtures demonstrate an accepted failure mode; they are not actual student answers, real study findings, or a measured hallucination rate.

   **Next:** select complete passages with sentence boundaries and enough surrounding context to retain negation and qualifications. Make retrieved records and contextual evidence the default; suppress unsupported research conclusions. Keep abstract-only scope explicit. Any later synthesis needs claim-to-evidence checking and an abstention path. Exact quotation provenance, a disclaimer, and a second model check cannot individually guarantee truthful interpretation.

   References: [quotation validator](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/sourceEvidence.js:73>), [reply passthrough](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/validate.js:109>), [collapsed AI overview](</Users/aidanoliss/Desktop/ZSR AI Assistant/src/AssistantMessage.jsx:1576>).

3. **Fix first: keyword coverage is being used as a proxy for usefulness.**

   A synthetic bibliometric record mentioning air pollution and childhood asthma scored as a full topic match even though its abstract explicitly said no health outcomes were studied. “All topic concepts found” can be literally true while the item is a poor answer to a relationship question. The fixture demonstrates this limitation; it does not establish its frequency in real results.

   **Next:** distinguish direct evidence, background, reviews, bibliometrics, and incidental mentions; rank according to the actual research task. Keep uncertain classifications visibly uncertain. Calibrate changes against independent librarian judgments rather than simply rewarding more matching words.

   Reference: [source ranking](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/sourceRelevance.js:176>).

4. **Fix first: research accuracy is not yet measured independently.**

   The latest saved benchmark measures availability and metadata. It has zero human relevance judgments; precision and claim accuracy are unmeasured. The generalization set is explicitly a regression set, not an independently held-out evaluation. Passing 367 software tests does not resolve this gap.

   **Next:** collect unseen, real student tasks across disciplines and difficulty levels. Have librarians rate query preservation, direct/supporting relevance, source identity, quotation context, and unsupported claims separately. Measure whether students can identify source type and verify an answer. Agree pilot acceptance criteria before looking at the results, retain failures, and report denominators and uncertainty.

   References: [saved benchmark](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/validation/2026-10-06/search-recovery/provider-report.md:5>), [evaluation limits](</Users/aidanoliss/Desktop/ZSR AI Assistant/evals/README.md:3>).

5. **Before a student pilot: intended source coverage is not fully operational.**

   Credential-safe inspection found OpenAlex unconfigured locally and the institutional Primo profile disabled. Public Primo remains available as a best-effort route. In the October 6 capture, three narrow topics and the open-access-only case returned no results. This does not prove relevant literature is absent. Hosted configuration may differ from local configuration.

   **Next:** configure and test the intended providers, or make unavailable scopes unavailable to select. Verify actual library access routes with ZSR. Improve subject vocabulary and database-specific recovery for failed topics while preserving explicit assignment constraints; explain every proposed broadening.

   References: [OpenAlex status](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/openalex.js:416>), [capture interpretation](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/validation/2026-10-06/search-recovery/implementation-report.md:33>).

6. **Before a student pilot: empty-result recovery still requires too much discovery.**

   In the live flow, “Try different search terms” switches to Search strategy but leaves “Edit or refine this search” collapsed and repeats the same restrictive query. The browser's active element becomes the page body, rather than the editor or destination panel. The explanation is honest; the next action is incomplete.

   **Next:** open and focus the editor from that button, offer a concrete revised query with an explanation of what changes, preserve active requirements, and give a clear rerun action. Check keyboard focus after all panel transitions. This is an observed recovery-flow issue, not a full accessibility audit.

   Reference: [recovery action wiring](</Users/aidanoliss/Desktop/ZSR AI Assistant/src/AssistantMessage.jsx:1409>). Visual evidence appears below.

7. **Before a student pilot: source display waits for AI guidance.**

   The server retrieves records first, then waits for generation before returning the final response. Default retries can consume roughly a minute of AI request time. Fallback recovery exists, but already-retrieved sources are still withheld during that wait. This is a code-path finding, not a measured latency percentile.

   **Next:** deliver validated source records and discovery status as soon as retrieval completes. Generate optional guidance separately. Keep the existing protection against streaming unvalidated generated prose. Track time to first usable sources separately from total response time.

   References: [response sequence](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/native.js:426>), [retry policy](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/providerResilience.js:136>).

8. **Before broader sharing: access, costs, and student-data practices need a pilot owner.**

   Server-held keys, request/body limits, concurrency limits, origin controls, and protected admin routes already exist. Chat nevertheless lacks verified student identity; usage counters are process-local and IP-based. Restarts/replicas and shared campus IPs complicate quota enforcement. Project documentation also records an unfinished institutional privacy review.

   **Next:** agree an institution-approved access gate, shared usage quotas, spending limits, and responsibility for incidents. Have the relevant WFU owner review the actual provider/data flow, retention and deletion practices, and student notice. These are readiness gaps; this audit found no evidence of exposed tokens and makes no legal-compliance determination.

   References: [chat entry point](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/native.js:366>), [rate limits](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/ratelimit.js:1>), [privacy limitations](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/privacy-logging-note.md:18>).

9. **Before broader sharing: the release is not yet reproducible or adequately monitored.**

   Critical current modules are untracked in Git. Render's build command does not run tests/evaluations, and no GitHub workflow was found. A browser helper contains outdated expected wording; it was inspected, not executed in this audit. The deployed health probe checks process health, while readiness omits discovery-provider status, so a green service can still fail its main research function.

   **Next:** capture a scoped release in version control, maintain and enforce test/build/browser checks, identify the deployed commit, and smoke-test that exact version on its host. Add discovery degradation status and bounded search probes without making a transient provider failure restart the whole service.

   References: [deployment settings](</Users/aidanoliss/Desktop/ZSR AI Assistant/render.yaml:8>), [readiness checks](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/native.js:511>), [browser assertion](</Users/aidanoliss/Desktop/ZSR AI Assistant/scripts/browser-regressions.mjs:131>).

10. **Next maintenance pass: duplicated server behavior makes fixes harder to preserve.**

    The project maintains full native-HTTP and Express implementations of the same service paths. Production uses the native server. Some cross-server tests mitigate drift, but every behavior and security change still has two places to maintain.

    **Next:** select one runtime or extract one shared research/chat service with thin HTTP adapters. Preserve current behavior and security checks while consolidating. This is lower priority than the reproduced correctness defects.

    References: [production start](</Users/aidanoliss/Desktop/ZSR AI Assistant/package.json:16>), [native implementation](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/native.js:366>), [Express implementation](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/index.js:395>).

**Observed interface flow — October 7, current 541px-wide in-app viewport**

1. **Empty-results explanation — mostly healthy, recovery needs improvement.** The saved microplastic/floating-wetlands search clearly distinguishes “no matching sources” from “no literature exists,” with visible library/Scholar/help alternatives. Spacing and text were readable in this checked view. No new search was submitted during the audit.

![Current empty-results panel](/Users/aidanoliss/Desktop/ZSR AI Assistant/docs/audits/2026-10-07/01-empty-results.jpg)

2. **Refinement destination — needs improvement.** Clicking “Try different search terms” reaches this view, with the editor still collapsed and the original query repeated. The screenshot establishes the visible state; the companion DOM check establishes lost meaningful focus. There was no horizontal overflow in this view. Desktop, screen-reader, and full keyboard journeys were not comprehensively tested.

![Current refinement destination](/Users/aidanoliss/Desktop/ZSR AI Assistant/docs/audits/2026-10-07/02-refine-search.jpg)

**Preserve the safeguards already working:** provider-derived source identities, quotation provenance checks, removal of generated interpretations from evidence notes, conservative unknown-metadata labels, deduplication, explicit empty/provider-failure distinctions, and server-side credentials. The next work should strengthen intent preservation, contextual evidence, independent evaluation, and recovery without weakening these controls.

No application code was changed for this audit. Audit artifacts were added; the local production build was regenerated for verification. The existing unrelated working-tree changes were preserved.
