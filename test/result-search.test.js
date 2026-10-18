import test from "node:test";
import assert from "node:assert/strict";
import { reviseSearchTopic, searchRunStatus } from "../src/resultSearch.js";
import { buildResearchSpec, researchSpecQuery } from "../config/researchSpec.js";

test("editing the topic rebuilds old concepts while retaining assignment requirements", () => {
  const current = buildResearchSpec("AI and cognitive offloading", { modeId: "scholarly" });
  current.sourceRequirements = { publicationYearFrom: 2020, publicationYearTo: null, peerReviewed: true, requestedSourceCount: 6 };
  const updated = reviseSearchTopic("Urban trees and summer temperatures", current);
  assert.deepEqual(updated.sourceRequirements, current.sourceRequirements);
  assert.doesNotMatch(JSON.stringify(updated.concepts), /cognitive|offloading/i);
  assert.match(JSON.stringify(updated.concepts), /trees|temperatures/i);
});

test("explicit topic-bar requirements update only the named fields", () => {
  const current = { mode: "scholarly", sourceRequirements: { publicationYearFrom: 2020, publicationYearTo: null, peerReviewed: true, requestedSourceCount: 6 } };
  const updated = reviseSearchTopic("Urban heat, sources published since 2024", current);
  assert.equal(updated.sourceRequirements.publicationYearFrom, 2024);
  assert.equal(updated.sourceRequirements.peerReviewed, true);
  assert.equal(updated.sourceRequirements.requestedSourceCount, 6);
});

test("conflicting edited date requirements are rejected before running a search", () => {
  assert.throws(() => reviseSearchTopic("Urban heat published since 2024", { mode: "scholarly", sourceRequirements: { publicationYearTo: 2022 } }), /starting year/);
});

test("review timing distinguishes provider failures, empty searches, and planning-only requests", () => {
  const discovery = (outcome) => ({ lanes: { library: { requested: true, outcome } } });
  assert.equal(searchRunStatus({ sourceDiscovery: discovery("timeout"), liveResults: [] }), "provider_error");
  assert.equal(searchRunStatus({ sourceDiscovery: discovery("partial"), liveResults: [{}] }), "partial");
  assert.equal(searchRunStatus({ sourceDiscovery: discovery("empty"), liveResults: [] }), "empty");
  assert.equal(searchRunStatus({ sourceDiscovery: discovery("success"), liveResults: [{}] }), "complete");
  assert.equal(searchRunStatus({ liveResults: [] }), "not_searched");
});

test("prompt refinement retains the full request and adds only user-supplied scope", async () => {
  const { improveResearchPrompt } = await import("../src/resultSearch.js");
  const topic = "Compare economic sanctions in authoritarian regimes versus democracies since 2000";
  assert.equal(improveResearchPrompt(topic), topic);
  assert.equal(improveResearchPrompt("", { geography: "Canada" }), "");
  const prompt = improveResearchPrompt(topic, { geography: "Canada", method: "systematic reviews" });
  assert.equal(prompt, `${topic}\nin Canada\nusing systematic reviews`);
  assert.doesNotMatch(prompt, /Population:|United States|randomized/i);
  const current = buildResearchSpec(topic);
  current.sourceRequirements = { peerReviewed: true, publicationYearFrom: 2020, publicationYearTo: null, requestedSourceCount: 5 };
  const revised = reviseSearchTopic(prompt, current);
  assert.deepEqual(revised.sourceRequirements, current.sourceRequirements);
  assert.match(revised.facets.geography, /Canada/i);
  assert.match(revised.facets.method, /systematic/i);
  assert.doesNotMatch(researchSpecQuery(revised), /\b(?:Location|Study|method|using)\b/i);
});
