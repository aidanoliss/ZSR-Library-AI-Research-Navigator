import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const src = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("global accessibility styles preserve focus and reduced-motion preferences", async () => {
  const css = await src("src/styles.css");

  assert.match(css, /:focus-visible\s*\{/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation-duration:\s*0\.01ms\s*!important/);
});

test("handoff modal identifies itself, traps focus, supports Escape, and restores focus", async () => {
  const jsx = await src("src/HandoffModal.jsx");

  assert.match(jsx, /role="dialog"/);
  assert.match(jsx, /aria-modal="true"/);
  assert.match(jsx, /event\.key === "Escape"/);
  assert.match(jsx, /event\.key !== "Tab"/);
  assert.match(jsx, /previousFocusRef\.current\?\.focus/);
});

test("planner stays non-modal while exposing its changing question accessibly", async () => {
  const jsx = await src("src/App.jsx");

  assert.match(jsx, /className=\{`planner-modal/);
  assert.match(jsx, /role="region"/);
  assert.match(jsx, /aria-live="polite"/);
  assert.doesNotMatch(jsx, /planner-modal[\s\S]{0,300}aria-modal="true"/);
});

test("research workspace uses labeled dialog and tab semantics", async () => {
  const jsx = await src("src/ResearchWorkspace.jsx");

  assert.match(jsx, /aria-labelledby="research-workspace-title"/);
  assert.match(jsx, /role="tablist"/);
  assert.match(jsx, /role="tab"/);
  assert.match(jsx, /role="tabpanel"/);
  assert.match(jsx, /aria-selected=\{tab === item\.id\}/);
});

test("composer controls and asynchronous errors have accessible names and announcements", async () => {
  const app = await src("src/App.jsx");

  assert.match(app, /aria-label="Send topic"/);
  assert.match(app, /aria-label="Send follow-up"/);
  assert.match(app, /role="alert"/);
  assert.match(app, /role="status"\s+aria-live="polite"/);
});
