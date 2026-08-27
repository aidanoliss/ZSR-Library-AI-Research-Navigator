import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemInstruction, buildTurnPrompt } from "../server/gemini.js";
import { retrieveResources } from "../server/retrieve.js";
import { buildResearchPlan } from "../config/researchAgent.js";

const datasetUrl = new URL("../evals/loaded-question-review-set.json", import.meta.url);

test("loaded-question dataset covers distinct risk categories and routes to plausible evidence", async () => {
  const samples = JSON.parse(await readFile(datasetUrl, "utf8"));
  assert.ok(samples.length >= 8);
  assert.ok(new Set(samples.map((sample) => sample.category)).size >= 7);

  for (const sample of samples) {
    const resources = await retrieveResources(sample.prompt, 6, sample.mode, "auto");
    const ids = resources.map((resource) => resource.id);
    assert.ok(
      sample.acceptedResourceIds.some((id) => ids.includes(id)),
      `${sample.id} expected one of ${sample.acceptedResourceIds.join(", ")}; received ${ids.join(", ")}`
    );
  }
});

test("model instructions reject loaded premises and authoritative pseudo-consensus", () => {
  const system = buildSystemInstruction();
  const turn = buildTurnPrompt(
    "Why do social media platforms cause depression in every teenager?",
    [],
    true,
    "scholarly",
    "hybrid",
    "auto"
  );
  const instructions = `${system}\n${turn}`;
  assert.match(instructions, /research orientation, not a verdict/i);
  assert.match(instructions, /inspect the premise/i);
  assert.match(instructions, /correlation from causation/i);
  assert.match(instructions, /avoid false balance/i);
  assert.match(instructions, /numeric consensus\/confidence score/i);
});

test("books and article modes produce meaningfully different routes within disciplines", () => {
  const cases = [
    { topic: "trauma in postwar American novels", focus: "history-humanities", backgroundIds: ["project-muse", "jstor", "historical-abstracts"] },
    { topic: "moral responsibility and generative AI", focus: "history-humanities", backgroundIds: ["project-muse", "jstor", "historical-abstracts"] },
    { topic: "adolescent social media and depression", focus: "psychology", backgroundIds: ["project-muse", "jstor", "historical-abstracts"] },
  ];

  for (const sample of cases) {
    const books = buildResearchPlan(sample.topic, 6, sample.focus, "books");
    const articles = buildResearchPlan(sample.topic, 6, sample.focus, "scholarly");
    const bookIds = books.recommendations.map((resource) => resource.id);
    const articleIds = articles.recommendations.map((resource) => resource.id);

    assert.ok(bookIds.includes("primo"), `${sample.topic}: books mode should include the catalog`);
    assert.ok(
      bookIds.some((id) => sample.backgroundIds.includes(id)),
      `${sample.topic}: books mode should include a disciplinary books/background route`
    );
    assert.notDeepEqual(bookIds, articleIds, `${sample.topic}: source modes should not return identical routes`);
  }
});
