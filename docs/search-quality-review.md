# Search quality and student usability review

This workflow separates observed retrieval behavior from human judgments. It cannot claim that search is more useful until librarians or students review actual results. No participants, ratings, usefulness scores, or study outcomes are supplied by the tooling.

## Capture real results

The 28 requests in `evals/search-quality-review-set.json` cover comparisons (including sanctions and regime type), common disciplinary searches, sparse topics, exact titles, dates, methods, formats, and access scopes. A `reviewPrompt` says what a reviewer should inspect; it is not a relevance label.

Run planning without network access first:

```sh
node scripts/capture-search-quality.mjs --write /tmp/search-plan.json
```

To contact the configured bibliographic providers, explicitly opt into a live capture:

```sh
node scripts/capture-search-quality.mjs --live --case sanctions-comparison --label current --write /tmp/sanctions-review.json
node scripts/capture-search-quality.mjs --live --label current --write /tmp/search-review.json
```

The capture uses the application's `buildResearchPlan`, `liveSearchQueries`, and `discoverSourcesForScope` path and makes **no OpenAI calls**. Defaults: up to 20 candidates per request, a 45-second per-request timeout, and sequential requests. `--limit 5` runs only the first five cases; `--candidates 15` changes the final requested candidate limit. Provider-specific candidate pools may have their own bounds. Capture at comparable times/configurations for baseline and revised versions. Respect provider limits and inspect failure outcomes before rerunning a whole set.

Each case includes the exact request, interpreted constraints, issued query alternatives, provider outcomes, latency, ranked candidates, and an index of the first five. Captured source fields are provider-reported metadata, including any available abstracts; no full-text claims are added. Missing provider configuration, provider errors, and genuine empty results require different interpretations. The candidate list contains the final pool returned by the app; it does not include every upstream record rejected by retrieval filters. The capture records all final candidates without hiding duplicates so the evaluator can count them.

## Librarian review

1. Preserve an untouched copy of the capture. Record the application revision and provider configuration beside it, omitting credentials.
2. Review candidates at ranks 1–5 for all cases. Open each source record and, where necessary, read the abstract or full text. Grade the student's stated research task and constraints, not generic keyword overlap.
3. In each candidate, set `judgment` to `useful`, `not-useful`, or `uncertain`; fill `reviewer` with a study alias and add concise `notes`. Keep `null` for unreviewed sources. `useful` means a source provides relevant evidence or clearly identified supporting background that the student can reasonably use. It does not certify every claim as true.
4. Review remaining candidates to find missed useful sources and ranking problems. These grades inform diagnosis but do not affect precision in the first five.
5. Prefer two independent reviewers for a subset. Record disagreements rather than silently replacing them. Resolve disagreements in a documented copy; unresolved relevance or access limitations stay `uncertain`.

AI may produce plausible but false interpretations even when citations are real. Bibliographic identity is not evidence for an AI conclusion. Read source text before grading factual support, and never turn an automated metadata match into a human usefulness grade.

## Evaluate and compare

```sh
node scripts/evaluate-search-quality.mjs --input /tmp/search-review.json --write /tmp/search-review.md
node scripts/evaluate-search-quality.mjs --input /tmp/after-reviewed.json --before /tmp/before-reviewed.json --write /tmp/comparison.md
```

Use `--json` for a machine-readable report. There is no pass/fail threshold. The report includes:

- **Judged precision in the first five:** useful ÷ determinate (`useful` or `not-useful`) judgments at ranks 1–5. Always read with unjudged and uncertain counts; selective review can bias this measure.
- **Precision@5:** useful results ÷ five slots per captured query, withheld until displayed results have determinate judgments. Fewer than five results leaves unfilled slots. No human judgments means no score, not zero.
- **Coverage:** captured, planned and failed cases; unjudged and uncertain results; total candidates and top-five counts.
- **Retrieval observations:** empty captured queries, provider failure outcomes, duplicate candidates (including those outside the top five), top-five duplicates, and mean observed latency.
- **Metadata presence:** title, authors, year, source type, URL, provider, and abstract. Missing metadata limits review; its presence does not establish accuracy or usefulness.

Before/after changes use matching case IDs with unchanged requests, modes, scopes, and assignment context. Precision change uses only pairs whose displayed results were fully judged in both versions. Changed or missing captures are excluded and reported. A small review set and changing provider indexes cannot establish statistical significance or isolate all causes of improvement. Keep the baseline; never regenerate it on the new version and call it “before.”

## Student usability sessions

Recruit actual participants through the project owner or faculty; the application does not contact anyone. A practical first round is 5–8 consenting students with varied research experience, followed by another round after fixes. This is a qualitative usability study, not a statistically representative effectiveness claim.

Give each participant two tasks: one familiar assignment and one provided comparison task. Use a counterbalanced order when comparing two versions. Keep devices, connection, tasks, instructions, and time limits consistent. Do not coach navigation until the participant is blocked; mark interventions and exclude coached timing from an unassisted comparison.

Ask the participant to think aloud, find a source they believe is useful, open it, explain what makes it useful for the task, and save it. The observer verifies the source identity and notes whether the participant recognized background evidence versus a direct comparison. Set a fixed ten-minute task limit; a task without a useful source is **not completed**, not a zero-second success.

Record an anonymous participant alias, task ID, version, time started, search revisions, first result open, first save, **first explicitly judged useful source**, source identity, interventions, completion status, and a short ease rating. Also note whether students could find Search strategy, understand the active filters, recognize AI limitations, and recover from no results. Do not collect student names, course grades, assignment text, or unrelated browser history in exported timing data.

The opt-in browser recorder in `src/searchMetrics.js` stores the current review session in this tab's `sessionStorage` and preserves it through a page refresh. Individual searches have separate request IDs. It makes no network requests. Users can start, stop, export, and clear their local recording. It records search start/finish and source open/save times. **Saving or opening alone never counts as finding a useful source.** An explicit `source_marked_useful` event records that human decision. Compare timing exports with observer notes before reporting medians or success rates; distinguish missing observations, failures, abandoned tasks, and completed tasks. Exports can contain public source identifiers and timestamps, so share them intentionally.

### Browser integration

```js
const metrics = createSearchMetricsSession({ sessionId: currentResearchSessionId });
metrics.start(); // Explicit participant opt-in; do not call on page load.
metrics.record("search_started", { searchId: requestId });
metrics.record("search_finished", { searchId: requestId, resultCount: results.length, status: "success" });
metrics.record("source_opened", { searchId: requestId, sourceId: sourceIdentity });
metrics.record("source_saved", { searchId: requestId, sourceId: sourceIdentity });
metrics.record("source_marked_useful", { searchId: requestId, sourceId: sourceIdentity });
const exportText = metrics.exportJson();
metrics.stop();
metrics.clear();
```

`isEnabled()` supports UI state; `snapshot()` returns events and observed timings. Pass explicit `searchId` when interacting with results from earlier searches. Without it, an event is attributed to the most recent recorded search. No query or title text is recorded. Storage errors preserve an in-memory recording with `storageAvailable: false`. The event cap defaults to 1,000; `droppedEvents` flags truncation so incomplete histories are not silently treated as complete trials.

The automated tests validate scoring semantics, duplicate detection, matched comparisons, opt-in behavior, privacy field filtering, storage isolation, and missing observations. They do not substitute for the human review protocol.
