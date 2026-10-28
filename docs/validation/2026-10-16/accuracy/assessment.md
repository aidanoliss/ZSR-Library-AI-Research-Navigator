# Navigator quality test and outreach decision — October 16, 2026

**Decision: keep iterating on retrieval reliability and relevance, start a small librarian discovery effort, and postpone broad institutional deployment or accuracy claims.** The current version is suitable for a clearly labeled prototype review and supervised usability research. It has not established an independently validated accuracy rate.

## What was tested

The public Render deployment, release `4b8a0b7b8b11`, received 24 sequential synthetic questions: 18 existing developer benchmark questions, five newly written substantive questions, and one deliberately invented title/author. All topics and the relevance-review sample were fixed in `manifest.json` before requests. These are not independently supplied student questions and are not a representative random sample of university research.

The test captured the first source event from the same public streaming API used by the application, then cancelled optional AI guidance. Each request had a 45-second limit. This tests production source delivery, metadata and candidate relevance, **not final generated guidance or claim accuracy**. It does not establish full-text access, scientific validity, licensing permissions, comprehensive recall, or cross-institution performance.

## Results

| Measure | Result | Interpretation |
|---|---:|---|
| Real questions returning at least one source on first attempt | 16/23 (69.6%) | Availability, not accuracy. The negative control is excluded. |
| Real questions returning at least five sources | 14/23 (60.9%) | Enough records to fill the first five slots; not proof they are suitable. |
| Real questions delivering a source-stage response | 22/23 | Includes honest empty responses. One request exceeded 45 seconds. |
| Top-five records returned | 74 | Across all real queries; missing slots remain missing. |
| Detected within-query top-five duplicates | 0/74 | Normalized DOI/title check; not a definitive edition/version audit. |
| Median source-stage time among completed real requests | 2.52 seconds | Excludes the 45-second failure and optional generation; not an SLA. |
| Delivery failures recovering on a separate retry | 3/3 | Therapy comparison, background books and exact-title book. Do not replace the initial outcomes with retries. |
| Supplied DOI strings resolving in Crossref | 70/71 after one rate-limit retry | Three of the 74 records had no DOI and are excluded. Resolution alone does not validate all metadata. |
| Exact normalized title matches in DOI registry | 66/71 after retry | Four further records had title/subtitle variants, with selected publisher corroboration; one had a substantive title discrepancy and malformed DOI. |
| Invented-title negative control | No result; explicitly not found | One successful rejection, not a zero-hallucination guarantee. |
| Independent librarian relevance / generated-claim accuracy | Not measured | No human ratings or final-generation scores have been invented. |

There were seven real first-pass failures to provide sources: the therapy comparison exceeded the test deadline; the two book lookups reported provider timeouts; local night-shift transit, urban canopy/low-income neighborhoods, and rural broadband/business growth returned empty results; the Open Access-only query had its provider disabled. All three timed-out searches recovered in a separately preserved retry. The exact-title book retry included matching Ostrom records.

The first pass and retries are in `live-capture.json` and `retry-capture.json`; provider configuration and per-attempt outcomes are preserved. The earlier October 8 capture used a local provider path and a different set of 28 questions. Its 24/28 nonempty result must not be presented as a directly comparable production baseline or evidence of regression caused by the CSS changes.

## Relevance screen: provisional AI assessment

The preselected sample contained 11 real questions plus the negative control. Seven real questions returned records on the initial pass. All 32 of their displayed top-five records were screened from captured titles and provider abstracts:

- **17 direct matches:** available metadata supports the full requested topic and constraints.
- **12 supporting/partial matches:** related evidence, but at least one constraint is absent or unconfirmed.
- **2 poor fits:** sender preferences in a target-regime-effects search; a primary tracking study in a systematic-review request.
- **1 uncertain:** insufficient descriptive metadata.

The 17/32 (53.1%) direct-match share is an **AI diagnostic on a small selected sample**, not validated precision, general accuracy or the proportion of scientifically correct papers. Supporting sources can be useful but do not automatically meet the assignment. Empty and failed queries contribute no returned records to this denominator; they are retained in the query-level results above. Human judgment columns remain blank in `human-review.csv`.

Examples: Bangladesh climate migration and wearable AF detection produced strong topic matches. The sanctions results mixed direct comparative studies with background and a sender-preference study. The systematic-review request returned an empirical study. AI/critical-thinking results were relevant leads, but many abstracts did not establish the requested undergraduate population; surveys and perceptions cannot establish causal effects.

## Concrete identity defect

An electoral-systems result supplied `10.4335/12.1.145-162(2014` (missing the closing parenthesis) and used “New Zealand General Elections” in its title. The [publisher record](https://lex-localis.org/index.php/LexLocalis/article/view/12.1.145-162%282014%29) supplies `10.4335/12.1.145-162(2014)` and “New Zealand Local Elections.” The corrected DOI resolves. This is a real publication with faulty displayed metadata, not evidence of an invented publication. The audit has not yet attributed the title discrepancy to upstream indexing versus application transformation.

The source card still has a library link, so the malformed DOI does not establish that its primary Open source action is broken. It does threaten DOI-based citations and identity checks. Preserve balanced punctuation, validate DOI resolution, and flag conflicting publisher metadata rather than silently trusting every provider field.

Selected title-variant corroboration: [sanctions paper on its author's institutional site](https://www.wcfia.harvard.edu/publications/not-all-dictators-are-equal-coupsfraudulent-elections-and-selective-targeting), [Vogel chapter on Cambridge](https://www.cambridge.org/core/books/economics-of-the-yasuni-initiative/tragedy-of-the-commons/1FD8D22FA509481F3393FC8DBB889886), and [AI/critical-thinking publisher record](https://ojed.org/jise/article/view/10565). These checks do not turn unreviewed full texts into verified claims.

## Next work, in priority order

1. **Stabilize delivery:** diagnose the 45-second stall, improve bounded retries for book-provider timeouts, and keep provider failures distinct from genuine empty responses. Obtain an approved institutional discovery integration. Verify cold-start behavior before unattended pilots.
2. **Correct metadata handling:** fix balanced-parenthesis DOI handling, add authoritative identity corroboration where available, and flag conflicting titles/years. Exact-item related works should remain explicitly separate.
3. **Improve full-request ranking:** enforce or clearly label method, population, geography and comparison fit. Do not inflate relevance with loosely related records. Revisit query interpretation and retrieval fallback for the two new empty topics.
4. **Enable missing coverage honestly:** configure approved OpenAlex access or make unavailable scopes unmistakable. Extra Boolean strings are manual search aids; they do not themselves improve backend retrieval accuracy.
5. **Freeze a review version:** ask librarians for 30–50 previously unseen questions and explicit criteria, then have them review the top five and every displayed claim. Run 8–12 supervised student sessions comparing Navigator with the library's existing path, counterbalancing order. Measure time to three librarian-approved sources, task completion, wrong source-type selection, and confidence calibration.

Suggested project gates—not established industry standards: at least 90% of ordinary in-scope tasks yield three librarian-approved sources; at least 80% of displayed top-five sources are useful for the actual request; no observed fabricated identities or unsupported claims in the reviewed sample; clearly labeled provider failures; and a demonstrated improvement over the existing workflow. Report sample sizes and uncertainty, and exclude sparse/no-answer controls from positive-result targets while scoring their honest handling separately.

## Outreach decision

**Start 3–5 discovery conversations now; seek 1–2 design partners after the next quality pass. Do not start broad sales outreach or promise a deployable university-wide system.** The objective is to learn which research task is painful enough that a library would test a new workflow, not to assume a large database collection means unmet demand.

Prioritize:

1. **Wake/ZSR first:** an instruction librarian plus an electronic-resources/discovery librarian. Request problem cases, an approved pilot scope and an introduction to peers. The current branding/configuration is a prototype and is not evidence of Wake endorsement.
2. **Nearby academic libraries:** [Elon instruction/liaison librarians](https://www.elon.edu/u/library/services/instruction/), [UNCG library liaisons](https://library.uncg.edu/library-liaisons-for-research-assistance/), and [Forsyth Tech's library](https://forsythtech.libguides.com/). These are research candidates based on their published services, not confirmed customers or evidence they lack adequate tools.
3. **NC LIVE after initial interviews:** it [supports 200+ public and academic libraries and provides discovery/authentication services](https://www.nclive.org/index.php/about). It is a relevant route to understanding common needs and integration constraints, not automatically a buyer.
4. **Other sectors later:** corporate knowledge centers, museums/archives and specialist research organizations are hypotheses. They introduce different permissions, collections, evaluation tasks and procurement. Avoid splitting the product across them before proving one academic-library use case.

Competition materially affects positioning. [Primo Research Assistant](https://knowledge.ag-software.clarivate.com/primo/Product_Materials/001_Next_Discovery_Experience_NDE/Primo_Research_Assistant.html) already offers natural-language search, Boolean transformation, references and search suggestions. [EBSCO](https://about.ebsco.com/artificial-intelligence/ebscohost-ai-companion) offers AI-assisted search, article insights and document questions. My inference is that “AI over many databases” is too generic a proposition. Test a narrower one: **a librarian-configured path from an assignment to suitable sources, understandable searches and the institution's own resources, with transparent evidence limits.**

A discovery invitation can say: “I'm developing a student research navigator that connects research questions with library resources and explains search choices. It's a prototype, and our testing has exposed reliability and relevance gaps. Could I get 20 minutes of feedback and a few difficult research questions? I'm trying to learn whether this solves a problem your current tools leave open.” No messages were sent.

Ask each librarian where students get stuck, which existing tools they use, how they judge a source as good enough, what their current AI tools fail to do, which access/privacy constraints a pilot must meet, and who could own a small evaluation. Proceed only if repeated pain and a willing evaluator emerge.

## Evidence receipt

- `manifest.json`: frozen questions and selected review cases.
- `live-capture.json`, `retry-capture.json`: original public responses and separate retries.
- `identity-verification.json`, `identity-summary.json`, `identity-followups.json`: raw DOI checks and targeted follow-ups.
- `ai-relevance-screen.json`: per-record provisional AI labels and reasons; no human ratings.
- `metrics.json`, `summarize.py`: independently recomputed counts and definitions.
- `human-review.csv`: blank human-review worksheet for all 74 first-pass top-five records.

No application code or deployment changed during this assessment, and no university or library was contacted.
