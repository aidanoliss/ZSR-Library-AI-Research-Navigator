import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFullTextWorkflow,
  buildResearchPlan,
  classifyResearchIntent,
  recommendResources,
} from "../config/researchAgent.js";

const cases = [
  {
    query: "I need background on AI and education",
    intent: "books",
    resource: "eric",
    fallback: /Broaden|Google Scholar|citation chaining/i,
  },
  {
    query: "I need market data on energy drinks",
    intent: "market",
    resource: "mintel",
    fallback: /database names/i,
  },
  {
    query: "I need statistics on college student mental health",
    intent: "statistics",
    resource: "icpsr",
    fallback: /Broaden|Google Scholar/i,
  },
  {
    query: "I need news coverage of the war in Ukraine",
    intent: "news",
    resource: "factiva",
    fallback: /Google Scholar|exact phrase/i,
  },
  {
    query: "I need scholarly articles on social media and loneliness",
    intent: "scholarly",
    resource: "psycinfo",
    fallback: /citation chaining/i,
  },
  {
    query: "I need a citation for a website in APA",
    intent: "citation",
    resource: "research-guides",
    fallback: /exact phrase/i,
  },
  {
    query: "I need full text for this DOI 10.1001/jama.2004.1635",
    intent: "fulltext",
    resource: "pubmed-medline",
    fallback: /Google Scholar/i,
  },
  {
    query: "I searched Primo and got nothing for Rolex watches",
    intent: "market",
    resource: "mintel",
    fallback: /Broaden|database names/i,
  },
  {
    query: "Where do I find company financials?",
    intent: "market",
    resource: "mergent",
    fallback: /database names/i,
  },
  {
    query: "I need sources for a policy memo",
    intent: "legal",
    resource: "cq-researcher",
    fallback: /Google Scholar|citation chaining/i,
  },
];

test("research intent router covers less-primary-source-focused queries", () => {
  for (const sample of cases) {
    const plan = buildResearchPlan(sample.query, 5);
    const intentIds = plan.intents.map((intent) => intent.id);
    const resourceIds = plan.recommendations.map((resource) => resource.id);
    const fallbackText = plan.fallbacks.map((fallback) => `${fallback.label} ${fallback.text}`).join(" ");

    assert.ok(intentIds.includes(sample.intent), `${sample.query} should include intent ${sample.intent}`);
    assert.ok(resourceIds.includes(sample.resource), `${sample.query} should recommend ${sample.resource}`);
    assert.match(fallbackText, sample.fallback, `${sample.query} should include a fallback path`);
    assert.ok(plan.strategy.betterTerms.length > 0, `${sample.query} should generate better terms`);
  }
});

test("recommendations avoid unsupported access guarantees", () => {
  const plan = buildResearchPlan("I need full text for this DOI 10.1001/jama.2004.1635", 5);
  const text = JSON.stringify(plan).toLowerCase();
  assert.doesNotMatch(text, /definitely has access|guaranteed full text|we have access|download the pdf directly/);
  assert.ok(buildFullTextWorkflow(plan.query).installLink.includes("chromewebstore.google.com"));
});

test("protein and disease topics only show related biomedical ZSR paths", () => {
  const resources = recommendResources("protein folding and disease", 5);
  const ids = resources.map((resource) => resource.id);

  assert.ok(ids.includes("pubmed-medline"));
  assert.ok(ids.includes("web-of-science"));
  assert.ok(ids.includes("science-direct"));
  assert.ok(ids.length <= 4, "do not pad the path list with weak matches");
  assert.deepEqual(
    ids.filter((id) => ["business-guide", "mintel", "business-source", "communication-mass-media"].includes(id)),
    []
  );
});

test("business paths still appear for actual market research prompts", () => {
  const ids = recommendResources("market data on energy drinks", 5).map((resource) => resource.id);

  assert.ok(ids.includes("business-guide"));
  assert.ok(ids.includes("mintel"));
  assert.ok(ids.includes("statista"));
});

test("citation and known-item routing are explicit", () => {
  const intents = classifyResearchIntent("Kessler RC prevalence severity unmet need treatment mental disorders JAMA 2004");
  assert.ok(intents.some((intent) => intent.id === "known-item" || intent.id === "fulltext"));

  const resources = recommendResources("I need a citation for a website in APA", 5).map((resource) => resource.id);
  assert.ok(resources.includes("research-guides"));
});
