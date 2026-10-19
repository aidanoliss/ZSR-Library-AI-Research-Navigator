import test from "node:test";
import assert from "node:assert/strict";
import { whereToStart, sourceKey } from "../src/whereToStart.js";

const abstract = "This study examines the topic in detail using a large sample and reports outcomes across several settings and years.";
const match = (overrides = {}) => ({ type: "article", abstractText: abstract, matchExplanation: { status: "meets", category: "full-topic-match", missingConcepts: [] }, ...overrides });

test("picks only returned sources, at most three, each with a reason", () => {
  const results = [
    match({ title: "Study A", doi: "10.1/a", date: "2015" }),
    match({ title: "A systematic review of the topic", doi: "10.1/b", date: "2019" }),
    match({ title: "Newest study", doi: "10.1/c", date: "2026" }),
    match({ title: "Another study", doi: "10.1/d", date: "2018" }),
  ];
  const guide = whereToStart(results, { mode: "scholarly" }, { currentYear: 2026 });
  assert.equal(guide.picks.length, 3);
  assert.ok(guide.picks.every((pick) => results.some((result) => sourceKey(result) === pick.key) && pick.reason));
  assert.equal(guide.picks[0].title, "A systematic review of the topic", "an overview comes first when there is no comparison");
  assert.ok(guide.picks.some((pick) => /newest matches \(2026\)/.test(pick.reason)));
  assert.equal(guide.tip, "");
});

test("a direct comparison leads when the request compares two sides", () => {
  const spec = { mode: "scholarly", comparison: { terms: ["adolescent*", "older adults"] } };
  const guide = whereToStart([
    match({ title: "Loneliness in teens", doi: "1" }),
    match({ title: "Loneliness across the lifespan", doi: "2", matchExplanation: { status: "partial", category: "direct-comparison", missingConcepts: [] } }),
  ], spec);
  assert.equal(guide.picks[0].title, "Loneliness across the lifespan");
  assert.match(guide.picks[0].reason, /compares adolescent and older adults/);
});

test("thin or partial results produce an honest tip instead of false picks", () => {
  const partial = [match({ title: "Partial", doi: "p", matchExplanation: { status: "partial", category: "supporting", missingConcepts: ["safety"] } })];
  const guide = whereToStart(partial, { mode: "scholarly" });
  assert.deepEqual(guide.picks, []);
  assert.match(guide.tip, /None of these match every idea/);
  const noComparison = whereToStart([match({ title: "One side", doi: "x" })], { comparison: { terms: ["A", "B"] } });
  assert.match(noComparison.tip, /No result clearly compares both sides/);
  assert.equal(whereToStart([], {}), null);
});

test("excluded-topic mentions are never recommended", () => {
  const guide = whereToStart([match({ title: "Mentions excluded", doi: "e", matchExplanation: { status: "partial", category: "full-topic-match", missingConcepts: [], excludedMatches: [{ term: "tech", field: "abstract" }] } })], {});
  assert.deepEqual(guide.picks, []);
});

test("book searches point to a copy on the shelf", () => {
  const guide = whereToStart([match({ title: "Jazz history", url: "u", type: "book", fulfillment: { statusLabel: "Available when checked", location: "ZSR Main Stacks", callNumber: "ML3508 .T87" } })], { mode: "books" });
  assert.equal(guide.picks[0].reason, "On the shelf: ZSR Main Stacks, ML3508 .T87.");
});

test("an unfinished library search never presents a partial list as the best start", () => {
  const guide = whereToStart([match({ title: "Only result", doi: "o" })], {}, { incomplete: true });
  assert.deepEqual(guide.picks, []);
  assert.match(guide.tip, /didn't fully finish/);
});

test("a title that scopes a broad group establishes the population; listed keywords and proxies do not", async () => {
  const { buildResearchSpec } = await import("../config/researchSpec.js");
  const { assessSourceRequirements } = await import("../src/sourceAssessment.js");
  const spec = buildResearchSpec("social media and teen sleep");
  const status = (title) => assessSourceRequirements({ title, type: "article" }, spec).checks.find((check) => check.id === "population").status;
  assert.equal(status("Social media use and adolescent sleep patterns"), "meets");
  assert.equal(status("Sleep problems among teenagers who use TikTok"), "meets");
  assert.equal(status("Parents of adolescents and screen rules"), "unverified");
  assert.equal(status("Sleep: Canada, adolescents and trials"), "unverified");
});
