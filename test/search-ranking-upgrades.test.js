import test from "node:test";
import assert from "node:assert/strict";
import { buildResearchSpec, researchSpecQuery, looseConcept } from "../config/researchSpec.js";
import { sourceQueryVariants } from "../config/searchQueries.js";
import { applyRerankScores, rerankSources, rerankEnabled } from "../server/sourceRerank.js";
import { expandSpecWithSuggestions, expandedSearchSpec, searchExpansionEnabled, clearSearchTermCache } from "../server/searchTermSuggestions.js";

test("extracted descriptive phrases are required words, not exact phrases", () => {
  assert.equal(researchSpecQuery(buildResearchSpec("effects of gentrification on long-term residents in Atlanta")), "gentrification AND (long-term AND residents) AND Atlanta");
  assert.match(researchSpecQuery(buildResearchSpec("remote learning during COVID and student achievement gaps")), /\(student AND achievement AND gaps\)/);
  assert.match(researchSpecQuery(buildResearchSpec("medieval plague and religious responses")), /\(religious AND responses\)/);
});

test("names, established two-word terms, vocabulary and quoted text stay exact", () => {
  assert.match(researchSpecQuery(buildResearchSpec("Toni Morrison and the theme of memory")), /"Toni Morrison"/);
  assert.equal(researchSpecQuery(buildResearchSpec("urban heat islands and public health")), '"urban heat islands" AND "public health"');
  assert.match(researchSpecQuery(buildResearchSpec('"student achievement gaps" after the pandemic')), /"student achievement gaps"/);
  assert.equal(looseConcept({ preferredTerm: "rent control", source: "parsed" }), false);
  assert.equal(looseConcept({ preferredTerm: "social media", source: "controlled-vocabulary" }), false);
  for (const query of sourceQueryVariants(buildResearchSpec("effects of gentrification on long-term residents in Atlanta"))) assert.doesNotMatch(query, /"long-term residents"/, query);
});

const records = Array.from({ length: 6 }, (_, index) => ({ title: `Record ${index + 1}`, type: "article", doi: `10.1/${index}` }));

test("re-ranking orders by score, keeps metadata order for ties, and never adds records", () => {
  const ordered = applyRerankScores(records, { scores: [{ i: 1, s: 1 }, { i: 2, s: 3 }, { i: 3, s: 0 }, { i: 4, s: 3 }, { i: 5, s: 2 }, { i: 6, s: 1 }, { i: 9, s: 3 }] });
  assert.deepEqual(ordered.map((record) => record.title), ["Record 2", "Record 4", "Record 5", "Record 1", "Record 6", "Record 3"]);
  assert.equal(ordered.length, records.length);
  assert.deepEqual(ordered[0].aiRelevance, { score: 3, scale: 3, method: "ai-rerank" });
  assert.equal(applyRerankScores(records, { scores: [{ i: 1, s: 3 }] }), null, "too few valid scores leaves the metadata order");
  assert.equal(applyRerankScores(records, { scores: records.map((_, i) => ({ i: i + 1, s: 9 })) }), null, "out-of-range scores are ignored");
});

test("re-ranking is skipped for known items, small pools, no key or the off switch, and survives provider failure", async () => {
  const spec = buildResearchSpec("ocean acidification and coral reefs");
  const env = { GEMINI_API_KEY: "k" };
  let calls = 0;
  const failing = async () => { calls += 1; throw new Error("down"); };
  assert.deepEqual((await rerankSources(records, buildResearchSpec("Find the book Beloved by Toni Morrison"), { env, fetchImpl: failing })).reranked, false);
  assert.equal((await rerankSources(records.slice(0, 2), spec, { env, fetchImpl: failing })).reranked, false);
  assert.equal(rerankEnabled({ GEMINI_API_KEY: "k", AI_RERANK: "off" }), false);
  assert.equal(rerankEnabled({}), false);
  assert.equal(calls, 0);
  const failed = await rerankSources(records, spec, { env, fetchImpl: failing });
  assert.equal(failed.reranked, false);
  assert.deepEqual(failed.results, records);
  const reply = { scores: records.map((_, i) => ({ i: i + 1, s: i === 5 ? 3 : 1 })) };
  const ok = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }) });
  const reranked = await rerankSources(records, spec, { env, fetchImpl: ok });
  assert.equal(reranked.reranked, true);
  assert.equal(reranked.results[0].title, "Record 6");
});

test("synonym expansion widens concepts without changing the brief's requirements", () => {
  const spec = buildResearchSpec("peer-reviewed studies since 2020 on sleep and memory, no meta-analyses");
  const expanded = expandSpecWithSuggestions(spec, { concepts: [{ term: "sleep", conceptId: spec.concepts[0].id, synonyms: ["sleep quality", "sleep duration"] }], related: [] });
  for (const field of ["topic", "mode", "methodRequirements", "sourceRequirements", "excludedTerms", "facets", "sourceContract", "safety"]) assert.deepEqual(expanded[field], spec[field], field);
  assert.ok(expanded.concepts[0].synonyms.includes("sleep quality"));
  assert.equal(expanded.searchExpansion, "full-synonyms");
  assert.notEqual(expanded.planHash, spec.planHash);
  assert.equal(expanded.correctedByStudent, undefined, "an automatic expansion is not a student correction");
});

test("synonym expansion is skipped for known items, without a key, or when switched off", async () => {
  clearSearchTermCache();
  assert.equal(searchExpansionEnabled({ GEMINI_API_KEY: "k", AI_SEARCH_EXPANSION: "off" }), false);
  assert.equal(await expandedSearchSpec(buildResearchSpec("Find the book Beloved by Toni Morrison"), { env: { GEMINI_API_KEY: "k" } }), null);
  assert.equal(await expandedSearchSpec(buildResearchSpec("sleep and memory"), { env: {} }), null);
  assert.equal(await expandedSearchSpec(buildResearchSpec("sleep and memory"), { env: { GEMINI_API_KEY: "k" }, fetchImpl: async () => { throw new Error("down"); } }), null, "a provider failure keeps the rules-based search");
});
