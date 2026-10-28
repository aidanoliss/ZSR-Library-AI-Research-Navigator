# Librarian retrieval audit — October 18, 2026

**Decision:** useful as a librarian-supervised discovery prototype; not ready to promise reliable fulfillment of detailed student requests. Source existence is stronger than full-request relevance. Several observed failures originate in interpretation, so improving rank weights alone will not fix them.

This is an AI evaluator adopting a ZSR reference/instruction perspective, not an actual ZSR librarian's endorsement. No human accuracy estimate is claimed.

## Reproducible method and scope

- Release inspected: `b027a5272307ae484b6c7cc64c9404aa2c8b3929`. Live health returned HTTP 200, `ok:true`, release `b027a5272307`, version 1.1.0.
- Capture UTC: 2026-10-18T21:17:30.994Z through 21:18:04.524Z, including health check.
- Twelve fresh sequential requests: eleven genuine research requests plus one deliberately invented known-item control. Each search had a 25-second hard audit deadline. No load test, AI generation, model API call, credential loading, or deployed-code changes.
- Executed the release's deterministic `buildResearchPlan → liveSearchQueries → searchSourceCandidatesForScope` path locally against **live public bibliographic providers**. Access scope `library`, limit 10, first five assessed.
- Default Wake public Primo host `https://wfu.primo.exlibrisgroup.com`, view `01WAKE_INST:ZSR`, with Crossref fallback. Institutional Primo API profile was off/unconfigured in this clean shell. No `.env` loaded, no licensed full text retrieved, OpenAlex lane not requested. This is **not** equivalent to a complete Render UI/model response or authenticated campus session. Render-specific secrets/adapters were not inspected.
- All 26 visible records (up tofive per response) were reviewed against their complete request using titles and supplied abstracts/descriptions. Ratings are model judgments; full-text methodology was not independently read. Eleven purposively selected DOI records were then freshly fetched from official Crossref, including four that the in-app short check left unverified. Two book identities were corroborated on publisher sites.

Re-run: `node run-audit.mjs /path/to/release`, then `node verify-identities.mjs`, then `node assess-capture.mjs`. The last script preserves explicit evaluator judgments; a changed capture must be re-read/regraded, not blindly assigned old judgments. Raw source metadata lives in `capture.json`; separate registry observations in `registry-verification.json`; row-level judgments in `model-review.json`.

## Observed totals — not an accuracy claim

| Measure | Result | Interpretation |
|---|---:|---|
| Genuine requests with at least one record |8/11|Retrieval availability, not relevance success|
| Genuine requests with at least five records |3/11|The interface's five slots were usually not filled|
| Genuine requests with a metadata-supported complete-request candidate among visible records |4/11|Small purposive sample, model judgment; not human accuracy|
| Retrieved records |32|Includes later records and versions|
| Visible records assessed |26|First five of each response|
| Candidate matches |6/26|Still require source reading; includes two editions of one book|
| Partial/background matches |12/26|Useful only for part of the request|
| Explicitly wrong requested constraint |6/26|Different design, historical period, or known item|
| Uncertain from available metadata |2/26|Not counted as success|
| Observed provider errors/timeouts |0|Does not test cold starts, outage recovery, or retry robustness|
| Search latency range |148–3,053ms|Local live-provider path; excludes health and optional AI generation|
| Deliberately invented book |0 records|Appropriate non-fabrication in this one control; does not prove universal safety|
| Separate DOI/title corroboration |11/11 exact normalized title matches|Purposive subset; validates identity only, not source quality/findings|

## Query-level findings

| Request (full text in capture) | Records | First five candidate/partial/wrong/uncertain | Librarian assessment |
|---|---:|---|---|
|Sanctions: authoritarian regimes vs democracies|10|2/3/0/0|Good first two comparative starting points; remaining visible papers examine authoritarian outcomes or sender targeting, not the requested contrast.|
|US undergraduates; CBT vs mindfulness; randomized trials|1|0/0/1/0|Returns a meta-analysis with multinational, mixed student populations. More seriously, comparison parsed as **“comparing” vs “cognitive behavioral therapy.”**|
|Published since 2020, British women workers during WWII 1939–45|6|0/3/2/0|Publication floor retained, but topic loses “II”; WWI records rank 2/3. Wartime-relevant material is book chapters, despite request for articles.|
|Scholarly books: memory/identity in contemporary African American literature|1|1/0/0/0|Plausible university-press collection; only one lead. Coverage far too narrow to imply comprehensiveness.|
|Governing the Commons, Elinor Ostrom|3|2/0/1/0|Two correct manifestations (1990/2015) plus a different book labeled related. Group editions instead of consuming two source slots.|
|Systematic reviews: nurse-led vs usual care, older adults, HF readmission|2|0/2/0/0|One addresses readmissions but adults overall; other focuses self-care, with mixed ages. No complete-request candidate established.|
|Primary datasets: Forsyth housing/eviction 2015–24|0|—|Mode remains **Scholarly articles** even though user requests datasets. Recover to data-specific providers/consultation.|
|Primary letters/diaries, enslaved people, NC before 1865|0|—|Primary mode recognized but parser turns alternative source forms into `letters AND diaries` and an overlong exact identity phrase. Discovery cannot establish historical scarcity.|
|Empirical AI-writing vs peer-feedback, first-year college students|0|—|Comparison becomes **“comparing” vs “AI”**; first-year narrows only to college students. This is an interpretation defect before retrieval.|
|Systematic reviews: offshore wind/marine biodiversity|5|1/1/2/1|Firstsource describes a systematic review; ranks 3/4 are original monitoring/metagenomic studies. Adjacent evidence should be separate.|
|Qualitative interviews: climate migration, women, Bangladesh|4|0/3/0/1|Population not extracted as a facet. A record mentions women in Burkina Faso while Bangladesh appears elsewhere; bag-of-concepts can misground fit.|
|Invented Quantum Librarians book, Amelia Quasar 2024|0|—|Correct no results; author parser incorrectly includes “published in 2024” and calls2024 a study period.|

## Prioritized defects and missing components

### P1 — interpret the question correctly before searching

**Observed:** Instruction word “comparing” becomes a required subject and one comparison arm in two queries. WWII becomes “World War”; “first-year” is lost; explicit datasets request remains scholarly mode. Known-item publication text is included in author identity.

**Repair:** Separate instruction grammar, bibliographic identity, content concepts, comparator arms, population, place, historical period, publication dates and study design into a validated interpretation. Show only uncertain fields for correction. Preserve Roman numerals and meaningful demographic qualifiers. Add exact regression fixtures for these captured requests, including harmless paraphrases.

**Acceptance:** “CBT compared with mindfulness” and “studies comparing CBT with mindfulness” generate the same two arms; WWII does not admit WWI as a match; datasets route to data resources; known-item publication year is not author or study period.

### P1 — distinguish explicit contradiction from missing evidence

A meta-analysis is offered for randomized trials; original field studies appear for systematic reviews; WWI papers appear for 1939–45. Most are labeled partial or “needs checking,” which is safer than claiming a match but burdens students with detecting obvious contradictions.

**Repair:** Three states per requirement: supported / contradicted / insufficient evidence. Keep explicitly contradictory records out of the main qualified set. If no record satisfies the full request, say so above the results and present an optional separately labeled “Related/background sources” section. Never silently relax scope to make five cards.

**Acceptance:** Main qualified list has no K–12 for explicit undergraduate requests, no WWI for WWII, no original experiment for systematic-review-only requests. Partial matches remain accessible, with the specific relaxed requirement shown.

### P1 — constrain relationship evidence to the same study and population

Bangladesh rank 4 mentions women in a Burkina Faso case study; the app lists all requested topic concepts as found. These words genuinely occur, but their relationship is not established. This is **misgrounding**, not an invented citation.

**Repair:** Relate geography, population, intervention, comparison, outcome and method to a study-level evidence span. Multi-country and review records need structured coverage; a background citation or a different country's subgroup cannot satisfy the requested population/geography pair.

### P2 — improve method/geography evidence extraction without overclaiming

Nursing rank 2 literally includes “a systematic review and meta-analysis” in its title yet method is unverified. Bangladesh rank 1 explicitly reports qualitative design and key-informant interviews but method is unverified. “from coastal Bangladesh” in rank 2 title fails geography support. These are false negatives that lower useful records and make warnings less credible.

**Repair:** Support common study-design formulations and local place modifiers; distinguish an article's own method from methods in cited studies. Test exact positive evidence alongside negation and literature-background counterexamples.

### P2 — group work/edition/version duplicates

Historical ranks 4/5 are the same chapter title and nearly identical abstract under two DOIs/years. Ostrom ranks 1/2 are two manifestations of the same book. Different IDs are not always different intellectual sources.

**Repair:** Group likely manifestations under one work with edition/version choices; preserve separate citations and IDs, do not destructively merge uncertain matches. Count distinct works, not versions, toward source targets.

### P2 — give data/archives their own route and successful next action

“No records” is technically honest but a librarian would move this student to a dataset portal, relevant archival finding aid/digital collection, or appropriate librarian. Generated Boolean that repeats every word is not sufficient recovery.

**Repair:** Curated institution-specific data/archive routes; source-form OR within alternatives; location hierarchy (county/state) without double-requiring both strings; human handoff with query and attempted resources. Do not infer that a source does not exist from a catalog's empty response.

### P2 — date provenance and identity checks need explanation

Offshore-wind rank 1 shows November 2026 on an October 18 audit. Separate Crossref fetch confirms that same future print/issue date and title, so this is **not evidence of hallucination**. Present online/print dates when available and label forthcoming/issue-date metadata. The short in-app identity check left several valid titles unverified; separate fresh requests confirmed them. “Unverified” is correct but should have a retry action and must not be interpreted as false.

## Source existence versus relevance versus grounding

- **Existence:** All 11 targeted DOI checks returned registered matching titles. Publisher pages corroborated [Governing the Commons](https://www.cambridge.org/core/books/governing-the-commons/A8BB63BC4A1433A50A3FB92EDBBB97D5) and [Post-Soul Satire](https://www.upress.state.ms.us/Books/P/Post-Soul-Satire). This does not establish access, holdings, all authors, corrections/retractions, or peer review.
- **Relevance:** The complete-request failures above remain even when DOI/title is correct. “Real source” is not “right source.”
- **Grounding:** No generated claim summaries were tested in this subaudit. Provider abstracts are evidence about what a provider reports, not proof of correctness; no zero-hallucination claim follows. A separate claim-to-excerpt check and human source reading remain required.
- **Access:** Library links were retained, but authenticated full-text delivery, subscription entitlement, interlibrary loan and off-campus proxy paths were not validated here.

## What would make this ready for a student pilot

Fix the P1 interpretation/contradiction issues first. Then ask two ZSR reviewers to independently grade a frozen set of authentic assignment questions, adjudicate disagreements, and score full-request fit separately from identity, access success, useful partial evidence and unsupported summary claims. Include humanities, quantitative data and archival tasks, not just article searches. Observe students explaining *why* a source fits, not merely whether they can save it. A prototype can teach inquiry only if its uncertainty and alternatives are actionable.
