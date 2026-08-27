import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFallbackSearches,
  buildFullTextWorkflow,
  buildGeneralStartingPoints,
  buildCatalogKeywordQuery,
  buildCatalogSearchQueries,
  buildResearchPlan,
  buildSearchTermSuggestions,
  classifyResearchIntent,
  isSubstantiveResearchRequest,
  isZsrNavigationRequest,
  normalizeSearchOptionKey,
  recommendResources,
} from "../config/researchAgent.js";

const cases = [
  {
    query: "I need background on AI and education",
    intent: "books",
    resource: "eric",
    fallback: /Too many|Too few|Google Scholar|citation chaining/i,
  },
  {
    query: "I need market data on energy drinks",
    intent: "market",
    resource: "mintel",
    fallback: /Too many|Too few|Switch databases|Google Scholar/i,
  },
  {
    query: "I need statistics on college student mental health",
    intent: "statistics",
    resource: "icpsr",
    fallback: /Too many|Too few|Google Scholar/i,
  },
  {
    query: "I need news coverage of the war in Ukraine",
    intent: "news",
    resource: "factiva",
    fallback: /Too many|Too few|Google Scholar/i,
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
    fallback: /Google Scholar|citation chaining/i,
  },
  {
    query: "I need full text for this DOI 10.1001/jama.2004.1635",
    intent: "fulltext",
    resource: "pubmed-medline",
    fallback: /Google Scholar|citation chaining/i,
  },
  {
    query: "I searched Primo and got nothing for Rolex watches",
    intent: "market",
    resource: "mintel",
    fallback: /Too many|Too few|Switch databases|Google Scholar/i,
  },
  {
    query: "Where do I find company financials?",
    intent: "market",
    resource: "mergent",
    fallback: /Switch databases|Google Scholar|citation chaining/i,
  },
  {
    query: "I need sources for a policy memo",
    intent: "legal",
    resource: "cq-researcher",
    fallback: /Too many|Too few|Google Scholar|citation chaining/i,
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
  assert.ok(ids.includes("education-source"));
  assert.ok(ids.includes("web-of-science"));
  assert.equal(ids[0], "psycinfo");
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
  assert.match(broad.text, /cognitive offloading|external memory/i, "broaden fallback should vary one controlled concept");
  assert.match(broad.text, /artificial intelligence|\bAI\b/i, "broaden fallback should retain the other core concept");
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

  assert.equal(ids[0], "historical-abstracts");
  assert.deepEqual(
    [...ids].sort(),
    ["jstor", "historical-abstracts", "project-muse", "academic-search-premier"].sort()
  );
  assert.deepEqual(
    ids.filter((id) => ["psycinfo", "eric", "communication-mass-media", "business-guide"].includes(id)),
    []
  );
});

test("niche print-culture topics receive named databases instead of navigation pages", () => {
  const plan = buildResearchPlan("typographic watermarks in privately printed almanacs", 6);
  const ids = plan.recommendations.map((resource) => resource.id);

  assert.deepEqual(ids, ["historical-abstracts", "jstor", "project-muse", "academic-search-premier"]);
  assert.ok(plan.recommendations.every((resource) => resource.searchTerms.length === 1));
  assert.ok(plan.recommendations.every((resource) => resource.filters.length >= 3));
  assert.doesNotMatch(ids.join(" "), /databases-az|research-guides|ask-a-librarian|business-guide/);
});

test("secondary starting points are named databases, never generic navigation routes", () => {
  const plan = buildResearchPlan("AI and cognitive offloading in college students", 5);
  const recommendedIds = new Set(plan.recommendations.map((resource) => resource.id));
  const secondary = buildGeneralStartingPoints(plan.recommendations, 3, "psychology", plan.query);
  const otherIds = secondary.map((resource) => resource.id);

  assert.ok(otherIds.length > 0);
  assert.ok(otherIds.every((id) => !recommendedIds.has(id)));
  assert.doesNotMatch(otherIds.join(" "), /databases-az|primo|research-guides|ask-a-librarian|business-guide/);
  assert.ok(secondary.every((resource) => resource.generalStartingPoint));
  assert.deepEqual(buildGeneralStartingPoints(plan.recommendations, 0), []);
});

test("mixed-discipline topics preserve both subject lenses", () => {
  const plan = buildResearchPlan("Mental health policy for college students", 5);
  const ids = plan.recommendations.map((resource) => resource.id);

  assert.match(plan.subjectFocus.label, /Psychology.*Policy/i);
  assert.ok(ids.includes("psycinfo"));
  assert.ok(ids.includes("heinonline") || ids.includes("cq-researcher") || ids.includes("proquest-political-science"));
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

  assert.ok(ids.includes("mintel"));
  assert.ok(ids.includes("statista"));
  assert.ok(ids.includes("business-source"));
  assert.doesNotMatch(ids.join(" "), /business-guide|databases-az|research-guides/);
});

test("citation and known-item routing are explicit", () => {
  const intents = classifyResearchIntent("Kessler RC prevalence severity unmet need treatment mental disorders JAMA 2004");
  assert.ok(intents.some((intent) => intent.id === "known-item" || intent.id === "fulltext"));

  const resources = recommendResources("I need a citation for a website in APA", 5).map((resource) => resource.id);
  assert.ok(resources.includes("research-guides"));
});

test("known-item book requests preserve the exact title and author", () => {
  const query = "Find the book The Warmth of Other Suns by Isabel Wilkerson";
  const exact = '"The Warmth of Other Suns" AND "Isabel Wilkerson"';
  const plan = buildResearchPlan(query, 5, "auto", "books");

  assert.equal(plan.modeId, "books");
  assert.equal(plan.strategy.isKnownItem, true);
  assert.deepEqual(plan.researchSpec.knownItem, {
    kind: "book",
    title: "The Warmth of Other Suns",
    author: "Isabel Wilkerson",
  });
  assert.deepEqual(
    plan.researchSpec.concepts.map((concept) => concept.preferredTerm),
    ["The Warmth of Other Suns", "Isabel Wilkerson"]
  );
  assert.equal(plan.recommendations.find((resource) => resource.id === "primo")?.searchTerms[0], exact);
  assert.equal(buildCatalogSearchQueries(query, "auto", 5, "books")[0], exact);
  assert.doesNotMatch(JSON.stringify(plan), /book Warmth Other Suns Isabel|case study/i);
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

test("substantive plans never use generic navigation pages as database recommendations", () => {
  const queries = [
    "AI and cognitive offloading in college students",
    "protein folding and disease",
    "market data on energy drinks",
    "typographic watermarks in privately printed almanacs",
    "misinformation and public trust",
    "quantum sensors for precision agriculture",
  ];
  const blocked = new Set(["databases-az", "research-guides", "ask-a-librarian", "business-guide"]);

  for (const query of queries) {
    const plan = buildResearchPlan(query, 5);
    assert.ok(plan.recommendations.length > 0, `${query} should have at least one named database`);
    for (const resource of plan.recommendations) {
      assert.equal(blocked.has(resource.id), false, `${query} should not recommend ${resource.id}`);
      assert.equal(resource.searchTerms.length, 1, `${resource.name} should have one assigned query`);
      assert.ok(resource.filters.length >= 3, `${resource.name} should have database-specific filters`);
      assert.doesNotMatch(resource.name, /A-Z Databases|Research Guides|Business Information Commons|Ask ZSR/i);
      if (resource.accessUrl.includes("az.php")) {
        const url = new URL(resource.accessUrl);
        assert.ok(url.searchParams.get("q"), `${resource.name} should link to its exact A-Z lookup`);
      }
    }
  }
});

test("shared database queries stay valid while non-database search moves remain distinct", () => {
  const queries = [
    "AI and cognitive offloading in college students",
    "protein folding and disease",
    "market data on energy drinks",
    "typographic watermarks in privately printed almanacs",
    "misinformation and public trust",
  ];

  for (const query of queries) {
    const plan = buildResearchPlan(query, 5);
    assert.ok(plan.recommendations.every((resource) => resource.queryValidation?.valid));
    const options = [
      ...plan.searchTerms,
      ...plan.fallbacks.map((fallback) => fallback.query).filter(Boolean),
    ];
    const keys = options.map(normalizeSearchOptionKey);
    assert.equal(new Set(keys).size, keys.length, `${query} should not repeat a generic or fallback move`);
  }
});

test("search-option normalization treats reordered Boolean concepts as duplicates", () => {
  assert.equal(
    normalizeSearchOptionKey('"book history" AND watermark*'),
    normalizeSearchOptionKey('watermark* AND ("book history")')
  );
  assert.equal(
    normalizeSearchOptionKey('(misinformation OR disinformation) AND "public trust"'),
    normalizeSearchOptionKey('"public trust" AND (disinformation OR misinformation)')
  );
});

test("fallback actions are anchored, distinct, and never search for database names", () => {
  const plan = buildResearchPlan("AI and cognitive offloading in college students", 5);
  const fallbackText = plan.fallbacks.map((fallback) => `${fallback.label}: ${fallback.text}`).join("\n");

  assert.match(fallbackText, /Too many irrelevant results|Too few results|Google Scholar/i);
  assert.doesNotMatch(fallbackText, /Search likely database names|Start with keywords, not a sentence/i);
  assert.doesNotMatch(fallbackText, /Can you help me|How does|I need/i);
  assert.ok(plan.fallbacks.filter((fallback) => fallback.query).every((fallback) => /\bAND\b/i.test(fallback.query)));
});

test("biodiversity and climate recovery searches keep both concepts without pollinator contamination", () => {
  const query = "how biodiversity impacts the climate change";
  const plan = buildResearchPlan(query, 5);
  const databaseSearches = plan.recommendations.flatMap((resource) => resource.searchTerms);
  const secondaryDatabaseSearches = plan.otherStartingPoints.flatMap((resource) => resource.searchTerms);
  const fallbackSearches = plan.fallbacks.map((fallback) => fallback.query).filter(Boolean);
  const visibleSearches = [...databaseSearches, ...secondaryDatabaseSearches, ...fallbackSearches, ...plan.searchTerms];
  const nonDatabaseKeys = [...fallbackSearches, ...plan.searchTerms].map(normalizeSearchOptionKey);

  assert.deepEqual(
    plan.recommendations.map((resource) => resource.id),
    ["web-of-science", "science-direct", "academic-search-premier"]
  );
  assert.ok(fallbackSearches.length >= 4);
  assert.ok(fallbackSearches.every((term) => /biodivers|species richness/i.test(term)));
  assert.ok(fallbackSearches.every((term) => /climate|carbon sequestration/i.test(term)));
  assert.equal(new Set(nonDatabaseKeys).size, nonDatabaseKeys.length);
  assert.doesNotMatch(visibleSearches.join(" "), /pollinat|community ecology|disease mechanism|health outcomes/i);
});

test("climate resilience phrasing uses the biodiversity-climate profile", () => {
  const query = "How does biodiversity affect climate resilience? Suggest focused research angles, named ZSR databases, executable search terms, and relevant sources.";
  const plan = buildResearchPlan(query, 5);
  const visibleSearches = [
    ...plan.recommendations.flatMap((resource) => resource.searchTerms),
    ...plan.otherStartingPoints.flatMap((resource) => resource.searchTerms),
    ...plan.fallbacks.map((fallback) => fallback.query).filter(Boolean),
    ...plan.searchTerms,
  ];

  assert.deepEqual(
    plan.recommendations.map((resource) => resource.id),
    ["web-of-science", "science-direct", "academic-search-premier"]
  );
  assert.ok(visibleSearches.every((term) => /biodivers|biological diversity|species diversity|species richness|ecosystem diversity/i.test(term)));
  assert.ok(visibleSearches.every((term) => /climate|carbon sequestration/i.test(term)));
  assert.doesNotMatch(visibleSearches.join(" "), /disease mechanism|health outcomes|pollinat/i);
});

test("general biodiversity searches do not invent a pollinator subtopic", () => {
  const plan = buildResearchPlan("biodiversity loss in protected areas", 5);
  const visibleText = [
    ...plan.recommendations.flatMap((resource) => resource.searchTerms),
    ...plan.fallbacks.map((fallback) => fallback.query).filter(Boolean),
    ...plan.searchTerms,
  ].join(" ");

  assert.match(visibleText, /biodiversity/i);
  assert.doesNotMatch(visibleText, /pollinat|native bees/i);
});

test("unprofiled niche topics keep every relevant named path with distinct searches", () => {
  const plan = buildResearchPlan("quantum sensors for precision agriculture", 5);
  const ids = plan.recommendations.map((resource) => resource.id);

  assert.equal(plan.subjectFocus.id, "science-engineering");
  assert.equal(ids[0], "web-of-science");
  assert.ok(ids.includes("science-direct"));
  assert.ok(ids.includes("academic-search-premier"));
  assert.ok(plan.recommendations.length >= 3);
  assert.ok(plan.recommendations.every((resource) => resource.searchTerms.length === 1));
  assert.ok(plan.recommendations.every((resource) => /quantum.*sensor.*precision.*agriculture/i.test(resource.searchTerms[0])));
  assert.ok(plan.fallbacks.length >= 5);
  assert.doesNotMatch(ids.join(" "), /databases-az|research-guides|ask-a-librarian|project-muse/);
});

test("clear cross-disciplinary prompts receive adaptive breadth without a fixed quota", () => {
  const samples = [
    "the effects of sleep deprivation on academic performance",
    "climate change and food insecurity",
    "music therapy for dementia",
  ];

  for (const query of samples) {
    const plan = buildResearchPlan(query, 6);
    const labels = plan.fallbacks.map((fallback) => fallback.label);
    assert.ok(plan.recommendations.length >= 3, `${query} should have several defensible database paths`);
    assert.ok(plan.fallbacks.length >= 5, `${query} should have several distinct recovery tactics`);
    assert.equal(new Set(labels).size, labels.length, `${query} should not repeat fallback actions`);
    assert.doesNotMatch(
      plan.recommendations.map((resource) => resource.id).join(" "),
      /databases-az|research-guides|ask-a-librarian|business-guide/
    );
  }
});

test("setup prompts are not treated as substantive research topics", () => {
  assert.equal(isSubstantiveResearchRequest("Help me navigate ZSR"), false);
  assert.equal(isSubstantiveResearchRequest("Help me research a topic"), false);
  assert.equal(isSubstantiveResearchRequest("government surveillance and public trust"), true);
});

test("economics comparisons route to EconLit with clean concept-specific searches", () => {
  const query = "Help me explore the differences between Keynesian and Neoclassical economics for this topic and suggest focused research angles I can search in ZSR.";
  const plan = buildResearchPlan(query, 6);
  const visibleSearches = [
    ...plan.recommendations.flatMap((resource) => resource.searchTerms),
    ...plan.searchTerms,
    ...plan.fallbacks.map((fallback) => fallback.query).filter(Boolean),
  ];

  assert.equal(plan.subjectFocus.id, "economics");
  assert.equal(plan.recommendations[0].id, "econlit");
  assert.ok(plan.recommendations.length >= 3);
  assert.ok(plan.recommendations.every((resource) => resource.searchTerms.length === 1));
  assert.ok(visibleSearches.every((term) => /keynesian|neoclassical/i.test(term)));
  assert.doesNotMatch(visibleSearches.join(" "), /phones?|eyes?|explore the differences|this topic|suggest focused/i);
});

test("political leadership psychology repairs wording and produces several source queries", () => {
  const query = "The psychology of powerful and cruel leaders in dominate countries";
  const plan = buildResearchPlan(query, 6, "psychology");
  const catalogQueries = buildCatalogSearchQueries(query, "psychology", 6);
  const ids = plan.recommendations.map((resource) => resource.id);

  assert.equal(plan.subjectFocus.id, "psychology");
  assert.equal(ids[0], "psycinfo");
  assert.ok(ids.includes("proquest-political-science"));
  assert.ok(ids.includes("socindex"));
  assert.ok(catalogQueries.length >= 4);
  assert.match(catalogQueries[0], /authoritarian leaders/i);
  assert.match(catalogQueries.join(" "), /political leaders|dark triad/i);
  assert.doesNotMatch(catalogQueries.join(" "), /dominate countries|the psychology powerful/i);
});
