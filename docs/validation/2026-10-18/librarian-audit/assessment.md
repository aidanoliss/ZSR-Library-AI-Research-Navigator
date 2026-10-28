# ZSR Navigator: librarian-perspective audit

**October 18, 2026 · Release b027a52 · Read-only review; no application code changed.**

## Verdict

**Ready for candid librarian feedback and supervised usability diagnosis; not ready for unsupervised student reliance or a reliable/comprehensive-search claim.** The interface is more usable than the retrieval logic is dependable. The central risk is often a real source that does not answer the student's question—not a nonexistent citation. A polished card can lend that partial source more authority than its evidence deserves.

This is an AI-assisted evaluation through the lens of a reference/instruction librarian, **not a review or endorsement by a ZSR employee**. Informal collaboration described by Aidan is distinct from institutional approval. The recommendation below is judgment based on the observed failures, not a procurement or security certification.

ZSR's published [information-literacy outcomes](https://zsr.wfu.edu/research/instruction/) emphasize inquiry, strategic finding, evaluation, application, attribution and reflection. Its [AI-use guidance](https://zsr.wfu.edu/about/administration/ai-engagement-framework/guide-to-using-ai/) emphasizes verifiability, privacy, learning and user agency. I used those as the teaching lens; they do not themselves establish approval of this product.

## What was actually tested

| Track | Method | Result and boundary |
| --- | --- | --- |
| Live release | Health/release check and one fresh complete production-browser research request | Live b027a52. Request for U.S. undergraduate systematic reviews, published since 2020, comparing online and in-person teaching. Five records returned; first was explicitly K–12, two more explicitly secondary-school studies. Wrong populations were not excluded. |
| Broad retrieval | Twelve fresh sequential searches through this release's deterministic discovery pipeline against live public Primo/Crossref, Wake defaults | Eleven genuine requests and one invented-book control. No credentials/model generation used. **8/11** genuine requests returned records; **3/11** returned at least five. The local provider path is not a full production UI or authenticated campus test. |
| Relevance review | Model read titles/available abstracts for all 26 initially visible records across that capture | **4/11** genuine requests had at least one metadata-supported complete-request candidate. Of 26 records: 6 candidates, 12 partial/background, 6 contradicted a requested constraint, 2 uncertain. These are **model judgments in a small purposive sample, not human-validated accuracy**; two candidate records are editions of one book. |
| Identity | Separate official Crossref lookup for 11 selected DOIs | **11/11 normalized titles matched.** A real DOI does not establish relevance, study quality, access, peer review or support for a claim. The invented book returned zero records. |
| Evidence and integrity | Fresh deterministic probes plus focused evidence/workspace/RIS/security/log/storage suites | **60/60 tests passed.** Invented claims/quotes rejected; negative-result wording retained. Separate probes exposed save/export provenance loss and irreproducible history. A green test suite does not mean the current product behavior meets librarians' needs. |
| UI functionality | Live Save, status change, notes, filtering, RIS download; keyboard tab navigation; isolated synthetic timeout/empty states | Operations worked. Timeout and genuine empty-result messages differed; Retry recovered to three synthetic records with the same topic. This proves the UI recovery path, not provider availability during a real outage. |
| Accessibility | Screenshot/DOM inspection, keyboard arrow navigation, computed button colors, 390px synthetic empty-state reflow | Tab navigation worked; 390px page width equaled viewport width. Gold button contrast failed the normal-text threshold. No screen-reader, 200%/400% zoom, or complete WCAG audit performed. |

**Timing caveat:** public-provider capture took 148–3,053 ms per search locally, excluding optional AI generation and Render startup. A browser download tool call took approximately 23 minutes before returning even though the download succeeded; the cause was not established. It is not valid evidence of app response time. No production latency percentile or cold-start reliability claim is made.

Raw requests, plans, results, row-by-row judgments and rerunnable scripts: [retrieval findings](retrieval/findings.md), [capture](retrieval/capture.json), [ratings](retrieval/model-review.json), [registry checks](retrieval/registry-verification.json). Safety and data-round-trip probes: [integrity review](integrity-review.md), [probe evidence](integrity-review-evidence.json).

## Five-step student walkthrough

### 1. Start a question — healthy, with scope and identity caveats

The fresh-start screen gives a clear three-step path and allows a student to begin without setup. It labels the service a research prototype and discloses AI processing/local storage near entry. The large ZSR branding can still imply official status more strongly than the small prototype label counters; whether an institutional disclaimer or approved branding is appropriate needs a ZSR decision.

Defaulting to articles is reasonable for many assignments but fails a data/archives student if intent recognition does not switch it. A compact “Looking for articles, books, data, or primary sources?” choice could help when the request is ambiguous, rather than imposing a large setup form.

![Step 1: fresh research entry](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/validation/2026-10-18/librarian-audit/01-start.png>)

### 2. Inspect the results — material relevance failure

Fresh request: **“Peer-reviewed systematic reviews published since 2020 comparing online and in-person teaching for undergraduate students in the United States.”**

The top record was *Online Teaching in K-12 Education in the United States: A Systematic Review*, DOI `10.3102/00346543221105550`. Its provider abstract explicitly describes K–12 students. Third and fourth records concerned secondary students and different educational topics. The first card was honestly labeled partial/background, but its population requirement was only “needs checking.” This is a stronger conflict than missing population metadata. The header offered five leads without leading with “No complete matches confirmed.”

The generated Boolean also contained `"comparing online"` as one comparison arm. The instruction word became required subject matter. This agrees with separately captured comparison-parser defects.

The UI usefully distinguishes provider abstracts and inferred source roles, exposes metadata, and gives a verification reminder. Those strengths cannot compensate for a misunderstood question or wrong population.

![Step 2: K–12 result for an undergraduate request](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/validation/2026-10-18/librarian-audit/02-live-partial-results.png>)

### 3. Save and evaluate — usable, but warning continuity is weak

Saved the first record, marked it **Not relevant**, and entered an audit note explaining the population mismatch. Filtering and note editing worked. RIS download included the title, four authors, journal, DOI and Crossref provider note. The card is readable and the student can record an actual judgment.

However, the saved list no longer displays the original fit/requirement caveats; the user must seek further detail. Worse, an executable probe confirmed that DOI identity warnings and registry titles are **removed from the saved data itself**, so a known citation discrepancy disappears from backup/export too. This is a significant discovery-to-citation trust defect.

The downloaded citation is a metadata export, not an assurance that its publication-date variant or formatting is correct. The test file is in the user's Downloads folder as `saved-sources.ris`; it was inspected, not sent anywhere.

![Step 3: saved source and student evaluation note](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/validation/2026-10-18/librarian-audit/03-saved-source.png>)

### 4. Recover from failure — good controlled behavior

An isolated synthetic provider timeout produced “Source search couldn’t finish,” distinguished it from absence of relevant literature, and offered Retry, query changes, requirement review, ZSR, Scholar and librarian routes. Retry actually returned three synthetic records and retained the topic. No outage was induced on the public service.

The general recovery path is useful. For datasets and primary sources, the next step should be a specific dataset portal/finding aid or the appropriate librarian, not just another article-oriented query. Do not infer literature scarcity from an empty metadata search.

![Step 4: synthetic timeout recovery](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/validation/2026-10-18/librarian-audit/04-timeout-recovery.png>)

### 5. Use the interface accessibly — partial pass, confirmed contrast defect

A separate synthetic empty result showed “No matching sources yet,” rather than a timeout message. At 390px it wrapped without horizontal overflow (`clientWidth = scrollWidth = 390`). Desktop results tabs responded to ArrowRight with focus/selection moving to Search strategy.

The live “Open source” control uses white text on `rgb(158,126,56)` at 12.48px, weight 600. Computed contrast is **3.82:1**, below the **4.5:1** normal-text minimum in [WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Keep gold as an accent, but darken the button or change its text color. This is one measured failure, not a claim that all accessibility was tested.

![Step 5: synthetic empty results at 390px](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/validation/2026-10-18/librarian-audit/05-mobile.png>)

## Repair priorities and acceptance criteria

| Priority | Problem | What should change | How to prove it |
| --- | --- | --- | --- |
| **P1** | Request interpretation corrupts meaning | Strip instruction grammar without deleting subject qualifiers; preserve WWII, first-year, comparator arms, source form, historical vs publication dates. | Paraphrase fixtures produce equivalent intended concepts; “comparing CBT with mindfulness” has CBT/mindfulness arms, never “comparing”; WWII does not become generic World War. |
| **P1** | Contradictions share the main result list | Separate supported, contradicted and unknown requirements. Keep clearly wrong population/design/period outside the qualified set. Offer related sources separately with the exact limitation. | No K–12 as an undergraduate match, no WWI as WWII, no meta-analysis as an original randomized trial. No full matches produces an explicit headline. |
| **P1** | Words co-occur but do not describe the same study | Link population/place/method/comparison evidence to the same study or relevant review subgroup. | A Bangladesh mention plus a women-in-Burkina-Faso example cannot prove women-in-Bangladesh fit. Add positive and negative evidence-span fixtures. |
| **P1** | Known identity warnings vanish on save/export | Preserve typed, bounded identity checks, registry titles and timestamps; display discrepancies on saved cards and in exports. | Save → edit → undo → backup/import → RIS/Markdown retains the warning without representing stale/imported checks as current verification. |
| **P2** | Data and archive tasks fall back badly | Fix source-mode inference and resource-specific routing; preserve OR between alternative source forms. | Explicit datasets request enters data mode; letters OR diaries is not compiled as mandatory letters AND diaries; empty results offer appropriate portals/liaisons. |
| **P2** | Search log cannot reproduce a run | Separate opened resources from submitted searches; retain original prompt, resolved queries, provider, scope/filters, timestamp, result count and config version per run. | Two same-text searches with different dates/populations remain separately reconstructable. Export does not attach an old note to a new run. |
| **P2** | Editions/manifestations take multiple result slots | Group likely versions under a work, retaining selectable edition-specific citations. | Duplicate chapter manifestations and Ostrom editions do not inflate distinct-source targets; uncertain identities are not destructively merged. |
| **P2** | Exported claims about provenance are outdated | Replace “Live ZSR discovery leads” on mixed-provider exports and remove the false “does not search live databases” footer. | Primo/Crossref/OpenAlex exports retain honest provider and metadata/full-text distinctions. |
| **P2** | Accessible use and privacy on shared devices | Repair contrast; offer an ephemeral/private session and clear local-data controls; keep provider/server/browser retention explanations distinct. | Measured control contrast meets threshold; private session writes no research to local storage. SSO alone is not treated as a local-data fix. |
| **Before institutional rollout** | Approval/maintenance/access assumptions remain unresolved | Named ZSR owner for mappings, versioned review and renewal, privacy/licensing review, support responsibility and real authenticated access testing. | Reviewers actually approve scoped configuration and test access routes; do not simply flip approval flags. Informal collaboration is not discounted, but not upgraded to official adoption. |

## Missing capabilities a librarian would care about

- **An honest coverage statement for this search:** what was queried, which lanes were unavailable, and what was not searched. “Library sources” includes bibliographic records, not guaranteed WFU holdings/full text. Confirm access with authenticated campus/off-campus tests before promising it.
- **Durable claim-to-evidence notes:** reading guidance already exists; extend it to preserve a student's claim, quotation/page, source/version and limitations in an exportable evidence table. Keep synthesis distinguishable from source statements. This should aid reading, not write the student's conclusion.
- **A reproducible capstone/review mode:** query logs, scope changes, exclusion reasons and work-level deduplication. The present app can be a starting point, not a systematic-review search service.
- **Consistent correction/retraction handling:** OpenAlex already excludes flagged retractions, so this is not wholly absent. Review how other provider lanes surface updates and corrections, and avoid interpreting a resolving DOI as current validity.
- **Measured learning outcomes:** observe whether a student can identify source type, explain fit, locate the supporting passage, recognize a limitation and continue in a second tool. Saving five sources is not an adequate outcome measure.

## What is working and should be retained

The editable question, transparent Boolean strings, separate database routes, five-card initial list, saved notes/status and source-reading prompts are useful learning supports. Error messages now differentiate provider failure from no matches. The validator's exact-passage guard rejects fabricated quotations and generated causal claims in the controlled tests. These protections substantially reduce one class of hallucination, while leaving source relevance, selection bias and scope misgrounding unresolved.

## Next evaluation gate

Repair the four P1 items, then freeze a diverse set of authentic assignments and have **two ZSR reviewers independently judge it**, resolving disagreements. Measure identity, complete-request fit, useful partial evidence, access success and unsupported claims separately. Include humanities, data, archives, known-item books, contradictory constraints and genuine no-result cases. Report disagreements and uncertainty rather than converting every returned record into a success.

Continue student sessions as supervised diagnostic research if desired: ask students to think aloud and verify sources before using them in coursework. Broad external outreach should request critique or a scoped design partnership, not sell validated accuracy. Eight concise drafts and public contact sources are in [the outreach register](</Users/aidanoliss/Desktop/ZSR AI Assistant/docs/outreach/2026-10-18-verified-contacts-and-drafts.md>).

## Explicit limitations

No independent human grading, full-text critical appraisal, authenticated WFU delivery test, production cold-start/load test, screen-reader certification, deployment secret review, or institutional licensing/legal approval occurred. The current run does not establish a hallucination rate, recall, model-answer accuracy, or universal library compatibility. One complete live UI request is documented separately from the twelve public-provider pipeline requests. Screenshots were freshly captured in this audit; synthetic failure screens are labeled as such.
