import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluatePilotCase,
  evaluatePilotSet,
  renderPilotEvaluationMarkdown,
} from "../lib/pilotEvaluation.js";

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

test("evaluation report is deterministic in structure and explicit about human review", async () => {
  const samples = JSON.parse(await readFile(datasetUrl, "utf8"));
  const report = evaluatePilotSet(samples.slice(0, 3));
  const markdown = renderPilotEvaluationMarkdown(report);

  assert.equal(report.summary.cases, 3);
  assert.match(markdown, /not librarian approval/i);
  assert.match(markdown, /Human Review Rubric/);
  assert.match(markdown, /Recommended paths/);
});
