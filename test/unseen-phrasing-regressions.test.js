import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResearchSpec,
  researchSpecQuery,
  mergeSuppliedResearchSpec,
  continueResearchSpec,
  extractTopicExclusions,
  interpretationConfidence,
  applyAssistedInterpretation,
} from "../config/researchSpec.js";
import { sourceQueryVariants, withoutNegatedClauses } from "../config/searchQueries.js";
import { extractSourceRequirements } from "../config/sourceRequirements.js";
import { buildResearchPlan } from "../config/researchAgent.js";
import { rankSourceResults, assessSourceRelevance } from "../server/sourceRelevance.js";
import {
  assistInterpretation,
  clearInterpretationCache,
  groundedInRequest,
  validateAssistedInterpretation,
} from "../server/queryInterpretation.js";

const conceptTerms = (spec) => spec.concepts.map((concept) => concept.preferredTerm.toLowerCase());

test("clause-level exclusions become NOT terms on every search and never required concepts", () => {
  const cases = [
    ["effects of remote work on productivity, but not in the tech industry", "tech industry"],
    ["urban gardening programs; not community gardens", "community gardens"],
    ["history of punk music excluding the Sex Pistols", "Sex Pistols"],
    ["minimum wage research except for studies about restaurants", "restaurants"],
    ["coral reef decline, and not anything about tourism", "tourism"],
    ["wildfire smoke and asthma. I don't want sources about California", "California"],
  ];
  for (const [prompt, excluded] of cases) {
    const spec = buildResearchSpec(prompt);
    assert.deepEqual(spec.excludedTerms.map((term) => term.toLowerCase()), [excluded.toLowerCase()], prompt);
    assert.ok(!conceptTerms(spec).some((term) => term.includes(excluded.toLowerCase())), `${prompt}: excluded topic must not be a required concept`);
    assert.ok(!conceptTerms(spec).some((term) => /\b(?:but|not|except|excluding)\b/.test(term)), `${prompt}: instruction words leaked into concepts`);
    for (const query of sourceQueryVariants(spec)) assert.match(query, new RegExp(`NOT "?${excluded}"?`, "i"), `${prompt}: ${query}`);
  }
});

test("topical negation and idioms are not mistaken for exclusions", () => {
  for (const prompt of [
    "why students do not vote in local elections",
    "how to avoid burnout among nurses",
    "children without siblings and social skills",
    "renewable energy including but not limited to wind",
    "not only economic but also social effects of tariffs",
    "countries with no minimum wage",
    "no-fault divorce laws",
  ]) assert.deepEqual(buildResearchSpec(prompt).excludedTerms, [], prompt);
});

test("an excluded place or population never becomes the search facet", () => {
  const spec = buildResearchSpec("refugee resettlement outcomes, but not in Germany");
  assert.equal(spec.facets.geography, "");
  assert.deepEqual(spec.excludedTerms, ["Germany"]);
  assert.match(researchSpecQuery(spec), /NOT Germany$/);
});

test("exclusion lists split into separate NOT terms", () => {
  assert.deepEqual(extractTopicExclusions("jazz history, not bebop or swing").terms, ["bebop", "swing"]);
});

test("keyword-only providers drop NOT clauses instead of searching for excluded words", () => {
  assert.equal(withoutNegatedClauses('"remote work" AND productivity AND NOT "tech industry"'), '"remote work" AND productivity');
  assert.equal(withoutNegatedClauses('"social media" AND depression AND NOT ("systematic review" OR "systematic reviews")'), '"social media" AND depression');
  assert.equal(withoutNegatedClauses("jazz AND NOT bebop AND history"), "jazz AND history");
  assert.equal(withoutNegatedClauses("NOTICE periods AND notable cases"), "NOTICE periods AND notable cases");
});

test("student edits and follow-up turns control exclusions", () => {
  const base = buildResearchSpec("remote work and productivity, but not in the tech industry");
  assert.deepEqual(mergeSuppliedResearchSpec(base, { ...base, excludedTerms: [] }).excludedTerms, [], "a removed exclusion stays removed");
  assert.deepEqual(mergeSuppliedResearchSpec(base, { ...base, excludedTerms: ["finance", "NOT", '"healthcare"'] }).excludedTerms, ["finance", "healthcare"]);
  const followUp = continueResearchSpec(buildResearchSpec("remote work and productivity"), buildResearchSpec("remote work and productivity"), "not in Europe please");
  assert.deepEqual(followUp.excludedTerms, ["Europe"]);
  assert.match(researchSpecQuery(followUp), /NOT Europe/);
});

test("comparison wording beyond 'compare' structures the two sides", () => {
  for (const prompt of [
    "How does loneliness differ between teenagers and elderly people?",
    "Does loneliness vary across adolescents and older adults?",
  ]) {
    const spec = buildResearchSpec(prompt);
    assert.ok(spec.comparison, prompt);
    assert.ok(conceptTerms(spec).includes("loneliness"), prompt);
    assert.ok(!conceptTerms(spec).some((term) => /\b(?:differ|vary|people)\b/.test(term)), `${prompt}: ${conceptTerms(spec)}`);
    assert.match(researchSpecQuery(spec), /^loneliness AND \(/, prompt);
  }
});

test("leftover filler and relationship wording are not search terms", () => {
  assert.equal(researchSpecQuery(buildResearchSpec("anything on wolves and elk populations")), "wolves AND \"elk populations\"");
  assert.equal(researchSpecQuery(buildResearchSpec("are video games linked to violence in kids")), "\"video games\" AND violence AND kids");
  assert.equal(researchSpecQuery(buildResearchSpec("school uniforms pros and cons")), "\"school uniforms\"");
  assert.equal(researchSpecQuery(buildResearchSpec("Toni Morrison's use of memory in Beloved")), "\"Toni Morrison\" AND memory AND Beloved");
  assert.equal(researchSpecQuery(buildResearchSpec("why are bees dying")), "bees AND dying");
});

test("bare jazz is the music and young adults is a life stage, not narrower vocabulary", () => {
  assert.deepEqual(conceptTerms(buildResearchSpec("history of jazz in New Orleans")), ["history", "jazz", "new orleans"]);
  assert.equal(buildResearchSpec("vaping and lung health in young adults").facets.population, "young adults");
  assert.equal(buildResearchSpec("Gen Z consumers and luxury brands").facets.population, "younger consumers");
});

test("'Title by Author' requests are known items only when the author is a personal name", () => {
  for (const [prompt, title, author] of [
    ["Find The Sixth Extinction by Elizabeth Kolbert", "The Sixth Extinction", "Elizabeth Kolbert"],
    ["How Democracies Die by Steven Levitsky", "How Democracies Die", "Steven Levitsky"],
    ["The Souls of Black Folk by W. E. B. Du Bois", "The Souls of Black Folk", "W. E. B. Du Bois"],
  ]) {
    const spec = buildResearchSpec(prompt);
    assert.equal(spec.knownItem?.title, title, prompt);
    assert.equal(spec.knownItem?.author, author, prompt);
    assert.equal(spec.mode, "books");
  }
  assert.equal(buildResearchSpec("new topic: Find the book Beloved by Toni Morrison").knownItem?.title, "Beloved");
  for (const prompt of ["Effects of Sanctions by Western Countries", "voting by young people", "Climate Change by Country", "How does trade affect wages by country"]) {
    assert.equal(buildResearchSpec(prompt).knownItem, null, prompt);
  }
});

test("'older than' and 'newer than' phrasing sets publication limits without inversion", () => {
  assert.equal(extractSourceRequirements("body cameras, nothing older than 2015").publicationYearFrom, 2015);
  assert.equal(extractSourceRequirements("articles newer than 2019").publicationYearFrom, 2019);
  const capped = extractSourceRequirements("nothing published later than 1990 about punk");
  assert.equal(capped.publicationYearFrom, null);
  assert.equal(capped.publicationYearTo, 1990);
  assert.doesNotMatch(researchSpecQuery(buildResearchSpec("body cameras and accountability, nothing older than 2015")), /nothing|older|2015/i);
});

const spec = buildResearchSpec("remote work and productivity, but not in the tech industry");
const record = (overrides) => ({ title: "Remote work and productivity", type: "article", abstractText: "", subjects: [], ...overrides });

test("an excluded topic in a title or subject removes the lead; an abstract mention demotes it", () => {
  const ranked = rankSourceResults([
    record({ id: "title", title: "Remote work and productivity in the tech industry" }),
    record({ id: "abstract", title: "Remote work and productivity among accountants", abstractText: "Unlike earlier tech industry samples, this survey of accountants measures remote work productivity over two years of hybrid schedules." }),
    record({ id: "clean", title: "Remote work and productivity among teachers", abstractText: "A two-year panel of teachers measuring remote work and productivity outcomes across districts and grade levels." }),
  ], spec);
  assert.deepEqual(ranked.map((item) => item.id), ["clean", "abstract"]);
  assert.equal(ranked[1].matchExplanation.label, "Mentions an excluded topic · check fit");
  assert.equal(assessSourceRelevance(record({ subjects: ["Tech industry"] }), spec).status, "mismatch");
});

test("equally matched leads prefer peer-reviewed records with abstracts over trade items", () => {
  const scholarly = buildResearchSpec("bees and pesticides");
  const ranked = rankSourceResults([
    { id: "trade", title: "Bees and pesticides", type: "magazine article" },
    { id: "plain", title: "Bees and pesticides", type: "article" },
    { id: "peer", title: "Bees and pesticides", type: "article", peerReviewed: true, abstractText: "Field trial measuring honey bee colony loss after neonicotinoid pesticide exposure across three growing seasons." },
  ], scholarly);
  assert.equal(ranked[0].id, "peer");
  assert.equal(ranked.at(-1).id, "trade");
  assert.equal(ranked.find((item) => item.id === "plain").matchExplanation.label, "Title keywords match · no abstract to check");
});

test("weak deterministic parses are flagged; confident ones are not", () => {
  assert.equal(interpretationConfidence(buildResearchSpec("is nuclear power safer than solar")).weak, true);
  assert.ok(interpretationConfidence(buildResearchSpec("inmigración y salud mental en España")).reasons.includes("possible-non-english"));
  for (const prompt of ["microplastics in drinking water", "Sleep deprivation and executive function among first-year college students", "Find the book \"Beloved\" by Toni Morrison"]) {
    assert.equal(interpretationConfidence(buildResearchSpec(prompt)).weak, false, prompt);
  }
});

test("model interpretations are kept only when grounded in the student's words", () => {
  const request = "is nuclear power safer than solar";
  const valid = validateAssistedInterpretation({
    concepts: [
      { term: "nuclear power", synonyms: ["nuclear energy", "NOT coal", "x".repeat(90)] },
      { term: "solar power", synonyms: ["photovoltaics"] },
      { term: "safety", synonyms: ["risk"] },
      { term: "fossil fuels", synonyms: [] },
    ],
    comparison: ["nuclear power", "solar power"],
    excludedTerms: ["solar power"],
  }, request);
  assert.deepEqual(valid.concepts.map((concept) => concept.preferredTerm), ["nuclear power", "solar power", "safety"], "invented 'fossil fuels' is dropped; safer→safety is a word form");
  assert.deepEqual(valid.concepts[0].synonyms, ["nuclear energy", "coal"], "operators and overlong synonyms are stripped");
  assert.deepEqual(valid.comparison, ["nuclear power", "solar power"]);
  assert.deepEqual(valid.excludedTerms, [], "no exclusion without an explicit negation cue");
  assert.equal(validateAssistedInterpretation({ concepts: [{ term: "cats" }, { term: "system prompt" }] }, "climate migration in Bangladesh"), null);
  assert.equal(validateAssistedInterpretation("not json", request), null);
  assert.ok(groundedInRequest("United States", "Compare how the US and China regulate AI"));
  assert.ok(groundedInRequest("artificial intelligence", "Compare how the US and China regulate AI"));
  assert.ok(!groundedInRequest("statistics", "how states regulate AI"));
});

test("translated requests lead with the English term and keep the student's wording", () => {
  const valid = validateAssistedInterpretation({
    language: "es",
    concepts: [{ term: "salud mental", synonyms: ["mental health", "bienestar"] }, { term: "inmigración", synonyms: ["immigration"] }],
  }, "inmigración y salud mental en España");
  assert.deepEqual(valid.concepts.map((concept) => concept.preferredTerm), ["mental health", "immigration"]);
  assert.ok(valid.concepts[0].synonyms.includes("salud mental"));
});

test("assisted interpretation only changes concept structure, never mode, methods, dates or safety", () => {
  const base = buildResearchSpec("peer-reviewed studies since 2018 on whether nuclear power is safer than solar, no meta-analyses");
  const merged = applyAssistedInterpretation(base, {
    concepts: [{ preferredTerm: "nuclear power", synonyms: [] }, { preferredTerm: "solar power", synonyms: [] }, { preferredTerm: "safety", synonyms: ["risk"] }],
    comparison: ["nuclear power", "solar power"], excludedTerms: [],
  }, { reasons: ["request-wording-in-concept"] });
  for (const field of ["mode", "methodRequirements", "sourceRequirements", "sourceContract", "safety", "topic"]) assert.deepEqual(merged[field], base[field], field);
  assert.equal(merged.interpretation.method, "ai-assisted");
  assert.equal(researchSpecQuery(merged), '("nuclear power" OR "solar power") AND safety AND NOT (meta-analysis OR meta-analyses)');
  assert.notEqual(merged.planHash, base.planHash);
});

test("the plan uses an assisted spec only for the same fresh request", () => {
  const query = "is nuclear power safer than solar";
  const assisted = applyAssistedInterpretation(buildResearchSpec(query), { concepts: [{ preferredTerm: "nuclear power" }, { preferredTerm: "solar power" }, { preferredTerm: "safety" }], comparison: ["nuclear power", "solar power"] });
  assert.equal(buildResearchPlan(query, 5, undefined, undefined, { assistedResearchSpec: assisted }).researchSpec.interpretation?.method, "ai-assisted");
  assert.equal(buildResearchPlan("a different topic about tides", 5, undefined, undefined, { assistedResearchSpec: assisted }).researchSpec.interpretation, undefined);
  const corrected = buildResearchPlan(query, 5, undefined, undefined, { assistedResearchSpec: assisted, researchSpec: { topic: query, concepts: ["nuclear energy"] } });
  assert.equal(corrected.researchSpec.interpretation, undefined, "a student correction always wins");
});

test("assisted interpretation can be switched off, needs a key, and provider failures fall back silently", async () => {
  clearInterpretationCache();
  const base = buildResearchSpec("is nuclear power safer than solar");
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error("network down"); };
  assert.equal(await assistInterpretation(base.topic, base, { env: { GEMINI_API_KEY: "k", AI_QUERY_INTERPRETATION: "off" }, fetchImpl }), null);
  assert.equal(await assistInterpretation(base.topic, base, { env: {}, fetchImpl }), null);
  assert.equal(calls, 0, "no provider call when switched off or without a key");
  const env = { GEMINI_API_KEY: "k", AI_QUERY_INTERPRETATION: "on" };
  assert.equal(await assistInterpretation(base.topic, base, { env, fetchImpl }), null);
  assert.equal(calls, 1);
  clearInterpretationCache();
  const reply = { concepts: [{ term: "nuclear power" }, { term: "solar power" }, { term: "safety" }], comparison: ["nuclear power", "solar power"] };
  const ok = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }) });
  const result = await assistInterpretation(base.topic, base, { env, fetchImpl: ok });
  assert.deepEqual(result.fragment.comparison, ["nuclear power", "solar power"]);
  const confident = buildResearchSpec("microplastics in drinking water");
  assert.equal(await assistInterpretation(confident.topic, confident, { env, fetchImpl: async () => { throw new Error("must not be called"); } }), null);
  clearInterpretationCache();
});

test("an overlapping shorter vocabulary match is dropped only when the longer concept covers it", () => {
  assert.equal(researchSpecQuery(buildResearchSpec("urban heat islands and public health")), '"urban heat islands" AND "public health"');
  assert.match(researchSpecQuery(buildResearchSpec("large cities and urban identity")), /\burban\b/, "urban stays when the longer concept (cultural identity) does not carry it");
});

test("slow catalog variants do not hold back a full first result set", async () => {
  const { settleWithGrace } = await import("../server/primo.js");
  const never = new Promise(() => {});
  const started = Date.now();
  const full = await settleWithGrace([Promise.resolve(Array(10).fill("r")), never], (first) => first.length >= 10 ? 50 : Infinity);
  assert.equal(full[0].length, 10);
  assert.deepEqual(full[1], []);
  assert.ok(Date.now() - started < 1000);
  const waits = await settleWithGrace([Promise.resolve(["a"]), new Promise((resolve) => setTimeout(() => resolve(["b"]), 30))], (first) => first.length >= 10 ? 0 : Infinity);
  assert.deepEqual(waits, [["a"], ["b"]], "a thin first result waits for the variants");
});
