import test from "node:test";
import assert from "node:assert/strict";
import { buildResearchPlan } from "../config/researchAgent.js";
import { buildResearchSpec, mergeSuppliedResearchSpec, researchSpecQuery } from "../config/researchSpec.js";
import { sourceQueryVariants } from "../config/searchQueries.js";
import { compileResourceQuery, validateCompiledQuery } from "../config/queryCompiler.js";
import { extractSourceRequirements, sourceRequirementUpdates } from "../config/sourceRequirements.js";
import { liveSearchQueries } from "../server/liveSearchQueries.js";
import { rankSourceResults } from "../server/sourceRelevance.js";

function everySearch(plan) {
  return [...new Set([
    researchSpecQuery(plan.researchSpec), ...sourceQueryVariants(plan.researchSpec),
    ...liveSearchQueries(plan), ...plan.searchTerms,
    ...plan.recommendations.flatMap((resource) => resource.searchTerms),
    ...plan.fallbacks.map((fallback) => fallback.query).filter(Boolean),
  ])];
}

test("requested scholarly format wins over source nouns in the subject, without erasing those nouns", () => {
  for (const [prompt, terms] of [
    ["Find peer-reviewed studies of newspaper coverage of climate change.", ["newspaper coverage", "climate change"]],
    ["Find scholarly articles about book banning in school libraries.", ["book banning", "school libraries"]],
    ["Find peer-reviewed studies on primary sources in history classrooms.", ["primary sources", "history classrooms"]],
  ]) {
    const plan = buildResearchPlan(prompt);
    assert.equal(plan.modeId, "scholarly", prompt);
    assert.ok(plan.recommendations.length > 1, prompt);
    for (const term of terms) assert.ok(plan.researchSpec.concepts.some((concept) => concept.preferredTerm.toLowerCase() === term), term);
    for (const query of everySearch(plan)) {
      assert.ok(query.toLowerCase().includes(terms[0]), query);
      assert.equal(validateCompiledQuery(query, plan.researchSpec).valid, true, query);
    }
  }
  assert.equal(buildResearchSpec("Find book banning studies").mode, "scholarly");
  assert.match(researchSpecQuery(buildResearchSpec("Find book banning studies")), /book banning/);
  assert.equal(buildResearchSpec("Find newspaper articles about climate change").mode, "news");
  assert.equal(buildResearchSpec("Primary sources about the Greensboro sit-ins in 1960").mode, "primary");
  assert.equal(buildResearchSpec("Compare US and European newspaper coverage of the war in Ukraine").mode, "news");
  assert.equal(buildResearchSpec("Find scholarly articles about book banning", { modeId: "books" }).mode, "books", "explicit source control remains authoritative");
});

test("book requests remove format and introductory scaffolding from every query", () => {
  const plan = buildResearchPlan("Books introducing environmental justice in the United States");
  assert.equal(plan.modeId, "books");
  for (const query of everySearch(plan)) {
    assert.match(query, /environmental justice/);
    assert.match(query, /United States/);
    assert.doesNotMatch(query, /books|introducing/i);
  }
});

test("loaded and neutral questions retrieve with the same topic terms rather than the desired conclusion", () => {
  const cases = [
    ["Find evidence that remote work is bad for productivity.", "remote work and productivity", /\bbad\b|\bprove|\bevidence\b/i],
    ["Find studies proving that social media damages adolescent mental health.", "social media and adolescent mental health", /\bprov|\bdamag/i],
    ["Why does social media cause depression in teenagers?", "social media and depression in teenagers", /\bcause\b/i],
  ];
  for (const [loaded, neutral, forbidden] of cases) {
    const plan = buildResearchPlan(loaded);
    const comparison = buildResearchPlan(neutral);
    assert.deepEqual(sourceQueryVariants(plan.researchSpec), sourceQueryVariants(comparison.researchSpec), loaded);
    assert.equal(plan.researchSpec.searchIntent.originalQuestion, loaded);
    assert.equal(plan.researchSpec.searchIntent.reformulated, true);
    assert.match(plan.researchSpec.searchIntent.neutralQuestion, /^What does research show/);
    assert.match(plan.researchSpec.searchIntent.explanation, /without treating.*established/);
    everySearch(plan).forEach((query) => assert.doesNotMatch(query, forbidden));
  }
});

test("disconfirming metadata is not excluded by a conclusion inserted by the parser", () => {
  // Synthetic records exercise filtering; they are not literature claims.
  const source = { title: "Remote work and productivity: no reduction in a randomized trial", sourceKind: "scholarly-article", date: "2024", doi: "10.9999/query-test", url: "https://example.org/query-test", abstractExcerpt: "Productivity remained stable across work locations." };
  const neutral = rankSourceResults([source], buildResearchSpec("remote work and productivity"));
  const loaded = rankSourceResults([source], buildResearchSpec("Find evidence that remote work is bad for productivity."));
  assert.equal(neutral.length, 1);
  assert.equal(loaded.length, 1);
  assert.deepEqual(loaded[0].matchExplanation.matchedConcepts, neutral[0].matchExplanation.matchedConcepts);
});

test("other leading predicates become research outcomes rather than mandatory verdicts", () => {
  for (const [prompt, retained, forbidden] of [
    ["Prove that antidepressants never work and are always harmful.", [/antidepressant/i, /effectiveness/, /adverse effects|harmful effects|adverse events|side effects/], /\bnever\b|\balways\b|\bwork\b|AND harmful\b/],
    ["Why is voter fraud the main reason elections are unreliable?", [/fraud/, /elections|voting|electoral/, /reliability/], /unreliable|main reason/],
    ["Why are immigrants naturally more likely to commit crimes?", [/immigrant|immigration|migrant/, /crime|criminality|offending/], /naturally|likely|commit/],
    ["Prove that artificial intelligence always discriminates against job applicants.", [/artificial intelligence|\bAI\b|algorithm/, /discrimination/, /job applicants|employment|hiring/], /always|discriminates against/],
    ["Why were people in the Middle Ages less intelligent than people today?", [/Middle Ages|medieval/, /intelligence|cognitive ability/], /\bless\b|than people/],
  ]) {
    const plan = buildResearchPlan(prompt);
    for (const query of everySearch(plan)) {
      retained.forEach((pattern) => assert.match(query, pattern));
      assert.doesNotMatch(query, forbidden);
    }
    assert.equal(plan.researchSpec.searchIntent.reformulated, true);
  }
  const technology = buildResearchSpec("Prove that artificial intelligence always discriminates against job applicants.");
  assert.ok(!technology.concepts.some((concept) => concept.id === "intelligence"), "machine intelligence does not imply human cognitive ability");
});

test("legitimate investigation of adverse effects is preserved without adding a competing thesis", () => {
  const plan = buildResearchPlan("Investigate possible adverse effects of pesticides on bee survival.");
  assert.equal(plan.researchSpec.searchIntent.reformulated, false);
  assert.equal(plan.researchSpec.searchIntent.requestedFocus, "adverse-effects");
  for (const query of everySearch(plan)) {
    assert.match(query, /adverse effects|harmful effects|adverse events|side effects/);
    assert.match(query, /pesticides/);
    assert.match(query, /bee survival/);
    assert.doesNotMatch(query, /\bpossible\b|benefit|safe|harmless/i);
  }
  const balanced = buildResearchPlan("What are the benefits and drawbacks of remote work for productivity?");
  assert.equal(balanced.researchSpec.searchIntent.requestedFocus, "benefits-and-harms");
  assert.deepEqual(balanced.researchSpec.concepts.map((concept) => concept.preferredTerm), ["remote work", "productivity"]);
});

test("historical periods coexist with explicit publication dates and survive student corrections", () => {
  const plan = buildResearchPlan("Women abolitionists in the United States before 1865, using peer-reviewed sources published since 2020");
  assert.equal(plan.researchSpec.facets.timePeriod, "before 1865");
  assert.deepEqual(plan.researchSpec.sourceRequirements, { publicationYearFrom: 2020, publicationYearTo: null, peerReviewed: true, requestedSourceCount: null });
  assert.match(plan.researchSpec.searchIntent.scopeNotes.join(" "), /period being studied/);
  for (const query of everySearch(plan)) {
    assert.match(query, /Women abolitionists/i);
    assert.doesNotMatch(query, /1865|2020|published/i, "calendar scope is checked in sources, not imposed as a metadata phrase");
  }
  const historical = buildResearchSpec("Women abolitionists in the United States before 1865");
  assert.equal(historical.sourceRequirements.publicationYearTo, null);
  const corrected = mergeSuppliedResearchSpec(historical, historical);
  assert.equal(corrected.facets.timePeriod, "before 1865");
  assert.equal(corrected.sourceRequirements.publicationYearTo, null);
  assert.equal(buildResearchSpec("Minimum wage and restaurant employment after 2015").sourceRequirements.publicationYearFrom, null);
  assert.equal(extractSourceRequirements("published before 1865").publicationYearTo, 1864);
  assert.equal(extractSourceRequirements("four sources since 2021").publicationYearFrom, 2021);
  assert.deepEqual(sourceRequirementUpdates("since 2023"), { publicationYearFrom: 2023 });
});

test("plural methods and interviews are separated from subject concepts on every search path", () => {
  for (const [prompt, method, topic, expectedQuery] of [
    ["Qualitative interviews about food insecurity among college students", "qualitative interview", "food insecurity", /qualitative AND interview\*/],
    ["Offshore wind energy impacts on marine mammals systematic reviews", "systematic review", "marine mammals", /"systematic review" OR "systematic reviews"/],
    ["Longitudinal studies of sleep and attention", "longitudinal study", "sleep", /longitudinal/],
  ]) {
    const plan = buildResearchPlan(prompt);
    assert.deepEqual(plan.researchSpec.methodRequirements, { include: [method], exclude: [] });
    assert.ok(plan.researchSpec.concepts.some((concept) => concept.preferredTerm.toLowerCase() === topic));
    assert.ok(plan.researchSpec.concepts.every((concept) => !/qualitative|review|longitudinal/i.test(concept.preferredTerm)));
    for (const query of everySearch(plan)) {
      assert.match(query, expectedQuery);
      assert.ok(query.toLowerCase().includes(topic), query);
      assert.doesNotMatch(query, /"Qualitative interviews food|"marine mammals systematic/i);
    }
  }
  assert.deepEqual(buildResearchSpec("Food insecurity among college students").methodRequirements, { include: [], exclude: [] });
  assert.deepEqual(buildResearchSpec("Find studies of the reliability of systematic reviews").methodRequirements, { include: [], exclude: [] }, "a study method can itself be the topic");
});

test("excluded reviews remain exclusions and never become literary fiction or required topics", () => {
  const plan = buildResearchPlan("Find peer-reviewed empirical studies on sleep and attention, not literature reviews.");
  assert.deepEqual(plan.researchSpec.concepts.map((concept) => concept.preferredTerm), ["sleep", "attention"]);
  assert.deepEqual(plan.researchSpec.methodRequirements, { include: ["empirical study"], exclude: ["literature review"] });
  assert.notEqual(plan.subjectFocus.id, "history-humanities");
  for (const query of everySearch(plan)) {
    assert.match(query, /sleep AND attention/);
    assert.match(query, /AND NOT \("literature review" OR "literature reviews"\)/);
    assert.doesNotMatch(query, /fiction|"attention not"/);
  }
  assert.deepEqual(plan.searchTerms, sourceQueryVariants(plan.researchSpec).slice(0, 3), "governed Boolean text must not pass through prose truncation");
  const corrected = mergeSuppliedResearchSpec(plan.researchSpec, plan.researchSpec);
  assert.deepEqual(corrected.methodRequirements, plan.researchSpec.methodRequirements, "serializing the readable method facet must not discard exclusions");
  const continued = buildResearchPlan("Show me more sources", 5, "auto", "scholarly", { previousResearchSpec: plan.researchSpec, latestUserText: "Show me more sources" });
  assert.deepEqual(continued.researchSpec.methodRequirements, plan.researchSpec.methodRequirements);
});

test("new and complex topics retain their actors, outcomes and setting without quoting instruction clauses", () => {
  const cases = [
    ["How do proportional representation and first-past-the-post systems affect voter turnout?", [/proportional/, /first-past-the-post|plurality/, /turnout|electoral participation/], /"first-past-the-post systems"|\baffect\b/],
    ["Rent control and housing supply in large US cities", [/rent control/i, /housing supply/, /large cities|major cities|metropolitan areas/, /United States/], /\bin\b/],
    ["Microplastic capture by floating wetlands in urban stormwater ponds", [/Microplastic capture/i, /floating wetlands/, /urban|city|metropolitan/, /stormwater ponds/], /"Microplastic capture by floating wetlands"/],
    ["Sanctions and their impact on authoritarian regimes vs democracies", [/sanctions/i, /authoritarian|autocratic/, /democra/i], /\btheir\b|\bimpact\b|qualitative|systematic review/],
  ];
  for (const [prompt, retained, forbidden] of cases) for (const query of everySearch(buildResearchPlan(prompt))) {
    retained.forEach((pattern) => assert.match(query, pattern, prompt));
    assert.doesNotMatch(query, forbidden);
  }
});

test("long unmatched topic phrases use separate keywords while explicitly quoted phrases stay exact", () => {
  const ordinary = buildResearchSpec("Floating wetland nutrient capture efficiency");
  const explicit = buildResearchSpec('Find studies about "floating wetland nutrient capture efficiency"');
  for (const query of [researchSpecQuery(ordinary), compileResourceQuery({ id: "web-of-science" }, ordinary), ...sourceQueryVariants(ordinary)]) {
    assert.doesNotMatch(query, /"Floating wetland nutrient capture efficiency"/);
    assert.match(query, /Floating AND wetland AND nutrient AND capture AND efficiency/i);
    assert.equal(validateCompiledQuery(query, ordinary).valid, true);
  }
  for (const query of [researchSpecQuery(explicit), compileResourceQuery({ id: "web-of-science" }, explicit), ...sourceQueryVariants(explicit)]) assert.match(query, /"floating wetland nutrient capture efficiency"/);
  const vocabularyInsideQuotes = buildResearchSpec('Find studies about "urban forest canopy cover"');
  assert.equal(researchSpecQuery(vocabularyInsideQuotes), '"urban forest canopy cover"');
});

test("source-focused routing keeps utilities and explicit disciplinary controls intact", () => {
  assert.ok(buildResearchPlan("Where do I find company financials?").recommendations.some((resource) => resource.id === "mergent"));
  assert.ok(buildResearchPlan("I need a citation for a website in APA").recommendations.some((resource) => resource.id === "research-guides"));
  assert.ok(buildResearchPlan("Where should I start in ZSR if I do not know which database to use?").recommendations.some((resource) => resource.id === "databases-az"));
  assert.equal(buildResearchPlan("sleep and attention, not literature reviews", 5, "psychology").subjectFocus.id, "psychology");
});

// Evaluate generated Boolean text against synthetic text to catch a stray AND
// outside an OR group. Keyword presence alone would miss that retrieval bug.
function queryMatchesText(query, text) {
  const tokens = query.match(/"[^"\n]*"|\(|\)|[^\s()]+/g) || [];
  let position = 0;
  const atom = () => {
    const token = tokens[position++];
    if (token === "(") {
      const value = disjunction();
      assert.equal(tokens[position++], ")");
      return value;
    }
    if (token === "NOT") return !atom();
    assert.ok(token, "complete Boolean expression");
    const phrase = token.replace(/^"|"$/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, "[a-z]*");
    return new RegExp(`\\b${phrase}\\b`, "i").test(text);
  };
  const conjunction = () => {
    let value = atom();
    while (tokens[position] === "AND") { position++; const right = atom(); value = value && right; }
    return value;
  };
  const disjunction = () => {
    let value = conjunction();
    while (tokens[position] === "OR") { position++; const right = conjunction(); value = value || right; }
    return value;
  };
  const result = disjunction();
  assert.equal(position, tokens.length, query);
  return result;
}

test("population comparisons preserve both groups and the shared outcome on every search path", () => {
  for (const prompt of [
    "Compare loneliness in adolescents and older adults",
    "Compare loneliness among teens and older adults",
    "Differences between adolescents and older adults in loneliness",
    "Loneliness in adolescents versus older adults",
  ]) {
    const plan = buildResearchPlan(prompt);
    assert.deepEqual(plan.researchSpec.comparison.conceptIds, ["adolescents", "older-adults"], prompt);
    assert.equal(plan.researchSpec.facets.population, "", "a scalar population facet must not override the comparison");
    for (const query of everySearch(plan)) {
      assert.match(query, /loneliness/i, query);
      assert.match(query, /adolescent|teen|youth|young people/i, query);
      assert.match(query, /older adults|elderly|aging population/i, query);
      assert.match(query, /\([^)]*(?:adolescent|teen|youth)[\s\S]* OR [\s\S]*(?:older adults|elderly|aging population)/i, query);
      assert.equal(queryMatchesText(query, "Loneliness adolescents adolescent teenagers teens youth young people"), true, `younger side: ${query}`);
      assert.equal(queryMatchesText(query, "Loneliness older adults elderly aging population"), true, `older side: ${query}`);
      assert.equal(queryMatchesText(query, "Loneliness in cities"), false, `a population is still required: ${query}`);
      assert.equal(queryMatchesText(query, "adolescents and older adults"), false, `shared outcome is still required: ${query}`);
    }
    const corrected = mergeSuppliedResearchSpec(plan.researchSpec, plan.researchSpec);
    assert.deepEqual(corrected.comparison, plan.researchSpec.comparison);
    assert.equal(researchSpecQuery(corrected), researchSpecQuery(plan.researchSpec));
  }
  const spec = buildResearchSpec("Compare loneliness in adolescents and older adults in Canada, peer-reviewed sources published since 2021");
  assert.equal(spec.sourceRequirements.peerReviewed, true);
  assert.equal(spec.sourceRequirements.publicationYearFrom, 2021);
  assert.ok(sourceQueryVariants(spec).every((query) => query.includes("Canada")));
  const fixtures = [
    { title: "Loneliness in older adults", doi: "10.9999/older", sourceKind: "scholarly-article" },
    { title: "Loneliness in adolescents", doi: "10.9999/teen", sourceKind: "scholarly-article" },
    { title: "Loneliness compared in adolescents and older adults", doi: "10.9999/both", sourceKind: "scholarly-article" },
  ];
  const ranked = rankSourceResults(fixtures, buildResearchSpec("Compare loneliness in adolescents and older adults"));
  assert.equal(ranked.length, 3, "either-side supporting records remain available");
  assert.equal(ranked[0].doi, "10.9999/both");
  assert.ok(ranked.slice(1).every((source) => source.matchExplanation.category === "supporting"));
});

test("conversational and coordinated method exclusions remain negative without swallowing method topics", async () => {
  const { assessSourceRequirements } = await import("../src/sourceAssessment.js");
  for (const clause of [
    "but I do not want systematic reviews",
    "but I don't want any systematic reviews",
    "please do not include systematic reviews",
    "without systematic reviews",
    "exclude systematic reviews",
    "I would not want systematic reviews",
  ]) {
    const plan = buildResearchPlan(`Find studies of social media and mental health, ${clause}`);
    assert.deepEqual(plan.researchSpec.methodRequirements, { include: [], exclude: ["systematic review"] }, clause);
    assert.deepEqual(plan.researchSpec.concepts.map((concept) => concept.id), ["social-media", "mental-health"]);
    for (const query of everySearch(plan)) {
      assert.match(query, /social media|social platform|online social networking/i);
      assert.match(query, /mental health|psychological well-being|well-being/i);
      assert.match(query, /NOT \("systematic review" OR "systematic reviews"\)/);
      assert.doesNotMatch(query, /\bbut\b|\bwant\b|\binclude\b|\bplease\b/i);
    }
    // Synthetic provider metadata, not findings from actual articles.
    const ownReview = { title: "Social media and mental health", type: "article", abstractText: "We conducted a systematic review of 32 studies." };
    const mentionsReview = { ...ownReview, abstractText: "Previous systematic reviews reported inconsistent findings. We interviewed 25 participants." };
    assert.equal(assessSourceRequirements(ownReview, plan.researchSpec).status, "mismatch");
    assert.notEqual(assessSourceRequirements(mentionsReview, plan.researchSpec).status, "mismatch", "a background mention does not establish the source's method");
  }
  assert.deepEqual(buildResearchSpec("Sleep and attention, do not include systematic reviews or meta-analyses").methodRequirements, { include: [], exclude: ["systematic review", "meta-analysis"] });
  for (const prompt of ["Find studies of the reliability of systematic reviews", "Find studies about systematic reviews", "Research on limitations of systematic reviews"]) {
    assert.deepEqual(buildResearchSpec(prompt).methodRequirements, { include: [], exclude: [] }, prompt);
    assert.match(researchSpecQuery(buildResearchSpec(prompt)), /systematic reviews/i);
  }
});

test("provider requests execute comparison OR groups and method exclusions, not just plan snapshots", async () => {
  const { discoverSourcesForScope } = await import("../server/sourceDiscovery.js");
  const originalFetch = globalThis.fetch;
  const executed = [];
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    executed.push(parsed);
    return { ok: true, json: async () => parsed.hostname.includes("crossref") ? { message: { items: [] } } : { docs: [] } };
  };
  try {
    for (const [prompt, checks] of [
      ["Compare loneliness in adolescents and older adults in Canada, sources published since 2021", [/loneliness/i, /adolescent|teen|youth/i, /older adults|elderly|aging population/i, /\bOR\b/, /Canada/]],
      ["Find studies of social media and mental health, but I do not want systematic reviews", [/social media|social platform|online social networking/i, /mental health|psychological well-being|well-being/i, /NOT \("systematic review" OR "systematic reviews"\)/]],
    ]) {
      executed.length = 0;
      const plan = buildResearchPlan(prompt);
      await discoverSourcesForScope(liveSearchQueries(plan), 5, "scholarly", "library", { researchSpec: plan.researchSpec });
      const requests = executed.filter((url) => url.pathname.includes("pnxs"));
      assert.ok(requests.length > 0, "public catalog requests were executed");
      for (const url of requests) {
        const query = url.searchParams.get("q");
        checks.forEach((pattern) => assert.match(query, pattern));
        assert.doesNotMatch(query, /\bbut\b|\bwant\b|\bplease\b/);
      }
    }
  } finally { globalThis.fetch = originalFetch; }
});
