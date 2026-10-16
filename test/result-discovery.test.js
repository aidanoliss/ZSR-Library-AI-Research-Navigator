import test from "node:test";
import assert from "node:assert/strict";
import { buildResultQueryOptions, resultQueryFilters } from "../src/resultDiscovery.js";
import { buildResearchSpec, researchFacetExpressions } from "../config/researchSpec.js";
import { validateCompiledQuery } from "../config/queryCompiler.js";

test("result query variants preserve comparison groups, method exclusions, and assignment filters", () => {
  const spec = buildResearchSpec("Sanctions and their impact on authoritarian regimes vs democracies. I do not want systematic reviews.", { modeId: "scholarly" });
  spec.sourceRequirements = { peerReviewed: true, publicationYearFrom: 2020, publicationYearTo: 2026 };
  const before = JSON.stringify(spec);
  const options = buildResultQueryOptions(spec);
  assert.ok(options.length >= 3);
  for (const { query } of options) {
    assert.equal(validateCompiledQuery(query, spec).valid, true, query);
    for (const facet of researchFacetExpressions(spec)) assert.ok(query.includes(facet), query);
    assert.match(query, /sanctions/i);
    assert.match(query, /\(.*authoritarian.* OR .*democrac.*\)/i);
    assert.match(query, /NOT .*systematic/i);
  }
  assert.deepEqual(resultQueryFilters(spec), ["Peer-reviewed sources", "Published 2020–2026"]);
  assert.equal(JSON.stringify(spec), before, "presentation cannot mutate the reviewed interpretation");
});

test("explicit phrases are not relaxed or synonym-expanded", () => {
  const spec = { concepts: [
    { id: "a", preferredTerm: "social media", exactPhrase: true, synonyms: ["social platforms"], required: true },
    { id: "b", preferredTerm: "college students", synonyms: ["undergraduates"], required: true },
  ], facets: { geography: "North Carolina" } };
  const options = buildResultQueryOptions(spec);
  assert.ok(options.length > 1);
  for (const { query } of options) {
    assert.match(query, /"social media"/);
    assert.doesNotMatch(query, /social platforms/);
    assert.match(query, /"North Carolina"/);
    assert.ok(query.includes('"college students"') || query.includes('(college AND students)'));
  }
});

test("variants are unique and use only vocabulary already in the brief", () => {
  const options = buildResultQueryOptions({ concepts: [{ id: "a", preferredTerm: "coral", synonyms: [] }] });
  assert.deepEqual(options.map((option) => option.query), ["coral"]);
  assert.deepEqual(buildResultQueryOptions(null), []);
});

test("known title and author remain a single exact lookup", () => {
  const options = buildResultQueryOptions({ knownItem: { title: "The Origins of Totalitarianism", author: "Hannah Arendt" } });
  assert.deepEqual(options.map((option) => option.query), ['"The Origins of Totalitarianism" AND "Hannah Arendt"']);
});

test("results jump links exist only for sections with renderable content", async () => {
  const { resultSectionLinks } = await import("../src/resultDiscovery.js");
  assert.deepEqual(resultSectionLinks({ id: "r1" }), []);
  assert.deepEqual(resultSectionLinks({ id: "r1", showSources: true }), [{ label: "Sources", href: "#r1-sources" }]);
  assert.deepEqual(resultSectionLinks({ id: "r2", plan: { navigationOnly: true, recommendations: [{ name: "Ask ZSR", url: "https://zsr.wfu.edu/ask/" }] } }), [{ label: "ZSR resources", href: "#r2-databases" }]);
  const spec = { concepts: [{ id: "a", preferredTerm: "coral" }] };
  assert.deepEqual(resultSectionLinks({ id: "r3", spec, plan: { recommendations: [{ name: "Missing access URL" }] } }), [{ label: "Search terms", href: "#r3-terms" }]);
});
