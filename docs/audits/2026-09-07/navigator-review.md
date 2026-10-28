# ZSR Navigator review — September 7, 2026

**Recommendation: prioritize research correctness and a simpler student workflow before expanding features or institutions.** ZSR Navigator has substantial implementation and thoughtful source/access safeguards. The critical gap is consistent performance on ordinary student language: an attractive, well-labelled plan can still change the student's topic or ignore an assignment constraint.

This assessment covers the current canonical repository root and its uncommitted working-tree changes. It combines a newly run local browser journey, source inspection, deterministic and mocked-provider reproductions, and automated checks. It is not an audit of the deployed Render service or an institutional approval. No application source files were edited.

The strongest product promise would be: **Turn an assignment into a useful search, a small set of defensible source leads, and a clear next action.** Success should mean a student can explain why a source fits and what to try next.

## What is already worth keeping

- Deterministic resource routing and server-side link allowlists reduce invented library destinations.
- The editable interpretation makes incorrect assumptions inspectable and correctable.
- Library and open-access lanes are distinguished; the UI warns that metadata does not establish access or source quality.
- Source saving, notes, status tracking, RIS export, search history, and librarian handoff already exist. These need better integration and validation, rather than being added again.
- Guest Primo sandbox records cannot silently become student results.
- Provider keys remain server-side; request limits, admin authentication, retention limits, and default-off query text logging provide a useful foundation.
- The visual identity is recognizable and consistent. The phone-sized workspace inspected in this audit reflows cleanly.

## Five captured flow steps

The new browser request was: “Find peer-reviewed studies on how urban tree canopy affects neighborhood summer temperatures, published since 2020. I need three sources for a first-year research paper.” The desktop viewport was 1280 × 720. The phone-sized workspace check was 390 × 844. Existing sidebar chat titles were present, but old responses were not used as current quality evidence.

### 1. Start a topic — functional, too much configuration

![Step 1: Navigator entry screen](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/audits/2026-09-07/01-start.png>)

The identity and prototype notice are clear. However, subject focus, research mode, source access, and four response styles compete with the topic field. The hero consumes substantial vertical space, and seven icon actions appear before a student has a plan to export. “Bibliographic metadata fallback” describes implementation rather than a student decision.

**Change:** lead with the topic or assignment and one primary action. Present optional requirements beneath it. Infer likely source needs, then offer a compact, editable confirmation. Put advanced controls and export utilities behind clearly labelled secondary actions. Keep the brand while reducing the persistent header and sidebar emphasis.

### 2. Interpret the request — confirmed correctness failure

![Step 2: Incorrect required concepts](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/audits/2026-09-07/02-interpretation.png>)

The displayed required concepts were `urban`, `peer-reviewed`, and `neighborhood summer temperatures published since`. The main subject, **tree canopy**, disappeared. The date field correctly displayed `since 2020`, but the primary database query became:

```text
(urban OR city) AND peer-reviewed AND "neighborhood summer temperatures published since" AND "since 2020"
```

The student is asked to repair a large technical form before receiving a useful search. Labels such as `Source-mode contract`, `Plan`, configuration hashes, and `Discipline: auto` add explanation that belongs mainly in staff diagnostics.

**Change:** separate topic concepts from assignment requirements, preserve named entities and rich phrases, and show a compact summary by default: “Urban tree canopy + summer temperature · articles · 2020 onward.” Expand editing when requested or when uncertainty requires clarification. The corrected search should preserve concepts such as tree canopy/urban trees and temperature/urban heat; publication dates should be filters, not quoted topic words.

### 3. Inspect source leads — useful leads mixed with constraint violations

![Step 3: Sources outside the requested publication range](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/audits/2026-09-07/03-results.png>)

The current response included apparently pertinent titles from 2022 and 2023, demonstrating the value of live metadata discovery. It also included a 2017 neighborhood-stability paper and a 2009 turfgrass paper despite the explicit request for sources since 2020. Crossref fallback was disclosed, which is good; disclosure does not enforce the student's requirements.

The response is long and repetitive: interpretation, orientation, notices, database recommendations, recovery links, source cards, more queries, evaluation guidance, and follow-ups. The fixed composer occupies the lower viewport while the student reads and edits.

**Change:** enforce constraints before display; identify unknown dates and unknown peer-review status explicitly. Show one recommended search and a small first set of qualified leads. For each lead, show why it matches, which requirements are verified or unknown, provider, year/type, and the next access action. Keep alternate routes and detailed diagnostics expandable. Label source failures separately from real zero-match results.

### 4. Save and manage a source — useful, keyboard navigation broken

![Step 4: Saved research trail](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/audits/2026-09-07/04-workspace.png>)

Saving the 2023 urban-temperature article worked: the count increased to one and the item appeared with status, notes, and citation fields. This is a valuable part of the product. However, a Crossref lead is presented in the workspace under the broad label `CATALOG`, losing the clear provider distinction visible earlier.

Keyboard reproduction: open the drawer, press Tab from Close to Brief, press Right Arrow, then Tab. Right Arrow did not change or focus the next tab; Tab skipped the other tabs and moved to “Use in AI requests.” Inactive tabs have `tabIndex=-1` without arrow-key handlers. This prevents the standard keyboard path to Trail, Searches, and Review. The expected behavior is described by the [W3C tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

**Change:** implement the complete tab keyboard pattern, preserve provider/access provenance in saved items, and promote the workspace to an obvious “My sources” destination. Bring assignment requirements into the initial flow and show progress against them with confirmed/unknown distinctions. Provide recovery and export/import for browser-local work before treating it as a durable project system.

### 5. Inspect the phone-sized workspace — visually healthy in the tested state

![Step 5: Phone-sized saved-source workspace](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/audits/2026-09-07/05-mobile-workspace.png>)

The drawer and its visible form controls fit the inspected 390 × 844 viewport. The saved title wraps and the close action remains visible. This is limited evidence for this state; it does not establish accessibility compliance or completion of the entire mobile journey. The same keyboard defect still applies.

## Confirmed engineering priorities

| Priority | Finding and evidence | Recommended change |
| --- | --- | --- |
| First | Concept extraction discards unknown residual concepts once two controlled-vocabulary terms match. It also drops a richer phrase when it contains a shorter canonical term. [researchSpec.js:312](</Users/aidanoliss/Desktop/ZSR AI Assistant/config/researchSpec.js:312>) | Preserve the student's full conceptual intent. Validate against the original request as well as the normalized specification; do not let a corrupted specification certify itself. |
| First | Dates become quoted keywords, while provider calls receive no structured publication constraints. Crossref filtering checks tokens rather than publication bounds. [queryCompiler.js:62](</Users/aidanoliss/Desktop/ZSR AI Assistant/config/queryCompiler.js:62>), [sourceDiscovery.js:21](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/sourceDiscovery.js:21>), [primo.js:696](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/primo.js:696>) | Represent publication bounds separately from historical subject periods, compile supported provider filters, and enforce constraints on returned records. |
| First | Ordinary follow-ups reset the active topic. After medieval Italian trade networks, “Find peer reviewed articles” yields `peer AND reviewed AND articles`, and “Which databases should I use?” yields `databases AND should AND use`. [conversationContext.js:37](</Users/aidanoliss/Desktop/ZSR AI Assistant/src/conversationContext.js:37>), [chatRequest.js:54](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/chatRequest.js:54>) | Persist the active ResearchSpec and apply explicit intent changes. Cover ordinary paraphrases and corrections in multi-turn regressions. |
| First | Answer-first/guided-plan provider-error fallbacks contain hardcoded psychology/social-media advice. A medieval-trade request can receive psychology/communication/health recommendations, or “Here's what I found” with zero live results. Reproduced with Gemini disabled. [native.js:349](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/native.js:349>), [selection:602](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/native.js:602>) | Use actual plan context and transparent degraded status in every response style; remove sample-topic fallback prose. |
| Next | OpenAlex receives no source mode and can return journal articles for books mode; mocked HTTP 429 is presented as no strong matches. [sourceDiscovery.js:35](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/sourceDiscovery.js:35>), [openalex.js:297](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/openalex.js:297>), [openalex.js:464](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/openalex.js:464>) | Enforce the same source-kind contract across providers and return distinct disabled, empty, success, rate-limit, and timeout outcomes. |
| Next | Crossref accepts two matching tokens even when a central concept is absent; a mocked manufacturing/AI record passes a cognitive-offloading query. [primo.js:715](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/primo.js:715>) | Apply shared concept-group relevance rules, identify deliberate relaxation, and score relevance on unseen topics. |
| Next | Workspace tabs are not keyboard-operable through the expected tab pattern. [ResearchWorkspace.jsx:151](</Users/aidanoliss/Desktop/ZSR AI Assistant/src/ResearchWorkspace.jsx:151>) | Add arrow-key focus/activation and browser interaction coverage; verify with assistive technology. |
| Later | Share copies the current application URL, not the locally stored research plan. [App.jsx:1187](</Users/aidanoliss/Desktop/ZSR AI Assistant/src/App.jsx:1187>) | Rename it “Share Navigator,” or provide an explicit plan export/share workflow whose scope is clear. |

These are separate from model choice. Several failures occur before a model call or in deterministic fallback/provider logic. Replacing Gemini with a stronger model alone would not repair them.

## What the tests prove—and what is still missing

Current checks passed: **202/202 tests**, **47/47 baseline evaluation cases with 893/893 checks**, **54/54 matrix cases**, and the production build. The resource audit reported zero technical errors. Detailed outputs are saved in [automated-checks.log](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/audits/2026-09-07/automated-checks.log>) and [release-evidence.md](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/audits/2026-09-07/release-evidence.md>).

Those numbers are regression evidence, not demonstrated research quality:

- Enabling the existing requirement that every recommended query retain expected concepts drops the baseline from **47/47 to 39/47**. This was an in-memory probe with no test/source changes. The eight failing cases are recorded in [concept-retention-probe.json](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/audits/2026-09-07/concept-retention-probe.json>).
- Current evaluation can find topic anchors across concatenated searches, allowing an intact fallback to compensate for a broken primary query. The optional per-query check can report a pass while describing missing concepts. [pilotEvaluation.js:229](</Users/aidanoliss/Desktop/ZSR AI Assistant/lib/pilotEvaluation.js:229>), [pilotEvaluation.js:401](</Users/aidanoliss/Desktop/ZSR AI Assistant/lib/pilotEvaluation.js:401>).
- The 54 matrix cases represent three base topics, three paraphrases, and six modes, with the intended discipline supplied explicitly. This is narrow evidence for natural-language generalization and does not test auto-detection as students normally encounter it.
- All **31 resource entries remain pending librarian review with unassigned maintenance owners**. All 47 human case reviews remain pending; the student scorecard contains only its header. This establishes missing evidence in the repository, not proof that no informal feedback ever occurred elsewhere.
- Human approval is not bound to the reviewed output/configuration hash. In a synthetic reproduction, approval survives a changed query. Bind review records to the exact input, plan, config, reviewer, and date before real review begins. [pilotEvaluation.js:142](</Users/aidanoliss/Desktop/ZSR AI Assistant/lib/pilotEvaluation.js:142>).
- Several UI/accessibility tests assert source text rather than operating controls. Add a small real-browser suite for topic entry, correction, source saving, keyboard access, provider failure, and reload/persistence. Screen-reader, contrast, and complete mobile-flow reviews remain outstanding.

## Product direction and missing capabilities

**Make the research workspace the organizing experience.** The natural progression is assignment → research question → search → source inspection → saved evidence → next action. Chat can support each step. Folders and response-style choices should not dominate the student's first decision.

**Make source selection explainable.** Useful additions would include a short metadata-supported fit explanation, visible requirement checks, comparison of a few saved leads, and assignment-progress indicators. The product already saves sources; it needs to help students decide which saved sources are usable. Do not infer verified peer review from Crossref's journal-article type.

**Decide the promise of “Answer + sources.”** Currently generated orientation never receives the retrieved records; model text and live source leads are separate outputs. This is documented honestly, but their proximity can imply support. Keep orientation clearly labelled. If source-grounded explanations are introduced, tie each claim to retrieved content the system actually inspected, distinguish metadata/abstract/full-text support, and retain explicit unknowns. [native.js:560](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/native.js:560>), [architecture summary](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/architecture-summary.md>).

**Prioritize institution-owned data over more providers.** The significant missing integrations are a reviewed ZSR resource feed, approved WFU Primo configuration, dependable access resolution, and an accountable maintenance owner. The institutional adapter is already implemented; approved configuration and real WFU validation are still absent according to the current repository. A librarian handoff should fit the research-help channels ZSR already offers, including subject librarians and research appointments. [ZSR Research & Instruction](https://zsr.wfu.edu/research/).

**Protect work continuity.** Local storage is a sensible prototype choice, but there is no portable project import or synchronized project identity. Storage writes are unguarded, and only 60 sessions are serialized. Add clear save feedback, storage failure recovery, export/import, and deletion/retention controls before considering accounts. [App.jsx:740](</Users/aidanoliss/Desktop/ZSR AI Assistant/src/App.jsx:740>).

**Consolidate the implementation after correctness fixes.** The canonical and Express servers duplicate orchestration. App.jsx is about 1,448 lines, AssistantMessage.jsx 2,014, researchAgent.js 2,364, and styles.css 5,221. Split shared request orchestration, provider contracts, session persistence, and source presentation into bounded modules; archive unrelated legacy surfaces through a reviewed cleanup. Do this incrementally around behavioral coverage.

## Recommended sequence

1. **Correctness release:** fix concept loss, topic continuity, date/type enforcement, and misleading degraded responses. Acceptance: the exact urban-tree request retains its subject, excludes pre-2020 records or explicitly separates exceptions, and ordinary follow-ups preserve context.
2. **Student-flow release:** simplify entry, collapse technical diagnostics, give one clear recommended search, promote saved sources and requirements, repair keyboard navigation, and clarify sharing/persistence.
3. **Evidence release:** make critical per-query checks mandatory; introduce librarian-authored unseen topics and multi-turn tasks; bind human reviews to exact outputs; execute the existing formative student-pilot process with its documented review requirements. Measure time to an appropriate database and useful source, completion without rescue, recovery, and incorrect access/source claims.
4. **Operational release:** add CI gates, staging checks, useful latency/error/degraded-output metrics without storing unnecessary query text, service ownership, rollback, and campus-realistic quotas. The current per-IP default of 30 requests per ten minutes warrants shared-network testing. Readiness currently exposes Gemini circuit state but does not include it in the `ready` decision. [ratelimit.js:17](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/ratelimit.js:17>), [native.js:650](</Users/aidanoliss/Desktop/ZSR AI Assistant/server/native.js:650>).

Defer multi-institution expansion, additional provider integrations, and full-text summarization until the core search journey meets the agreed quality bar. Institutional configuration work can proceed in parallel with correctness and usability work.

## Evidence limits

The fresh live browser journey covered one synthetic assignment request, interpretation, returned leads, source saving, workspace keyboard navigation, and one phone-sized workspace state. Deterministic and mocked-provider probes broadened coverage but do not establish external-provider availability or live relevance rates. Full-text access, licensed databases, deployed Render behavior, every research mode, student learning outcomes, and full accessibility compliance were not verified. No librarian message was sent, and no deployment or application-code change was made.
