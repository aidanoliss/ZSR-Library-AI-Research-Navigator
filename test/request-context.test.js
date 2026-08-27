import test from "node:test";
import assert from "node:assert/strict";

import { appendRequestContextForAi, requestContextFromBody } from "../server/requestContext.js";

test("request metadata is sanitized separately from the student's topic", () => {
  const context = requestContextFromBody({
    assignmentContext: "  Use 8 peer-reviewed sources.  ",
    plannerContext: "  Last 5 years  ",
  });

  assert.deepEqual(context, {
    assignmentContext: "Use 8 peer-reviewed sources.",
    plannerContext: "Last 5 years",
    researchSpec: null,
  });
});

test("AI context is added to only the latest user turn without mutating search history", () => {
  const history = [
    { role: "user", content: "AI and cognitive offloading in college students" },
    { role: "assistant", content: "Let us narrow the topic." },
    { role: "user", content: "Find sources on memory reliance" },
  ];
  const original = structuredClone(history);

  const aiHistory = appendRequestContextForAi(history, {
    assignmentContext: "Course: PSY 250\nSource target: 8",
    plannerContext: "Time period: Last 5 years",
  });

  assert.deepEqual(history, original);
  assert.equal(aiHistory[0].content, history[0].content);
  assert.match(aiHistory[2].content, /^Find sources on memory reliance/);
  assert.match(aiHistory[2].content, /Guided planner choices/);
  assert.match(aiHistory[2].content, /Assignment brief/);
});

test("empty request context preserves the original history reference", () => {
  const history = [{ role: "user", content: "protein folding and disease" }];
  assert.equal(appendRequestContextForAi(history, {}), history);
});
