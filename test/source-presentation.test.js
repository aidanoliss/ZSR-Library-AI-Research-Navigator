import test from "node:test";
import assert from "node:assert/strict";
import { emptySourcePresentation, sourceImageCandidates, safeSourceImageUrl, sourceLaneOutcome } from "../src/sourcePresentation.js";

const lane = (outcome, extra = {}) => ({ label: "Library sources", status: { requested: true, outcome, ...extra } });
test("empty results distinguish completed checks, temporary failures, and unavailable configuration", () => {
  assert.equal(emptySourcePresentation([lane("empty")]).title, "No matching sources yet");
  for (const failure of ["timeout", "error", "rate_limited", "cancelled"]) {
    const state = emptySourcePresentation([lane(failure)]);
    assert.equal(state.title, "Source search couldn’t finish");
    assert.equal(state.retryable, true);
  }
  for (const unavailable of ["not_configured", "disabled", "unsupported"]) {
    const state = emptySourcePresentation([lane(unavailable)]);
    assert.equal(state.title, "Source search isn’t available here");
    assert.equal(state.retryable, false);
  }
});
test("mixed empty and failed lanes retain both explanations and offer retry", () => {
  const state = emptySourcePresentation([lane("empty"), { ...lane("timeout"), label: "Open-access sources" }]);
  assert.equal(state.requested.length, 2);
  assert.equal(state.title, "No matching sources yet");
  assert.equal(state.retryable, true);
  assert.match(state.requested[1].message, /too long/);
});
test("empty-state messages separate no records from records rejected by the checks", () => {
  assert.match(emptySourcePresentation([lane("empty", { emptyReason: "no_records" })]).requested[0].message, /returned no records/);
  assert.match(emptySourcePresentation([lane("empty", { emptyReason: "no_eligible_records" })]).requested[0].message, /Records were returned, but none passed/);
});
test("disabled/unconfigured legacy sessions never read as zero literature hits", () => {
  assert.equal(sourceLaneOutcome({ requested: true, outcome: "not_requested", configured: false }), "not_configured");
  assert.equal(emptySourcePresentation([lane("empty", { requested: false }), lane("disabled")]).requested.length, 1);
});
test("images use actual provider URLs or checksum-valid ISBNs, never title guesses", () => {
  const candidates = sourceImageCandidates({ cover: "https://publisher.example/cover.jpg", isbn: "978-0-262-13472-9" });
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].url, "https://publisher.example/cover.jpg");
  assert.equal(candidates[1].url, "https://covers.openlibrary.org/b/isbn/9780262134729-M.jpg?default=false");
  assert.deepEqual(sourceImageCandidates({ title: "Plausible invented book", isbn: "9780262134720" }), []);
  assert.equal(sourceImageCandidates({ isbn: "0-306-40615-2" }).length, 1);
  assert.equal(sourceImageCandidates({ isbn: "080442957X" }).length, 1);
});
test("image candidates are unique and reject unsafe/local URLs", () => {
  const url = "https://covers.openlibrary.org/b/isbn/9780262134729-M.jpg?default=false";
  assert.equal(sourceImageCandidates({ cover: url, isbn: ["9780262134729"] }).length, 1);
  for (const url of ["javascript:alert(1)", "data:image/png;base64,AA", "file:///tmp/cover.jpg", "https://user:pass@example.com/image", "http://127.0.0.1/private", "http://[::1]/x", "https://localhost/x", "https://router.local/x", "/image.jpg"]) assert.equal(safeSourceImageUrl(url), "");
  assert.equal(safeSourceImageUrl("https://publisher.example/cover.jpg"), "https://publisher.example/cover.jpg");
});

const { buildSearchRefinement } = await import("../config/searchRecovery.js");
const { sourceQueryVariants } = await import("../config/searchQueries.js");
const { buildResearchPlan } = await import("../config/researchAgent.js");
const { normalizeResearchSpec, researchSpecDiff } = await import("../src/researchInterpretation.js");

test("empty-search refinement suggests a different executable query without removing requirements", () => {
  const original = buildResearchPlan("Find scholarly articles on microplastic capture by floating wetlands in urban stormwater ponds", 5, "auto", "scholarly").researchSpec;
  original.sourceRequirements = { ...original.sourceRequirements, publicationYearFrom: 2020, peerReviewed: true };
  original.exclusions = { methods: ["systematic review"] };
  const snapshot = JSON.stringify(original);
  const suggestion = buildSearchRefinement(normalizeResearchSpec(original));
  assert.ok(suggestion);
  assert.notEqual(suggestion.query, sourceQueryVariants(original)[0]);
  assert.equal(JSON.stringify(original), snapshot, "preview never mutates the current search");
  assert.deepEqual(suggestion.researchSpec.sourceRequirements, normalizeResearchSpec(original).sourceRequirements);
  assert.deepEqual(suggestion.researchSpec.facets, normalizeResearchSpec(original).facets);
  assert.deepEqual(suggestion.researchSpec.exclusions, original.exclusions);
  assert.deepEqual(researchSpecDiff(original, suggestion.researchSpec).map((change) => change.field), ["concepts"]);
  const words = (spec) => spec.concepts.filter((concept) => concept.required !== false).flatMap((concept) => concept.preferredTerm.split(/\s+/)).sort();
  assert.deepEqual(words(suggestion.researchSpec), words(original));
  const rerun = buildResearchPlan(original.topic, 5, "auto", "scholarly", { researchSpec: suggestion.researchSpec }).researchSpec;
  assert.equal(sourceQueryVariants(rerun)[0], suggestion.query, "submitted correction executes the proposed query");
});

test("refinement protects exact phrases, known works, and named population facets", () => {
  const spec = { topic: "floating wetlands", mode: "scholarly", concepts: [{ id: "a", preferredTerm: "floating wetlands", required: true, source: "parsed" }], facets: {} };
  assert.equal(buildSearchRefinement({ ...spec, knownItem: { title: "Floating wetlands" } }), null);
  assert.equal(buildSearchRefinement({ ...spec, concepts: [{ ...spec.concepts[0], exactPhrase: true }] }), null);
  assert.equal(buildSearchRefinement({ ...spec, facets: { population: "floating wetlands" } }), null);
  assert.equal(buildSearchRefinement({ ...spec, concepts: [{ ...spec.concepts[0], source: "vocabulary" }] }), null);
});
