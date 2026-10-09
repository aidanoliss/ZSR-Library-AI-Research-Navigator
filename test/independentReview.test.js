import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { blankCases, prepareReview, checkReview } from "../scripts/prepare-independent-review.mjs";

const release = { files: [{ path: "test-fixture.js", sha256: "a".repeat(64) }] };
release.sha256 = createHash("sha256").update(JSON.stringify(release.files)).digest("hex");
function fixtures() {
  const input = blankCases();
  input.provenance = { collectedBy: "test reviewer", collectedAt: "2026-10-08", authorship: "human", anonymized: true, consentToEvaluation: true, notUsedForTuning: true };
  input.acceptanceCriteria = { approvedBy: "test reviewer", minimumCases: 1, minimumUsefulProportion: 0.8, maximumEmptyProportion: 0.2 };
  input.cases = [{ id: "synthetic-unit-fixture", query: "Synthetic unit test only" }];
  const capture = { format: "zsr-search-quality-review", releaseSha256: release.sha256, capturedBy: "test operator", generatedAt: "2026-10-08", cases: [{ ...input.cases[0], status: "captured", displayedResponse: { sources: ["test"] }, candidates: [{ title: "Synthetic fixture", url: "https://example.org/fixture" }] }] };
  return { input, capture };
}
function reviewedPacket() {
  const { input, capture } = fixtures();
  const packet = prepareReview(input, release, capture);
  Object.assign(packet.cases[0].review, { reviewer: "librarian-fixture", reviewedAt: "2026-10-08", independentHumanReview: true, intentPreserved: true, unsupportedClaims: 0 });
  Object.assign(packet.cases[0].candidates[0], { judgment: "useful", reviewer: "librarian-fixture", identityVerified: true, evidenceContextAccurate: true });
  return packet;
}

test("template invents no held-out questions and rejects missing independent provenance", () => {
  assert.deepEqual(blankCases().cases, []);
  assert.throws(() => prepareReview(blankCases(), release), /attestations/);
});
test("preparation discards prefilled ratings and cannot pass without independent human review", () => {
  const { input, capture } = fixtures();
  Object.assign(capture.cases[0].candidates[0], { judgment: "useful", reviewer: "model", identityVerified: true });
  const packet = prepareReview(input, release, capture);
  assert.equal(packet.cases[0].candidates[0].judgment, null);
  assert.equal(packet.cases[0].candidates[0].reviewer, "");
  assert.equal(checkReview(packet).readyForReviewedPilot, false);
});
test("release mismatch, changed requests and incomplete response captures are rejected", () => {
  const { input, capture } = fixtures();
  assert.throws(() => prepareReview(input, release, { ...capture, releaseSha256: "b".repeat(64) }), /fingerprint/);
  capture.cases[0].query = "changed query";
  assert.throws(() => prepareReview(input, release, capture), /request changed/);
  const packet = reviewedPacket();
  packet.cases[0].displayedResponse = null;
  assert.equal(checkReview(packet).readyForReviewedPilot, false);
});
test("only fully reviewed unchanged evidence meeting approved criteria passes", () => {
  const packet = reviewedPacket();
  assert.equal(checkReview(packet).readyForReviewedPilot, true);
  packet.cases[0].candidates[0].title = "Replaced source";
  assert.equal(checkReview(packet).readyForReviewedPilot, false);
});
test("unsupported claims and inaccurate evidence block readiness despite useful sources", () => {
  const packet = reviewedPacket();
  packet.cases[0].review.unsupportedClaims = 1;
  assert.equal(checkReview(packet).readyForReviewedPilot, false);
  packet.cases[0].review.unsupportedClaims = 0;
  packet.cases[0].candidates[0].evidenceContextAccurate = false;
  assert.equal(checkReview(packet).readyForReviewedPilot, false);
});
