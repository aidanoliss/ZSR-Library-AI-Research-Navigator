# ZSR Navigator: response and source quality audit

Assessed October 4, 2026. Product code was not changed during this audit.

## Assessment

The current application can return real, useful research leads, but it does not yet do so consistently enough to claim reliable research quality. The generated overview is independent of the retrieved papers. A real source card beside the overview is not evidence that the source supports the overview.

The earlier 285 passing tests and 56 passing pilot cases established the behaviors those checks assert. They did not measure source usefulness or claim support. This audit supplies a broader retrieval sample and concrete counterexamples. No librarian or student ratings were collected, and none have been filled in by AI.

## Work performed and limits

- Ran the existing 28-query review set sequentially against configured bibliographic providers, requesting ten final candidates per ordinary scope, matching the application's normal requested limit. The combined access scope can request up to twenty.
- Saved queries, interpreted requirements, provider outcomes, ranked records and supplied abstracts in `provider-capture.json`.
- Generated `provider-report.md` using the existing evaluator. Its human-quality scores remain unmeasured.
- Inspected three live Gemini generation-stage responses through the current prompt builder and reply validator. These are not full UI transcripts or a factual accuracy benchmark. See `ai-response-samples.json`.
- Reproduced source-type, historical-date and loaded-language parsing defects without network calls. See `interpretation-probes.json`.
- Inspected generation, routing, ranking, source checks and validation code. Spot-checked selected records against primary publisher pages. Did not verify every returned record or read all full texts.

## Retrieval observations

| Observation | Result |
|---|---:|
| Queries captured | 28 |
| Queries with at least one returned lead | 15 |
| Empty result sets | 13 |
| Empty sets affected by disabled providers | 2 |
| Recorded provider errors/timeouts/rate-limit outcomes | 0 |
| Returned candidate records | 119 |
| Records with supplied abstracts | 110 |
| Detected duplicates | 0 |
| Human relevance precision | Not measured |

These are observations from one deliberately varied test set, not an estimated error rate for all student research. Zero provider error outcomes do not prove exhaustive upstream retrieval. Empty results can reflect interpretation, overly restrictive queries, source filtering, coverage or provider configuration; they do not establish that no literature exists.

| Request | Returned leads | Interpretation of observed result |
|---|---:|---|
| Sanctions across authoritarian regimes and democracies | 10 | Includes direct comparative leads and broader supporting work; ranking still needs review. |
| Proportional representation versus first-past-the-post and turnout | 0 | Only one rigid query was compiled, including a quoted multiword electoral-system phrase. |
| Qualitative interviews about college food insecurity | 0 | Compiler merged method and topic into one quoted phrase. |
| College food insecurity without a method constraint | 10 | Includes a qualitative study, demonstrating that the more specific request needs better parsing. |
| Women abolitionists before 1865 | 0 | Historical period incorrectly became publication year through 1864. |
| Introductory books on environmental justice | 0 | Compiler retained “Books introducing” inside the exact topic phrase. |
| Exact Hardin article | 10 | Original requested article is absent; related papers, a book chapter and a review appear instead. |
| Exact Ostrom book | 1 | Retrieved a book record with matching title and author. |

## Highest-priority findings

### 1. Separate research subject, evidence type, historical period and publication requirements

The regex-based parser sometimes searches instruction language as if it were a topic. Examples from the live capture:

- `"Qualitative interviews food insecurity" AND "college students"`
- `"Offshore wind energy" AND "marine mammals systematic reviews"`
- `"Books introducing environmental justice" AND "United States"`

For women abolitionists before 1865, the specification sets `publicationYearTo: 1864` and leaves the historical period empty. This excludes modern scholarship about the period.

Source-type inference also confuses the subject with the requested evidence: studies *about* newspaper coverage select News; scholarly articles *about* book banning select Books; studies *about* primary-source teaching select Primary sources. See `config/researchSpec.js:168` and `config/sourceRequirements.js:26`.

Fix these semantic distinctions before broadening queries. A fallback that preserves a wrongly interpreted requirement simply preserves the mistake. Explicit requirements should remain intact; uncertainty about their meaning should be shown for correction.

### 2. Exact-item searches need identity checks, and comparative searches need relationship checks

The Hardin request is parsed as a known article with a specified author, but ranking allows the author name to match the title or abstract rather than the author field. Concept matching is unordered token overlap. Commentaries mentioning both the title and author therefore qualify. See `server/sourceRelevance.js:19` and `server/sourceRelevance.js:67`.

The requested original is Garrett Hardin's 1968 Science article, DOI `10.1126/science.162.3859.1243`, confirmed by the [publisher record](https://doi.org/10.1126/science.162.3859.1243). It was absent from all ten captured candidates. Known-item retrieval should resolve title/author/identifier identity first and separately label related works.

For the CBT-versus-mindfulness request, the first result studies a combined intervention against a wait-list control. It can be useful background, but does not directly compare CBT alone against mindfulness alone. This distinction is confirmed in the [paper's abstract and methods](https://link.springer.com/article/10.1186/s12909-025-07130-w). That is a retrieval-usefulness issue, not a fabricated citation or an observed AI misquotation.

### 3. Grounded factual answers are not implemented

`server/native.js:420` starts source discovery and calls generation with conversation text plus curated database routes. Discovered article records are awaited afterward. The model is not given their titles, abstracts or evidence. The Express paths behave similarly. Follow-up chat also lacks the displayed source records.

`server/validate.js:31` validates starting-point links and query routing; it does not verify factual prose. A local synthetic probe demonstrated that a fabricated study claim and DOI can survive the validator while an invented starting-point URL is removed. This is an enforcement-gap demonstration, not an observed live hallucination rate.

For a source-grounded mode: retrieve first, provide bounded source excerpts with stable IDs, associate each substantive claim with its evidence, distinguish abstract-only support from full-text support, and abstain where evidence is missing. Real citations alone are insufficient. Continue labeling ordinary orientation as unverified guidance.

### 4. Neutral prose can coexist with biased search logic

The live model correctly challenged the request for studies “proving” social media “damages” adolescent mental health and suggested investigating relationships. However, the deterministic specification made `proving` and `damages` mandatory concepts and set `requiresPremiseCheck: false`. The governed search paths restore those terms after generation.

Neutralization must apply to the actual search plan, not just the explanation. Show a concise proposed open-ended question and allow correction; preserve legitimate requests to investigate harms without presuming that harms are established. Seek differing findings where relevant without manufacturing false balance.

### 5. Source labels are too coarse for evidence literacy

The first-generation/belonging results include a book review labeled as an article in provider metadata. Other records can be working papers, commentary, chapters or empirical studies. The current source-type mapping cannot reliably distinguish those roles. Peer-review status correctly remains unknown when the provider does not explicitly report it, but article format alone does not establish study design or research quality.

Add understandable evidence-role labels only when supported: empirical study, systematic review, book review, commentary, primary document, or not established. Show what the source can help answer and what it cannot establish. Keep the distinction between provider metadata, automated interpretation and verified evidence visible.

### 6. Research guidance needs actions and evidence, not more warnings

The three sampled live AI responses supplied sensible general evaluation advice. The sanctions response was a research orientation, not a synthesis. The newspaper-coverage response even correctly described the need for research *about* coverage despite the incorrect News routing. These are strengths, but reveal inconsistency between prose and search behavior.

Useful next features are short reading prompts at the source: identify the question, methods/evidence, population or context, principal finding, and limitations. For claims, open the relevant passage and ask what it supports. For comprehensive work, offer search history, citation chaining, another suitable database and explicit gaps in coverage. For small assignments, keep those options unobtrusive.

The library path already searches beyond an Open Access-only corpus through Primo/Crossref metadata and directs students to ZSR databases. It does not search all named subscription databases directly or retrieve their paywalled full text. OpenAlex was unconfigured in this audit, so its disabled outcome should not be read as an empty literature search.

ZSR's own [AI research guidance](https://zsr.wfu.edu/research/support/integrating-ai-into-the-research-process/) discusses evaluating accuracy, suitability and coverage and exploring complementary research tools. That supports offering several appropriate paths, not portraying this interface as a comprehensive endpoint or claiming institutional endorsement.

## Recommended next iteration

1. Repair intent, date, method and neutral-query parsing with the counterexamples above.
2. Add exact-item identity resolution and rank direct evidence separately from supporting material.
3. Improve source-type and evidence-role descriptions and connect factual claims to supplied evidence before presenting them as source-grounded.
4. Add compact reading/verification actions and suitable next-search paths.
5. Re-run the same captures and have librarians grade top-five usefulness, evidence type and claim support independently. Use actual student sessions to assess whether users can identify and explain one useful source. Preserve failure cases; do not substitute automated test passes for those judgments.

The current interface is a useful foundation. The next priority should be correctness and evidence interpretation, rather than another visual redesign.
