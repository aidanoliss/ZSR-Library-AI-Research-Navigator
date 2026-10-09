import test from "node:test";
import assert from "node:assert/strict";

import { buildResearchPlan } from "../config/researchAgent.js";
import { requestContextFromBody } from "../server/requestContext.js";
import { buildResearchSpec } from "../config/researchSpec.js";
import { compileResourceQuery, validateCompiledQuery } from "../config/queryCompiler.js";
import { extractSourceRequirements, normalizeSourceRequirements } from "../config/sourceRequirements.js";

test("student-corrected ResearchSpec is authoritative and regenerates governed metadata", () => {
  const supplied = {
    topic: "social media and anxiety in teens",
    mode: "news",
    disciplines: ["communication"],
    concepts: [
      { preferredTerm: "social media" },
      { preferredTerm: "anxiety" },
    ],
    facets: {
      population: "teenagers",
      geography: "Canada",
      timePeriod: "past 5 years",
      method: "",
    },
    sourceContract: { id: "books", requiredKinds: ["book"] },
    safety: { requiresPremiseCheck: false, flags: ["forged"] },
    configVersion: "forged",
    planHash: "forged",
  };

  const plan = buildResearchPlan("Apply my corrections", 6, "auto", "scholarly", {
    researchSpec: supplied,
  });

  assert.equal(plan.query, supplied.topic);
  assert.equal(plan.modeId, "news");
  assert.equal(plan.researchSpec.correctedByStudent, true);
  assert.deepEqual(plan.researchSpec.disciplines, ["communication-media"]);
  assert.equal(plan.researchSpec.sourceContract.id, "news");
  assert.notEqual(plan.researchSpec.configVersion, "forged");
  assert.notEqual(plan.planHash, "forged");
  assert.ok(plan.recommendations.slice(0, 2).every((resource) => resource.sourceKinds.includes("news")));
  assert.ok(plan.recommendations.every((resource) => resource.queryValidation.valid));
  assert.ok(plan.recommendations.every((resource) => /social media/i.test(resource.searchTerms[0])));
  assert.ok(plan.recommendations.every((resource) => /anxiety/i.test(resource.searchTerms[0])));
  assert.ok(plan.recommendations.every((resource) => /teenagers/i.test(resource.searchTerms[0])));
});

test("request parsing accepts only object-shaped ResearchSpec payloads", () => {
  const valid = { topic: "a topic", concepts: [{ preferredTerm: "topic" }] };
  assert.equal(requestContextFromBody({ researchSpec: valid }).researchSpec, valid);
  assert.equal(requestContextFromBody({ researchSpec: "not structured" }).researchSpec, null);
  assert.equal(requestContextFromBody({ researchSpec: [valid] }).researchSpec, null);
});

test("natural student prose preserves canopy, outcome, and assignment requirements separately", () => {
  const prompt = "Find peer-reviewed studies on how urban tree canopy affects neighborhood summer temperatures, published since 2020. I need three sources for a first-year research paper.";
  const plan = buildResearchPlan(prompt);
  assert.deepEqual(plan.researchSpec.sourceRequirements, { publicationYearFrom: 2020, publicationYearTo: null, peerReviewed: true, requestedSourceCount: 3 });
  assert.equal(plan.researchSpec.facets.timePeriod, "");
  assert.equal(plan.subjectFocus.id, "science-engineering");
  for (const resource of plan.recommendations) {
    assert.match(resource.searchTerms[0], /tree canopy/i);
    assert.match(resource.searchTerms[0], /neighborhood summer temperatures/i);
    assert.doesNotMatch(resource.searchTerms[0], /peer-reviewed|published|since|2020|first-year|paper/i);
    assert.ok(resource.filters.some((filter) => filter.includes("2020")));
  }
});

test("vocabulary matches retain unrecognized neighboring subjects and all required concepts", () => {
  for (const prompt of [
    "urban rooftop gardens and climate change and rainwater retention",
    "social media and sleep deprivation and workplace scheduling",
    "AI and sensor calibration and polymer durability and battery lifetime and repair costs",
  ]) {
    const spec = buildResearchSpec(prompt);
    const query = compileResourceQuery({ id: "web-of-science" }, spec);
    assert.equal(validateCompiledQuery(query, spec).valid, true);
    for (const term of prompt.split(/ and /i)) {
      for (const word of term.split(/\s+/)) assert.match(query.toLowerCase(), new RegExp(`\\b${word.toLowerCase()}\\b`));
    }
  }
  const conversational = buildResearchSpec("Could you help me find peer-reviewed articles about rainwater retention and rooftop gardens? I need four sources since 2021 for a class paper.");
  const conversationalQuery = compileResourceQuery({ id: "web-of-science" }, conversational);
  assert.match(conversationalQuery, /rainwater retention/);
  assert.match(conversationalQuery, /rooftop gardens/);
  assert.doesNotMatch(conversationalQuery, /could|you|help|peer|since|paper|class|four/i);
  const spec = buildResearchSpec("law and heat");
  assert.equal(validateCompiledQuery("claw AND heath", spec).valid, false);
});

test("source constraints support bounded years, counts, and deterministic relative dates", () => {
  assert.deepEqual(extractSourceRequirements("five peer-reviewed articles published between 2021 and 2025"), { publicationYearFrom: 2021, publicationYearTo: 2025, peerReviewed: true, requestedSourceCount: 5 });
  assert.deepEqual(extractSourceRequirements("last 3 years", { currentYear: 2026 }), { publicationYearFrom: 2024, publicationYearTo: 2026, peerReviewed: false, requestedSourceCount: null });
  assert.equal(extractSourceRequirements("published after 2020").publicationYearFrom, 2021);
  assert.equal(extractSourceRequirements("published before 2020").publicationYearTo, 2019);
  assert.deepEqual(extractSourceRequirements("history of elections from 1930 through 1950"), { publicationYearFrom: null, publicationYearTo: null, peerReviewed: false, requestedSourceCount: null });
  assert.equal(buildResearchSpec("history of elections from 1930 through 1950").facets.timePeriod, "1930 through 1950");
  const historySpec = buildResearchSpec("history of elections from 1930 through 1950, using sources published since 2020");
  assert.equal(historySpec.sourceRequirements.publicationYearFrom, 2020);
  assert.equal(historySpec.facets.timePeriod, "1930 through 1950");
  assert.deepEqual(normalizeSourceRequirements({ publicationYearFrom: "bad", peerReviewed: "true", requestedSourceCount: 999 }), { publicationYearFrom: null, publicationYearTo: null, peerReviewed: false, requestedSourceCount: null });
});

test("dependent turns preserve corrected terms and constraints while explicit new limits win", () => {
  const initial = buildResearchPlan("urban tree canopy and summer temperatures since 2020", 5, "auto", "scholarly", {
    researchSpec: { topic: "urban tree canopy and summer temperatures", concepts: [{ preferredTerm: "tree canopy" }, { preferredTerm: "air temperature" }], sourceRequirements: { publicationYearFrom: 2020, peerReviewed: true, requestedSourceCount: 3 } },
  });
  const next = buildResearchPlan("Show me more sources", 5, "auto", "scholarly", { previousResearchSpec: initial.researchSpec, latestUserText: "Show me more sources" });
  assert.deepEqual(next.researchSpec.concepts.map((concept) => concept.preferredTerm), ["tree canopy", "air temperature"]);
  assert.deepEqual(next.researchSpec.sourceRequirements, initial.researchSpec.sourceRequirements);
  const narrowed = buildResearchPlan("Limit it to sources published since 2023", 5, "auto", "scholarly", { previousResearchSpec: next.researchSpec, latestUserText: "Limit it to sources published since 2023" });
  assert.equal(narrowed.researchSpec.sourceRequirements.publicationYearFrom, 2023);
  assert.equal(narrowed.researchSpec.sourceRequirements.peerReviewed, true);
  assert.equal(narrowed.researchSpec.sourceRequirements.requestedSourceCount, 3);
});

test("political comparisons retain both sides without inventing study methods", async () => {
  const { liveSearchQueries } = await import("../server/liveSearchQueries.js");
  const plan = buildResearchPlan("Sanctions and their impact on authoritarian regimes vs democracies");
  assert.equal(plan.subjectFocus.id, "policy-law");
  assert.deepEqual(plan.researchSpec.comparison.terms, ["authoritarian regimes", "democracies"]);
  assert.ok(plan.recommendations.some((resource) => resource.id === "proquest-political-science"));
  const queries = [...liveSearchQueries(plan), ...plan.searchTerms, ...plan.recommendations.flatMap((resource) => resource.searchTerms), ...plan.fallbacks.map((fallback) => fallback.query).filter(Boolean)];
  assert.doesNotMatch(queries.join(" "), /longitudinal|qualitative|case study|systematic review/);
  assert.ok(queries.every((query) => /sanctions/i.test(query) && /authoritarian|autocratic/i.test(query) && /democra/i.test(query)));
  assert.match(liveSearchQueries(plan)[1], /\bOR\b/);
});

test("source-query synonyms and recovery never remove assignment requirements", async () => {
  const { liveSearchQueries } = await import("../server/liveSearchQueries.js");
  const { buildSearchRecovery } = await import("../config/searchRecovery.js");
  const plan = buildResearchPlan("Sanctions in authoritarian regimes vs democracies, peer-reviewed sources published since 2021", 5, "auto", "scholarly", { researchSpec: {
    topic: "Sanctions in authoritarian regimes vs democracies, peer-reviewed sources published since 2021",
    facets: { geography: "United States", method: "qualitative study" },
  } });
  const recovery = buildSearchRecovery(plan.researchSpec, { outcomes: { library: [{ status: "empty" }] } });
  assert.equal(recovery.kind, "broaden");
  assert.deepEqual(recovery.researchSpec.sourceRequirements, plan.researchSpec.sourceRequirements);
  assert.deepEqual(recovery.researchSpec.facets, plan.researchSpec.facets);
  assert.equal(recovery.researchSpec.mode, plan.researchSpec.mode);
  assert.ok(liveSearchQueries(plan).every((query) => query.includes('"United States"') && query.includes('"qualitative study"')));
  const rerun = buildResearchPlan(plan.query, 5, "auto", "scholarly", { researchSpec: recovery.researchSpec });
  assert.equal(liveSearchQueries(rerun)[0], recovery.query);
  const retry = buildSearchRecovery(plan.researchSpec, { outcomes: { library: [{ status: "timeout" }] } });
  assert.equal(retry.kind, "retry");
  assert.equal(retry.query, liveSearchQueries(plan)[0]);
  assert.deepEqual(retry.researchSpec, plan.researchSpec);
  assert.match(retry.explanation, /did not complete/);
  assert.equal(buildSearchRecovery(plan.researchSpec, { resultCount: 1 }), null);
});

test("disabled discovery does not offer a broader search that cannot run", async () => {
  const { buildSearchRecovery } = await import("../config/searchRecovery.js");
  const spec = buildResearchSpec("Sanctions in authoritarian regimes vs democracies");
  const recovery = buildSearchRecovery(spec, { outcomes: { library: [{ status: "disabled" }] } });
  assert.equal(recovery.kind, "manual");
  assert.match(recovery.explanation, /unavailable/);
});

test("recovery uses actual attempt queries and never repeats exhausted synonym expansion", async () => {
  const { buildSearchRecovery } = await import("../config/searchRecovery.js");
  const { sourceQueryVariants } = await import("../config/searchQueries.js");
  const spec = buildResearchSpec("Sanctions in authoritarian regimes vs democracies");
  const expanded = sourceQueryVariants({ ...spec, searchExpansion: "full-synonyms" })[0];
  const recovery = buildSearchRecovery(spec, { outcomes: { library: [{ status: "empty", query: expanded, retrievedCount: 0 }] } });
  assert.equal(recovery.kind, "manual");
  assert.equal(recovery.reason, "no_records");
  assert.match(recovery.explanation, /returned no records/);
  const filtered = buildSearchRecovery({ ...spec, searchExpansion: "full-synonyms" }, { outcomes: { library: [{ status: "empty", query: expanded, retrievedCount: 20 }] } });
  assert.equal(filtered.kind, "manual");
  assert.equal(filtered.reason, "no_eligible_records");
  assert.match(filtered.explanation, /none passed/);
});

test("comparison sides follow the question rather than swallowing trailing outcome concepts", () => {
  const sanctions = buildResearchSpec("Sanctions in authoritarian regimes vs democracies and political stability");
  assert.deepEqual(sanctions.comparison.terms, ["authoritarian regimes", "democracies"]);
  const theories = buildResearchSpec("Compare Keynesian and neoclassical economics during recessions");
  assert.deepEqual(theories.comparison.conceptIds, ["keynesian", "neoclassical"]);
});
