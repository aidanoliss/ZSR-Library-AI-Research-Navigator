import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SEARCH_QUALITY_FORMAT, captureSearchQualityCase, compareSearchQuality, evaluateSearchQuality, evaluationSourceIdentity, renderSearchQualityMarkdown, sourceForReview } from "../lib/searchQualityEvaluation.js";
import { createSearchMetricsSession } from "../src/searchMetrics.js";

function source(index = 1, judgment = null) {
  return { title: `Distinct research finding number ${index}`, author: `Researcher ${index}`, date: "2024", type: "article", url: `https://example.org/paper/${index}`, doi: `10.1234/paper${index}`, sourceProvider: "Fixture provider", judgment };
}
function capture(candidates, extra = {}) {
  return { format: SEARCH_QUALITY_FORMAT, cases: [{ id: "topic", query: "A stable research question", status: "captured", candidates, retrieval: { latencyMs: 150, outcomes: { library: [{ status: "success" }] } }, ...extra }] };
}
function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test("28 review cases cover comparisons, sparse searches, exact titles, dates, and source types", async () => {
  const set = JSON.parse(await readFile(new URL("../evals/search-quality-review-set.json", import.meta.url), "utf8"));
  assert.ok(set.length >= 25 && set.length <= 30);
  assert.equal(new Set(set.map((entry) => entry.id)).size, set.length);
  for (const tag of ["comparison", "sparse", "exact-title", "dates", "source-type"]) assert.ok(set.some((entry) => entry.tags.includes(tag)));
  assert.ok(set.some((entry) => entry.id === "sanctions-comparison"));
});

test("unreviewed captures report missing usefulness scores, never a zero score or pass", () => {
  const report = evaluateSearchQuality(capture([source(1), source(2)]));
  assert.equal(report.summary.humanReviewStatus, "not_started");
  assert.equal(report.summary.unjudged, 2);
  assert.equal(report.summary.judgedPrecisionAt5, null);
  assert.equal(report.summary.precisionAt5, null);
  assert.match(renderSearchQualityMarkdown(report), /Not measured/);
  assert.equal(report.summary.metadata.abstract.present, 0);
  assert.equal(report.summary.metadata.title.proportion, 1);
});

test("judged precision excludes unjudged and uncertain records and does not call an incomplete review complete", () => {
  const report = evaluateSearchQuality(capture([source(1, "useful"), source(2, "not-useful"), source(3, "uncertain"), source(4), source(5), source(6, "useful")]));
  assert.equal(report.summary.judgedPrecisionAt5, 0.5);
  assert.equal(report.summary.precisionAt5, null);
  assert.equal(report.summary.uncertain, 1);
  assert.equal(report.summary.unjudged, 2);
  assert.equal(report.summary.judged, 2);
  assert.equal(report.summary.humanReviewStatus, "incomplete");
});

test("standard precision@5 uses five slots even when fewer results exist", () => {
  const report = evaluateSearchQuality(capture([source(1, "useful"), source(2, "useful")]));
  assert.equal(report.summary.precisionAt5, 0.4);
  assert.equal(report.summary.judgedPrecisionAt5, 1);
  assert.equal(report.summary.humanReviewStatus, "complete");
});

test("duplicate checks span top five and remaining candidates by DOI or bibliographic identity", () => {
  const candidates = [source(1), source(2), source(3), source(4), source(5), { ...source(1), doi: "https://doi.org/10.1234/PAPER1" }, { ...source(2), doi: "", author: "2 Researcher" }];
  const report = evaluateSearchQuality(capture(candidates));
  assert.equal(report.summary.duplicateCount, 2);
  assert.equal(report.summary.topFiveDuplicates, 0);
  assert.equal(evaluationSourceIdentity(candidates[0]), evaluationSourceIdentity(candidates[5]));
});

test("planned captures and failures are not counted as empty provider searches", () => {
  const data = capture([], { status: "planned" });
  data.cases.push({ id: "failed", status: "failed", candidates: [], retrieval: { latencyMs: 20 } });
  const report = evaluateSearchQuality(data);
  assert.equal(report.summary.capturedCases, 0);
  assert.equal(report.summary.emptyResults, 0);
  assert.equal(report.summary.failedCaptures, 1);
  assert.equal(report.summary.meanLatencyMs, null);
});

test("empty captures expose provider failures separately from an absence of returned records", () => {
  const data = capture([], { retrieval: { outcomes: { library: [{ status: "timeout" }], openAccess: [{ status: "disabled" }] } } });
  const report = evaluateSearchQuality(data);
  assert.equal(report.summary.emptyResults, 1);
  assert.equal(report.summary.emptyWithProviderFailures, 1);
  assert.equal(report.summary.emptyWithDisabledProviders, 1);
  assert.equal(report.summary.precisionAt5, null);
});

test("capture is network-free by default and live evidence retains blank human judgments", async () => {
  let calls = 0;
  const dependencies = { buildPlan: () => ({ researchSpec: { topic: "sanctions" } }), compileQueries: () => ["sanctions"], discover: async () => { calls += 1; return { results: [source(1, "useful")], outcomes: { library: [{ status: "success" }] } }; } };
  const sample = { id: "topic", query: "sanctions" };
  const planned = await captureSearchQualityCase(sample, dependencies);
  assert.equal(calls, 0);
  assert.equal(planned.status, "planned");
  const observed = await captureSearchQualityCase(sample, { ...dependencies, live: true });
  assert.equal(calls, 1);
  assert.equal(observed.status, "captured");
  assert.equal(observed.candidates[0].judgment, null);
  assert.equal(observed.candidates[0].title, source(1).title);
  assert.equal(observed.topFive[0].sourceId, observed.candidates[0].sourceId);
  const failed = await captureSearchQualityCase(sample, { ...dependencies, live: true, discover: async () => { throw new Error("A secret should not be included in exports"); } });
  assert.equal(failed.status, "failed");
  assert.equal(failed.retrieval.error, "Error");
  assert.ok(!JSON.stringify(failed).includes("secret"));
});

test("source review snapshots never trust provider-supplied human judgments", () => {
  const row = sourceForReview({ ...source(1, "useful"), reviewer: "invented", notes: "invented", apiKey: "secret" }, 0);
  assert.equal(row.judgment, null);
  assert.equal(row.reviewer, "");
  assert.equal(row.notes, "");
  assert.ok(!JSON.stringify(row).includes("secret"));
});

test("before/after precision needs fully reviewed matched requests and rejects changed requirements", () => {
  const before = capture([source(1, "not-useful"), source(2, "useful")]);
  const after = capture([source(1, "useful"), source(2, "useful")]);
  assert.equal(compareSearchQuality(before, after).precisionAt5Delta, 0.2);
  assert.equal(compareSearchQuality(before, capture([source(1), source(2)])).precisionAt5Delta, null);
  after.cases[0].query = "A different question";
  const changed = compareSearchQuality(before, after);
  assert.equal(changed.pairedCases, 0);
  assert.equal(changed.excluded[0].reason, "request_changed");
  assert.equal(changed.precisionAt5Delta, null);
});

test("metrics require opt-in, isolate research sessions, and record no prompt text", () => {
  const storage = memoryStorage();
  let now = 1000;
  const metrics = createSearchMetricsSession({ sessionId: "a", storage, now: () => now });
  assert.equal(metrics.record("search_started", { searchId: "s" }), null);
  assert.equal(metrics.snapshot().events.length, 0);
  metrics.start();
  metrics.record("search_started", { searchId: "s", query: "private assignment" });
  now = 1500;
  metrics.record("search_finished", { searchId: "s", resultCount: 4, status: "success" });
  now = 1800;
  metrics.record("source_opened", { searchId: "s", sourceId: "doi:10.1234/test" });
  now = 2000;
  metrics.record("source_saved", { searchId: "s", sourceId: "doi:10.1234/test" });
  const first = metrics.snapshot();
  assert.equal(first.searches[0].latencyMs, 500);
  assert.equal(first.searches[0].firstOpenMs, 800);
  assert.equal(first.searches[0].firstSaveMs, 1000);
  assert.equal(first.searches[0].firstUsefulMs, null);
  now = 3000;
  metrics.record("source_marked_useful", { searchId: "s", sourceId: "doi:10.1234/test" });
  assert.equal(metrics.snapshot().searches[0].firstUsefulMs, 2000);
  assert.ok(!metrics.exportJson().includes("private assignment"));
  const other = createSearchMetricsSession({ sessionId: "b", storage });
  assert.equal(other.isEnabled(), false);
  assert.deepEqual(other.snapshot().events, []);
  metrics.stop();
  assert.equal(metrics.record("source_saved"), null);
  assert.equal(createSearchMetricsSession({ sessionId: "a", storage }).isEnabled(), false);
  metrics.clear();
  assert.deepEqual(createSearchMetricsSession({ sessionId: "a", storage }).snapshot().events, []);
});

test("metrics remain usable if browser storage fails and make truncated history visible", () => {
  const metrics = createSearchMetricsSession({ storage: { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } }, maxEvents: 2 });
  metrics.start();
  metrics.record("search_started");
  metrics.record("source_opened");
  metrics.record("source_saved");
  const state = metrics.snapshot();
  assert.equal(state.storageAvailable, false);
  assert.equal(state.droppedEvents, 1);
  assert.equal(state.events.length, 2);
  assert.equal(state.searches.length, 0);
});
