import test from "node:test";
import assert from "node:assert/strict";

import { buildResearchPlan } from "../config/researchAgent.js";
import { applySourceContract, transparentSourceFallback } from "../server/sourceContract.js";

test("Answer + sources always receives named routes, executable searches, and a relevance notice", () => {
  const topic = "Keynesian and Neoclassical economics";
  const plan = buildResearchPlan(topic, 6);
  const resources = plan.recommendations.map((resource) => ({
    id: resource.id,
    name: resource.name,
    type: resource.subjectArea,
    url: resource.accessUrl,
    description: resource.description,
    why: resource.whyFits,
    expect: resource.expect,
    recommended_query: resource.searchTerms[0],
    recommended_filters: resource.filters,
  }));
  const reply = applySourceContract(
    { message: "A direct comparison." },
    resources,
    plan,
    [{ title: "A source lead", sourceProvider: "ZSR discovery" }],
    "hybrid"
  );

  assert.equal(reply.starting_points.length, resources.length);
  assert.equal(reply.database_strategy.length, resources.length);
  assert.ok(reply.search_terms.length >= 3);
  assert.match(reply.source_notice, /may or may not be fully relevant/i);
  assert.equal(reply.starting_points[0].resource_name, "EconLit");
  assert.match(reply.database_strategy[0].search_inside[0], /Keynesian/i);
});

test("Crossref fallback sources are disclosed without implying ZSR access", () => {
  const plan = buildResearchPlan("authoritarian leaders and psychopathy", 4, "psychology");
  const reply = applySourceContract(
    { message: "A direct answer." },
    [],
    plan,
    [{ title: "A verified metadata lead", sourceProvider: "Crossref scholarly metadata" }],
    "hybrid"
  );

  assert.match(reply.source_notice, /Crossref bibliographic metadata/i);
  assert.match(reply.source_notice, /confirm relevance.*access/i);
});

test("hybrid AI failures are transparent instead of substituting a canned answer", () => {
  const fallback = transparentSourceFallback("hybrid");
  assert.match(fallback.message, /not substituted a canned response/i);
  assert.equal(transparentSourceFallback("answer"), null);
});
