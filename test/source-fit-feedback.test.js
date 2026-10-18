import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSourceFeedback, feedbackReviewExport, sourceFitSummary, updateFeedbackQueue, validFeedbackQueue } from "../src/sourceFitFeedback.js";
import { assessSourceRequirements } from "../src/sourceAssessment.js";

test("source fit never presents empty or unknown checks as confirmed relevance", () => {
  assert.equal(sourceFitSummary({ checks: [] }).status, "unverified");
  assert.match(sourceFitSummary({ checks: [] }).summary, /No specific/);
  const fit = sourceFitSummary({ checks: [{ id: "population", label: "Study population", status: "meets", detail: "Provider describes undergraduates." }, { id: "geography", status: "unverified", detail: "Missing location." }, { id: "population-geography", status: "unverified", detail: "No joint passage." }] });
  assert.equal(fit.rows[0].label, "Population");
  assert.equal(fit.rows[1].statusLabel, "Not established");
  assert.equal(fit.joint.detail, "No joint passage.");
  assert.equal(fit.status, "unverified");
  assert.match(sourceFitSummary({ checks: [{ id: "method-include-RCT", status: "mismatch" }] }).summary, /Does not satisfy/);
  assert.equal(sourceFitSummary({ checks: [{ id: "population", status: "invented" }] }).rows[0].statusLabel, "Not established");
});

test("preferred criteria do not alter required fit outcome", () => {
  const fit = sourceFitSummary({ checks: [{ id: "source-type", status: "meets" }], preferenceChecks: [{ id: "preferred-geography", label: "Location", status: "mismatch" }] });
  assert.equal(fit.status, "meets");
  assert.equal(fit.preferences[0].statusLabel, "Does not match preference");
});

test("fit summary exposes real assessment uncertainty for population-place misgrounding", () => {
  const source = { title: "Online learning in higher education", abstractText: "Prior research studies undergraduates in the United States. In this study, we interviewed teachers in Canada about online learning." };
  const assessment = assessSourceRequirements(source, { facets: { population: "undergraduate students", geography: "United States" } });
  const fit = sourceFitSummary(assessment);
  assert.equal(fit.status, "unverified");
  assert.equal(fit.joint.status, "unverified");
});

test("feedback records preserve request, source identity and unreviewed status, with bounded input", () => {
  const entry = createSourceFeedback({ source: { title: "Study", doi: "10.1/test", url: "javascript:bad" }, request: "Undergraduates in the US", researchSpec: { facets: { population: "undergraduates", geography: "US" }, methodRequirements: { include: ["systematic review"] } }, reason: "wrong-population", note: "x".repeat(800), now: 0 });
  assert.equal(entry.note.length, 500);
  assert.equal(entry.source.url, "");
  assert.equal(entry.criteria.population, "undergraduates");
  assert.deepEqual(entry.criteria.methods.include, ["systematic review"]);
  assert.equal(entry.reviewStatus, "unreviewed-student-feedback");
  assert.equal(createSourceFeedback({ source: { title: "Study" }, reason: "unrecognized" }), null);
  assert.equal(createSourceFeedback({ reason: "useful" }), null);
  assert.equal(validFeedbackQueue([entry]), true);
  assert.equal(validFeedbackQueue([{ ...entry, reason: "invented" }]), false);
});

test("feedback updates same query and source, preserves different editions and requests, exports no verified labels", () => {
  const make = (request, doi, reason = "useful") => createSourceFeedback({ request, source: { title: "Same book", doi }, reason, now: 0 });
  let queue = updateFeedbackQueue([], make("topic A", "10.1/first"));
  queue = updateFeedbackQueue(queue, make("topic A", "10.1/first", "wrong-method"));
  assert.equal(queue.length, 1);
  assert.equal(queue[0].reason, "wrong-method");
  queue = updateFeedbackQueue(queue, make("topic B", "10.1/first"));
  queue = updateFeedbackQueue(queue, make("topic A", "10.1/second"));
  assert.equal(queue.length, 3);
  const exported = feedbackReviewExport(queue, 0);
  assert.match(exported.reviewNotice, /not verified labels/);
  assert.equal(exported.records.every(item => item.reviewStatus === "unreviewed-student-feedback"), true);
});

test("private feedback does not initialize storage and feedback is never silently transmitted", async () => {
  const ui = await readFile(new URL("../src/SourceFeedback.jsx", import.meta.url), "utf8");
  assert.match(ui, /privateMode \? \[\] : readQueue\(\)/);
  assert.match(ui, /if \(!privateMode\) \{/);
  assert.doesNotMatch(ui, /fetch\(|sendBeacon|\/api\/feedback/);
  assert.match(ui, /Nothing is sent to a server/);
  assert.match(ui, /Download feedback for review/);
  assert.match(ui, /No librarian has been notified/);
  assert.match(ui, /export function SourceFeedbackProvider/);
  assert.match(ui, /useContext\(SourceFeedbackContext\)/);
  assert.match(ui, /privateMode \? queueRef.current/);
  assert.match(ui, /end the private session or the page reloads/);
  assert.doesNotMatch(ui, /private results view|results view closes/);
});
