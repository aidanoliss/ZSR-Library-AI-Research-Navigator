import test from "node:test";
import assert from "node:assert/strict";

import {
  addResearchItem,
  addSearchHistoryEntry,
  assignmentContext,
  createResearchWorkspace,
  normalizeResearchWorkspace,
  workspaceToMarkdown,
} from "../src/researchWorkspace.js";

test("research workspace defaults to local assignment, trail, and history state", () => {
  const workspace = normalizeResearchWorkspace(null);
  assert.equal(workspace.assignment.enabled, true);
  assert.deepEqual(workspace.trail, []);
  assert.deepEqual(workspace.searchHistory, []);
});

test("saved research leads are deduplicated by kind and URL", () => {
  const first = addResearchItem(createResearchWorkspace(), {
    kind: "catalog",
    title: "Useful article",
    url: "https://example.com/item/",
  }, 100);
  const duplicate = addResearchItem(first, {
    kind: "catalog",
    title: "Duplicate label",
    url: "https://example.com/item",
  }, 200);
  assert.equal(duplicate.trail.length, 1);
  assert.equal(duplicate.trail[0].status, "promising");
});

test("search history records repeated searches as one updated entry", () => {
  const first = addSearchHistoryEntry(createResearchWorkspace(), {
    query: "cognitive offloading AND students",
    tool: "Google Scholar",
  }, 100);
  const repeated = addSearchHistoryEntry(first, {
    query: "cognitive offloading AND students",
    tool: "Google Scholar",
  }, 200);
  assert.equal(repeated.searchHistory.length, 1);
  assert.equal(repeated.searchHistory[0].usedAt, 200);
});

test("assignment context includes only enabled, populated constraints", () => {
  const workspace = createResearchWorkspace();
  workspace.assignment.course = "FYS 100";
  workspace.assignment.sourceCount = "6";
  const context = assignmentContext(workspace.assignment);
  assert.match(context, /Course: FYS 100/);
  assert.match(context, /Source target: 6/);
  workspace.assignment.enabled = false;
  assert.equal(assignmentContext(workspace.assignment), "");
});

test("workspace export includes brief, saved items, and searches", () => {
  let workspace = createResearchWorkspace();
  workspace.assignment.assignmentType = "Literature review";
  workspace = addResearchItem(workspace, { kind: "database", title: "PsycINFO", url: "https://example.com/psycinfo" }, 100);
  workspace = addSearchHistoryEntry(workspace, { query: "social media AND adolescents", tool: "ZSR Articles" }, 200);
  const markdown = workspaceToMarkdown(workspace, "Social media and adolescent mental health");
  assert.match(markdown, /Assignment brief/);
  assert.match(markdown, /PsycINFO/);
  assert.match(markdown, /social media AND adolescents/);
});
