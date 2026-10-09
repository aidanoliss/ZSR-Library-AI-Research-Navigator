import test from "node:test";
import assert from "node:assert/strict";
import { workspaceRequirementSpec, assessSavedSource, savedSourceDetails } from "../src/workspaceRequirements.js";
import { sourcePeerReviewStatus } from "../src/sourceAssessment.js";

const activeSpec = {
  topic: "urban tree canopy and summer temperatures",
  mode: "scholarly",
  concepts: [{ preferredTerm: "tree canopy", required: true }],
  sourceRequirements: { publicationYearFrom: 2020, publicationYearTo: 2025, peerReviewed: true, requestedSourceCount: 3 },
  sourceContract: { id: "scholarly", label: "Scholarly articles", allowedKinds: ["scholarly-article"] },
};

const saved = (sourceRecord = {}, imported = false) => ({
  id: "fixture", kind: "source", title: "Tree canopy and temperatures", url: "https://example.org/source", imported,
  sourceRecord: { sourceKind: "scholarly-article", date: "2023", peerReviewed: true, ...sourceRecord },
});

test("a source-count-only brief retains the current request's other requirements and topic", () => {
  const before = structuredClone(activeSpec);
  const merged = workspaceRequirementSpec({ sourceCount: "4" }, activeSpec);
  assert.deepEqual(merged.sourceRequirements, { ...activeSpec.sourceRequirements, requestedSourceCount: 4 });
  assert.deepEqual(merged.sourceContract, activeSpec.sourceContract);
  assert.deepEqual(merged.concepts, activeSpec.concepts);
  assert.equal(merged.topic, activeSpec.topic);
  assert.deepEqual(activeSpec, before);
  assert.equal(assessSavedSource(saved({ date: "2018" }), merged).status, "mismatch");
  assert.equal(assessSavedSource(saved({ peerReviewed: undefined }), merged).status, "unverified");
});

test("assignment fields override only requirements that they explicitly describe", () => {
  const dated = workspaceRequirementSpec({ dateRange: "since 2022" }, activeSpec);
  assert.deepEqual(dated.sourceRequirements, { ...activeSpec.sourceRequirements, publicationYearFrom: 2022 });
  assert.deepEqual(dated.sourceContract, activeSpec.sourceContract);
  const typed = workspaceRequirementSpec({ sourceTypes: "books" }, activeSpec);
  assert.deepEqual(typed.sourceRequirements, activeSpec.sourceRequirements);
  assert.deepEqual(typed.sourceContract.allowedKinds, ["book", "book-chapter"]);
  assert.deepEqual(typed.manualRequirements, []);
  const unconstrainedDate = workspaceRequirementSpec({ dateRange: "no date restrictions" }, activeSpec);
  assert.deepEqual(unconstrainedDate.sourceRequirements, { ...activeSpec.sourceRequirements, publicationYearFrom: null, publicationYearTo: null });
  assert.deepEqual(unconstrainedDate.manualRequirements, []);
  const reviewOptOut = workspaceRequirementSpec({ sourceTypes: "not necessarily peer-reviewed" }, activeSpec);
  assert.equal(reviewOptOut.sourceRequirements.peerReviewed, false);
  assert.deepEqual(reviewOptOut.sourceContract, activeSpec.sourceContract);
});

test("unknown brief fields retain known requirements and cannot produce fully supported assignment status", () => {
  const merged = workspaceRequirementSpec({ sourceCount: "several", dateRange: "recent enough", sourceTypes: "appropriate evidence" }, activeSpec);
  assert.deepEqual(merged.sourceRequirements, activeSpec.sourceRequirements);
  assert.deepEqual(merged.sourceContract, activeSpec.sourceContract);
  assert.equal(merged.manualRequirements.length, 3);
  const assessment = assessSavedSource(saved(), merged);
  assert.equal(assessment.status, "unverified");
  assert.ok(assessment.checks.some((check) => check.id === "assignment-review" && check.status === "unverified"));
  const empty = workspaceRequirementSpec({ sourceCount: "several" });
  assert.equal(empty.sourceRequirements.requestedSourceCount, null);
  assert.equal(empty.sourceRequirements.publicationYearFrom, null);
  assert.equal(empty.sourceContract, null);
});

test("peer-review wording alone does not invent an article type, and negative types remain unresolved", () => {
  const justReview = workspaceRequirementSpec({ sourceTypes: "peer-reviewed" });
  assert.equal(justReview.sourceRequirements.peerReviewed, true);
  assert.equal(justReview.sourceContract, null);
  const excluded = workspaceRequirementSpec({ sourceTypes: "articles, not books" }, activeSpec);
  assert.deepEqual(excluded.sourceContract, activeSpec.sourceContract);
  assert.ok(excluded.manualRequirements.some((message) => /Source-type/.test(message)));
});

test("saved source detail labels agree with the helper's meets, mismatch, and unverified enums", () => {
  for (const [record, status, label] of [
    [{ peerReviewed: true }, "meets", "Reported peer reviewed"],
    [{ peerReviewed: false }, "mismatch", "Reported not peer reviewed"],
    [{ peerReviewed: undefined }, "unverified", "Not established by metadata"],
    [{ peerReviewed: undefined, provenance: { peerReviewed: true } }, "meets", "Reported peer reviewed"],
    [{ peerReviewed: undefined, quality: { peerReviewed: false } }, "mismatch", "Reported not peer reviewed"],
    [{ peerReviewed: "true" }, "unverified", "Not established by metadata"],
  ]) {
    assert.equal(sourcePeerReviewStatus(record), status);
    assert.equal(savedSourceDetails(saved(record)).peerReview, label);
  }
  assert.equal(savedSourceDetails(saved({ peerReviewed: true }, true)).peerReview, "Unverified imported metadata");
});
