import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFallbackSearches,
  buildFullTextWorkflow,
  buildGeneralStartingPoints,
  buildCatalogKeywordQuery,
  buildResearchPlan,
  buildSearchTermSuggestions,
  classifyResearchIntent,
  isSubstantiveResearchRequest,
  isZsrNavigationRequest,
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
    fallback: /keywords|Google Scholar/i,
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

test("AI and cognitive offloading uses psychology and education paths", () => {
  const plan = buildResearchPlan("AI and cognitive offloading in college students", 5);
  const ids = plan.recommendations.map((resource) => resource.id);

  assert.equal(plan.subjectFocus.id, "psychology");
  assert.ok(ids.includes("psycinfo"));
  assert.ok(ids.includes("eric"));
  assert.ok(ids.includes("web-of-science"));
  assert.deepEqual(ids.slice(0, 3), ["psycinfo", "web-of-science", "eric"]);
  assert.deepEqual(
    ids.filter((id) => ["business-guide", "mintel", "business-source"].includes(id)),
    []
  );
});

test("fallback searches avoid natural-language queries and broad concept dumps", () => {
  const fallbacks = buildFallbackSearches("Can you help me find sources about how AI affects cognitive offloading in students?");
  const text = fallbacks.map((fallback) => `${fallback.label}: ${fallback.text}`).join("\n");
  const broad = fallbacks.find((fallback) => /Broaden/.test(fallback.label));

  assert.match(text, /cognitive offloading|artificial intelligence|generative AI/i);
  assert.doesNotMatch(text, /Can you help me|how AI affects/i);
  assert.match(broad.text, /\bAND\b/i, "broaden fallback should retain an anchor concept");
  assert.doesNotMatch(broad.text, /\s+OR\s+/i, "broaden fallback should not dump unrelated broad concepts");
});

test("long declarative topics remain topics rather than known-item lookups", () => {
  const query = "Racial disparities in maternal mortality across rural southern communities";
  const intents = classifyResearchIntent(query).map((intent) => intent.id);
  const plan = buildResearchPlan(query, 5);

  assert.equal(intents.includes("known-item"), false);
  assert.equal(intents.includes("fulltext"), false);
  assert.equal(plan.subjectFocus.id, "biology-health");
  assert.equal(plan.strategy.isKnownItem, false);
  assert.ok(plan.recommendations.some((resource) => resource.id === "pubmed-medline"));
});

test("niche humanities topics use safe, evidence-backed paths", () => {
  const ids = recommendResources("Medieval Icelandic saga manuscript transmission", 6).map((resource) => resource.id);

  assert.deepEqual(ids, ["jstor", "primo", "research-guides"]);
  assert.deepEqual(
    ids.filter((id) => ["psycinfo", "eric", "communication-mass-media", "business-guide"].includes(id)),
    []
  );
});

test("unknown niche topics fall back without arbitrary specialist databases", () => {
  const plan = buildResearchPlan("typographic watermarks in privately printed almanacs", 6);
  const ids = plan.recommendations.map((resource) => resource.id);

  assert.deepEqual(ids, ["databases-az", "primo", "research-guides"]);
  assert.deepEqual(plan.otherStartingPoints.map((resource) => resource.id), ["ask-a-librarian"]);
  assert.equal(plan.otherStartingPoints[0].generalStartingPoint, true);
  assert.match(plan.otherStartingPoints[0].whyFits, /not an additional topic match/i);
});

test("general ZSR starting points stay separate from topic-matched recommendations", () => {
  const plan = buildResearchPlan("AI and cognitive offloading in college students", 5);
  const recommendedIds = new Set(plan.recommendations.map((resource) => resource.id));
  const otherIds = plan.otherStartingPoints.map((resource) => resource.id);

  assert.deepEqual(otherIds, ["databases-az", "primo", "research-guides"]);
  assert.ok(otherIds.every((id) => !recommendedIds.has(id)));
  assert.ok(plan.otherStartingPoints.every((resource) => resource.generalStartingPoint));
  assert.deepEqual(buildGeneralStartingPoints(plan.recommendations, 0), []);
});

test("mixed-discipline topics preserve both subject lenses", () => {
  const plan = buildResearchPlan("Mental health policy for college students", 5);
  const ids = plan.recommendations.map((resource) => resource.id);

  assert.match(plan.subjectFocus.label, /Psychology.*Policy/i);
  assert.ok(ids.includes("psycinfo"));
  assert.ok(ids.includes("heinonline") || ids.includes("cq-researcher"));
});

test("search-term suggestions keep core concepts and useful qualifiers", () => {
  const query = "Can you help me find sources about how AI affects cognitive offloading in older adults with dementia?";
  const terms = buildSearchTermSuggestions(query, ["How does AI affect memory in older adults?"], "auto", 8);
  const text = terms.join("\n");

  assert.match(text, /cognitive offloading/i);
  assert.match(text, /artificial intelligence|generative AI/i);
  assert.match(text, /older adults/i);
  assert.match(text, /dementia/i);
  assert.doesNotMatch(text, /Can you help me|How does/i);
  assert.match(buildCatalogKeywordQuery(query), /cognitive offloading/i);
});

test("follow-up request framing never leaks into generated search strings", () => {
  const query = "Find more source leads focused on memory reliance in undergraduates";
  const terms = buildSearchTermSuggestions(query, [], "psychology", 8);
  const text = terms.join("\n");

  assert.match(text, /memory reliance/i);
  assert.match(text, /undergraduates/i);
  assert.doesNotMatch(text, /\b(find|more|source|leads|focused)\b/i);
  assert.doesNotMatch(buildCatalogKeywordQuery(query, "psychology"), /\b(find|more|source|leads|focused)\b/i);
});

test("resource limits are bounded and never pad weak matches", () => {
  assert.deepEqual(recommendResources("protein folding and disease", 0), []);
  assert.deepEqual(recommendResources("protein folding and disease", -2), []);
  assert.equal(recommendResources("protein folding and disease", 2).length, 2);
  assert.ok(recommendResources("protein folding and disease", 20).length <= 4);
});

test("research plan exposes auto-detected subject focus", () => {
  const plan = buildResearchPlan("protein folding and disease", 5);

  assert.equal(plan.subjectFocus.id, "biology-health");
  assert.equal(plan.subjectFocus.autoDetected, true);
  assert.deepEqual(
    plan.recommendations.map((resource) => resource.id).filter((id) => ["business-guide", "mintel", "communication-mass-media"].includes(id)),
    []
  );
});

test("manual subject focus can steer ambiguous prompts", () => {
  const resources = recommendResources("misinformation and public trust", 5, "communication-media");
  const ids = resources.map((resource) => resource.id);
  const plan = buildResearchPlan("misinformation and public trust", 5, "communication-media");

  assert.equal(plan.subjectFocus.id, "communication-media");
  assert.equal(plan.subjectFocus.autoDetected, false);
  assert.ok(ids.includes("communication-mass-media"));
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

test("ZSR navigation is task based and never becomes a fake topic search", () => {
  const query = "Help me navigate ZSR";
  const plan = buildResearchPlan(query, 5);
  const ids = plan.recommendations.map((resource) => resource.id);
  const fallbackText = plan.fallbacks.map((fallback) => `${fallback.label}: ${fallback.text}`).join("\n");

  assert.equal(isZsrNavigationRequest(query), true);
  assert.equal(plan.navigationOnly, true);
  assert.deepEqual(ids, ["databases-az", "primo", "research-guides", "ask-a-librarian"]);
  assert.deepEqual(buildSearchTermSuggestions(query), []);
  assert.doesNotMatch(fallbackText, /navigate zsr|google scholar/i);
  assert.match(fallbackText, /A-Z Databases|ZSR Library Search|Ask ZSR/i);
});

test("surveillance and public trust receives focused paths and executable terms", () => {
  const query = "The impact of survelliance on citizens impact on trust";
  const plan = buildResearchPlan(query, 5);
  const ids = plan.recommendations.map((resource) => resource.id);
  const terms = buildSearchTermSuggestions(query).join("\n");

  assert.equal(isSubstantiveResearchRequest(query), true);
  assert.ok(ids.includes("socindex"));
  assert.ok(ids.includes("cq-researcher") || ids.includes("heinonline"));
  assert.doesNotMatch(ids.join(" "), /business-guide|mintel|science-direct/);
  assert.match(terms, /government surveillance|surveillance OR monitoring/i);
  assert.match(terms, /public trust|trust in government/i);
  assert.doesNotMatch(terms, /impact of|survelliance on citizens/i);
});

test("setup prompts are not treated as substantive research topics", () => {
  assert.equal(isSubstantiveResearchRequest("Help me navigate ZSR"), false);
  assert.equal(isSubstantiveResearchRequest("Help me research a topic"), false);
  assert.equal(isSubstantiveResearchRequest("government surveillance and public trust"), true);
});
