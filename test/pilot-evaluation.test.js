import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluatePilotCase,
  evaluatePilotSet,
  renderPilotEvaluationMarkdown,
  hashEvaluationPlan,
} from "../lib/pilotEvaluation.js";
import { buildResearchPlan } from "../config/researchAgent.js";
import { sourceQueryVariants } from "../config/searchQueries.js";

const datasetUrl = new URL("../evals/librarian-review-set.json", import.meta.url);

test("librarian evaluation set is broad and preserves blank human-review fields", async () => {
  const samples = JSON.parse(await readFile(datasetUrl, "utf8"));
  const disciplines = new Set(samples.map((sample) => sample.discipline));

  assert.ok(samples.length >= 40);
  assert.ok(disciplines.size >= 10);
  assert.ok(
    samples.every(
      (sample) =>
        sample.humanReview &&
        sample.humanReview.pathRelevance === null &&
        sample.humanReview.searchTermQuality === null &&
        sample.humanReview.catalogPrecision === null &&
        sample.humanReview.fallbackSafety === null
    )
  );
});

test("evaluation catches generic routes, duplicates, and natural-language searches", () => {
  const fakePlan = {
    subjectFocus: { id: "interdisciplinary", label: "General" },
    recommendations: [
      { id: "databases-az", name: "A-Z Databases", searchTerms: ["Can you find climate change?"] },
      { id: "academic-search-premier", name: "Academic Search Premier", searchTerms: ["Can you find climate change?"] },
    ],
    otherStartingPoints: [],
    searchTerms: ["Can you find climate change?"],
    fallbacks: [],
  };
  const result = evaluatePilotCase(
    {
      id: "test",
      discipline: "Science",
      prompt: "Climate change and biodiversity",
      expected: {
        acceptedResourceIds: ["web-of-science"],
        forbiddenResourceIds: [],
        expectedSubjectFocusIds: ["science-engineering"],
        minRecommendations: 1,
        maxRecommendations: 5,
        requiredConceptGroups: [["climate change"], ["biodiversity"]],
      },
    },
    { planBuilder: () => fakePlan }
  );

  const failedIds = result.checks
    .filter((check) => !check.passed)
    .map((check) => check.id);
  assert.ok(failedIds.includes("accepted-path"));
  assert.ok(failedIds.includes("no-generic-substantive-routes"));
  assert.ok(failedIds.includes("no-natural-language-searches"));
  assert.ok(failedIds.includes("no-visible-duplicates"));
});

test("governed primary query reuse in a database passes without hiding duplicate alternatives", () => {
  const baseline = buildResearchPlan("Sanctions and their impact on authoritarian regimes vs democracies", 5);
  const primary = sourceQueryVariants(baseline.researchSpec)[0];
  const plan = { ...baseline, recommendations: [{ id: "primo", name: "ZSR Library Search", searchTerms: [primary] }], otherStartingPoints: [], searchTerms: [primary], fallbacks: [] };
  const check = (value) => evaluatePilotCase({ id: "governed-reuse", prompt: baseline.query }, { planBuilder: () => value, allowSharedRecommendationQueries: true }).checks.find((entry) => entry.id === "no-visible-duplicates");
  assert.equal(check(plan).passed, true);
  assert.equal(check({ ...plan, searchTerms: [primary, primary] }).passed, false);
  assert.equal(check({ ...plan, recommendations: [{ ...plan.recommendations[0], searchTerms: [primary, primary] }] }).passed, false);
  assert.equal(check({ ...plan, fallbacks: [{ label: "Another alternative", query: primary }] }).passed, false);
  const unrelated = "random extra research modifier";
  assert.equal(check({ ...plan, recommendations: [{ ...plan.recommendations[0], searchTerms: [unrelated] }], searchTerms: [unrelated] }).passed, false);
});

test("actionable search moves count citation chaining and explicit recovery without manufactured queries", () => {
  const baseline = buildResearchPlan("Bilingual signage and museum visitor wayfinding", 5);
  const primary = sourceQueryVariants(baseline.researchSpec)[0];
  const plan = { ...baseline, recommendations: [{ id: "jstor", name: "JSTOR", searchTerms: [primary] }], otherStartingPoints: [], searchTerms: [primary], fallbacks: [
    { label: "Follow citations", text: "Open a relevant article's references and follow its cited-by list to find related research." },
    { label: "Revise the scope", text: "Edit the search to add a place or population only if your assignment requires it." },
  ] };
  const check = (value) => evaluatePilotCase({ id: "actionable-moves", prompt: "Bilingual signage and museum visitor wayfinding", expected: { minVisibleSearchOptions: 3 } }, { planBuilder: () => value }).checks.find((entry) => entry.id === "enough-search-options");
  assert.equal(check(plan).passed, true);
  // Repeating a primary query, a recovery instruction, or vague advice does
  // not manufacture extra search moves to satisfy the count.
  assert.equal(check({ ...plan, searchTerms: [primary, primary], fallbacks: [plan.fallbacks[0], plan.fallbacks[0], { label: "Keep going", text: "Try harder." }] }).passed, false);
});

test("evaluation report is deterministic in structure and explicit about human review", async () => {
  const samples = JSON.parse(await readFile(datasetUrl, "utf8"));
  const report = evaluatePilotSet(samples.slice(0, 3));
  const markdown = renderPilotEvaluationMarkdown(report);

  assert.equal(report.summary.cases, 3);
  assert.match(markdown, /not librarian approval/i);
  assert.match(markdown, /Human Review Rubric/);
  assert.match(markdown, /Recommended paths/);
});

test("every recommended query must retain concepts even when another query has them", () => {
  const result = evaluatePilotCase({
    id: "split-concepts", prompt: "tree canopy and neighborhood temperatures",
    expected: { requiredConceptGroups: [["tree canopy"], ["temperatures"]], requireConceptsInEveryRecommendation: false },
  }, { planBuilder: () => ({
    recommendations: [{ id: "one", name: "One", searchTerms: ["tree canopy"] }, { id: "two", name: "Two", searchTerms: ["temperatures"] }],
    otherStartingPoints: [], subjectFocus: { id: "interdisciplinary" }, searchTerms: [], fallbacks: [],
  }) });
  assert.equal(result.checks.find((check) => check.id === "topic-anchors").passed, true);
  assert.equal(result.checks.find((check) => check.id === "per-query-concept-retention").passed, false);
});

test("human approval requires an identified review of this exact plan and configuration", () => {
  const sample = { id: "review-binding-fixture", prompt: "thermal insulation and indoor humidity" };
  const plan = buildResearchPlan(sample.prompt, 6, "auto", "scholarly", {});
  const humanReview = { pathRelevance: 4, searchTermQuality: 4, catalogPrecision: 4, fallbackSafety: 4, approvalStatus: "approved" };
  assert.equal(evaluatePilotCase({ ...sample, humanReview }).reviewState.completed, false);
  const receipt = { ...humanReview, reviewer: "Synthetic test reviewer", reviewedAt: "2026-09-15T12:00:00Z", evaluationPlanHash: hashEvaluationPlan(plan), configVersion: plan.configVersion };
  assert.equal(evaluatePilotCase({ ...sample, humanReview: receipt }).reviewState.approvalStatus, "approved");
  for (const changed of [{ ...receipt, evaluationPlanHash: "old-plan" }, { ...receipt, configVersion: "old-config" }]) {
    const result = evaluatePilotCase({ ...sample, humanReview: changed });
    assert.equal(result.reviewState.approvalStatus, "not-granted");
    assert.equal(result.reviewState.status, "stale-human-review");
  }
  const amended = structuredClone(plan);
  amended.otherStartingPoints.push({ id: "changed-path", why: "Changed reviewable advice" });
  assert.notEqual(hashEvaluationPlan(plan), hashEvaluationPlan(amended));
});
