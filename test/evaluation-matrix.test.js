import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildResearchPlan } from "../config/researchAgent.js";
import {
  evaluatePilotCase,
  evaluatePilotSet,
  expandEvaluationMatrix,
  hashEvaluationPlan,
} from "../lib/pilotEvaluation.js";

const matrixUrl = new URL("../evals/evaluation-matrix.json", import.meta.url);
const loadedQuestionsUrl = new URL("../evals/loaded-question-review-set.json", import.meta.url);

function topOverlap(left, right, count = 3) {
  const a = new Set(left.slice(0, count));
  const b = new Set(right.slice(0, count));
  const denominator = Math.min(a.size, b.size);
  if (!denominator) return 0;
  return [...a].filter((id) => b.has(id)).length / denominator;
}

test("evaluation runner passes source mode and structured context to the plan builder", () => {
  let received = null;
  const fakePlan = {
    query: "archives and voting rights",
    modeId: "primary",
    subjectFocus: { id: "history-humanities", label: "History" },
    recommendations: [],
    otherStartingPoints: [],
    searchTerms: [],
    fallbacks: [],
  };
  evaluatePilotCase(
    {
      id: "mode-forwarding",
      discipline: "History",
      prompt: "archives and voting rights",
      mode: "primary",
      subjectFocusId: "history-humanities",
      context: { geography: "United States" },
      expected: { minRecommendations: 0, minVisibleSearchOptions: 0 },
    },
    {
      planBuilder: (...args) => {
        received = args;
        return fakePlan;
      },
    }
  );
  assert.deepEqual(received, [
    "archives and voting rights",
    6,
    "history-humanities",
    "primary",
    { geography: "United States" },
  ]);
});

test("evaluation matrix crosses disciplines, six governed modes, and paraphrases", async () => {
  const matrix = JSON.parse(await readFile(matrixUrl, "utf8"));
  const samples = expandEvaluationMatrix(matrix);
  const expectedModes = ["books", "data", "legal-policy", "news", "primary", "scholarly"];

  assert.ok(matrix.disciplines.length >= 3);
  assert.deepEqual(Object.keys(matrix.modes).sort(), expectedModes);
  assert.ok(matrix.disciplines.every((entry) => entry.prompts.length >= 3));
  assert.equal(
    samples.length,
    matrix.disciplines.reduce(
      (count, entry) => count + entry.prompts.length * expectedModes.length,
      0
    )
  );
});

test("mode-aware evaluation enforces routing order, query anchors, provenance, and safe failure", async () => {
  const matrix = JSON.parse(await readFile(matrixUrl, "utf8"));
  const samples = expandEvaluationMatrix(matrix);
  const results = samples.map((sample) => evaluatePilotCase(sample));
  const failed = results.flatMap((result) =>
    result.checks
      .filter((check) => !check.passed)
      .map((check) => `${result.id} / ${check.id}: ${check.detail}`)
  );

  assert.deepEqual(failed, []);
  assert.ok(results.every((result) => result.output.configVersion));
  assert.ok(results.every((result) => /^[a-z0-9][a-z0-9._:-]{7,127}$/i.test(result.output.planHash)));
  assert.ok(results.every((result) => /^[a-f0-9]{64}$/i.test(result.output.evaluationPlanHash)));
  assert.ok(results.every((result) => result.output.researchSpec));
  assert.ok(results.every((result) => result.output.sourceMode));
});

test("equivalent paraphrases retain at least two of the top three routes", async () => {
  const matrix = JSON.parse(await readFile(matrixUrl, "utf8"));
  const samples = expandEvaluationMatrix(matrix);
  const samplesById = new Map(samples.map((sample) => [sample.id, sample]));
  const results = samples.map((sample) => evaluatePilotCase(sample));
  const byGroup = new Map();
  for (const result of results) {
    const sample = samplesById.get(result.id);
    const group = byGroup.get(sample.metamorphicGroupId) || [];
    group.push(result.output.recommendationIds);
    byGroup.set(sample.metamorphicGroupId, group);
  }

  const failures = [];
  for (const [groupId, routes] of byGroup) {
    for (const variant of routes.slice(1)) {
      const overlap = topOverlap(routes[0], variant);
      if (overlap < 2 / 3) failures.push(`${groupId}: ${overlap.toFixed(2)}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("books and scholarly contracts differ while retaining disciplinary fit", async () => {
  const matrix = JSON.parse(await readFile(matrixUrl, "utf8"));
  for (const discipline of matrix.disciplines) {
    const prompt = discipline.prompts[0];
    const books = buildResearchPlan(prompt, 6, discipline.subjectFocusId, "books");
    const scholarly = buildResearchPlan(prompt, 6, discipline.subjectFocusId, "scholarly");
    const bookIds = books.recommendations.map((resource) => resource.id);
    const scholarlyIds = scholarly.recommendations.map((resource) => resource.id);
    assert.ok(bookIds.slice(0, 3).includes("primo"), `${discipline.id}: catalog missing from books top three`);
    assert.ok(
      scholarlyIds.slice(0, 3).some((id) => discipline.modeResourceIds.scholarly.includes(id)),
      `${discipline.id}: disciplinary article index missing from scholarly top three`
    );
    assert.notDeepEqual(bookIds.slice(0, 3), scholarlyIds.slice(0, 3));
  }
});

test("plan hashes are repeatable and automation never implies human approval", async () => {
  const matrix = JSON.parse(await readFile(matrixUrl, "utf8"));
  const samples = expandEvaluationMatrix(matrix).slice(0, 6);
  const first = buildResearchPlan(
    samples[0].prompt,
    6,
    samples[0].subjectFocusId,
    samples[0].mode
  );
  const second = buildResearchPlan(
    samples[0].prompt,
    6,
    samples[0].subjectFocusId,
    samples[0].mode
  );
  assert.equal(first.planHash, second.planHash);
  assert.equal(hashEvaluationPlan(first), hashEvaluationPlan(second));

  const report = evaluatePilotSet(samples);
  assert.equal(report.evidenceType, "automated-regression");
  assert.equal(report.summary.pendingHumanReviews, samples.length);
  assert.equal(report.summary.completedHumanReviews, 0);
  assert.equal(report.summary.humanApprovals, 0);
  assert.equal(report.summary.humanApprovalStatus, "not-human-approved");
});

test("every loaded-question case reports premise-check and safe-failure metadata", async () => {
  const samples = JSON.parse(await readFile(loadedQuestionsUrl, "utf8"));
  for (const sample of samples) {
    const plan = buildResearchPlan(sample.prompt, 6, "auto", sample.mode);
    assert.equal(plan.safety?.requiresPremiseCheck, true, `${sample.id}: premise check not activated`);
    assert.ok(plan.safety?.flags?.length, `${sample.id}: no machine-readable safety flag`);
    assert.equal(plan.safeFailure?.deterministicPlanAvailable, true, `${sample.id}: deterministic fallback not declared`);
    assert.equal(plan.safeFailure?.modelRequiredForRoutes, false, `${sample.id}: routes should not require the model`);
  }
});
