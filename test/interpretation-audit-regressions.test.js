import test from "node:test";
import assert from "node:assert/strict";
import { buildResearchSpec, researchSpecQuery, inferExplicitModeRequest } from "../config/researchSpec.js";
import { sourceQueryVariants } from "../config/searchQueries.js";
import { extractSourceRequirements } from "../config/sourceRequirements.js";
import { buildResearchPlan, recommendResources, classifyResearchIntent } from "../config/researchAgent.js";
import { rankSourceResults } from "../server/sourceRelevance.js";
import { buildSearchRecovery } from "../config/searchRecovery.js";

const terms = (spec) => spec.concepts.map((concept) => concept.preferredTerm.toLowerCase());

test("comparison instructions keep actual arms across verbs and paraphrases", () => {
  for (const query of [
    "Find randomized controlled trials comparing cognitive behavioral therapy with mindfulness for anxiety among undergraduate students in the United States.",
    "Find randomized controlled trials of cognitive behavioral therapy compared with mindfulness for anxiety among undergraduate students in the United States.",
    "Compare cognitive behavioral therapy and mindfulness for anxiety among undergraduates in the United States using randomized controlled trials.",
  ]) {
    const spec = buildResearchSpec(query);
    assert.deepEqual(spec.comparison.terms.map((term) => term.toLowerCase()), ["cognitive behavioral therapy", "mindfulness"]);
    assert.equal(spec.facets.population, "undergraduates");
    assert.deepEqual(spec.methodRequirements.include, ["randomized controlled trial"]);
    for (const compiled of sourceQueryVariants(spec)) {
      assert.doesNotMatch(compiled, /\bcompar(?:ing|ed|e)\b/i);
      assert.match(compiled, /mindfulness/);
      assert.match(compiled, /undergraduates/);
    }
  }
  assert.ok(terms(buildResearchSpec("Research on social comparison and body image")).some((term) => term.includes("social comparison")), "comparison as a research subject is retained");
});

test("comparison outcomes and first-year populations do not become comparison arms", () => {
  const spec = buildResearchSpec("Find empirical studies comparing the effects of AI writing assistants and peer feedback on first-year college students writing skills.");
  assert.deepEqual(spec.comparison.terms, ["AI writing assistants", "peer feedback"]);
  assert.equal(spec.facets.population, "first-year college students");
  assert.match(researchSpecQuery(spec), /\("AI writing assistants" OR "peer feedback"\)/);
  assert.match(researchSpecQuery(spec), /"first-year college students"/);
  assert.equal(buildResearchSpec("Sleep in first year university students").facets.population, "first-year university students");
  assert.equal(buildResearchSpec("Sleep in college students").facets.population, "college students");
  assert.equal(buildResearchSpec("Sleep in first-year students").facets.population, "first-year students", "ambiguous first-year level is not silently called college");
});

test("historical identifiers and publication dates retain separate meanings", () => {
  for (const war of ["World War II", "world war ii", "Second World War", "WWII"]) {
    const spec = buildResearchSpec(`Find peer-reviewed articles published since 2020 about women workers in Britain during ${war}, 1939 to 1945.`);
    assert.ok(terms(spec).some((term) => /world war ii|second world war|wwii/i.test(term)));
    assert.equal(spec.sourceRequirements.publicationYearFrom, 2020);
    assert.equal(spec.facets.timePeriod, "1939 to 1945");
    assert.equal(spec.facets.population, "women");
    assert.doesNotMatch(researchSpecQuery(spec), /"World War"(?:\s|$)/);
  }
  assert.match(researchSpecQuery(buildResearchSpec("Civilian work during World War I")), /World War I/);
  assert.doesNotMatch(researchSpecQuery(buildResearchSpec("Civilian work during World War I")), /World War II/);
  assert.match(researchSpecQuery(buildResearchSpec("Diplomacy under Charles II")), /\bII\b/);
});

test("known-item publication instructions do not pollute author identity or study period", () => {
  for (const date of ["published in 2024", "publication year: 2024"]) {
    const spec = buildResearchSpec(`Find the book Quantum Librarians of the Invisible Moon by Amelia Quasar, ${date}.`);
    assert.equal(spec.knownItem.author, "Amelia Quasar");
    assert.equal(spec.facets.timePeriod, "");
    assert.equal(spec.sourceRequirements.publicationYearFrom, 2024);
    assert.equal(spec.sourceRequirements.publicationYearTo, 2024);
    assert.doesNotMatch(researchSpecQuery(spec), /2024|published|publication/);
  }
  assert.equal(extractSourceRequirements("Evictions in 2024").publicationYearFrom, null);
  const literalTitle = buildResearchSpec('Find the book "Published in 2024" by Jane Smith');
  assert.equal(literalTitle.knownItem.title, "Published in 2024");
  assert.equal(literalTitle.sourceRequirements.publicationYearFrom, null);
  assert.equal(buildResearchSpec("The effects of publication bias on research").knownItem, null);
});

test("requested dataset objects route to data tools while research about data stays scholarly", () => {
  for (const prefix of ["primary datasets", "public data sets", "historical datasets", "raw datasets"]) {
    const query = `Find ${prefix} on housing affordability and eviction in Forsyth County, North Carolina from 2015 to 2024.`;
    const spec = buildResearchSpec(query);
    assert.equal(spec.mode, "data");
    assert.equal(spec.facets.timePeriod, "2015 to 2024");
    assert.doesNotMatch(researchSpecQuery(spec), /\b(?:primary|public|raw)\b/i);
    assert.ok(recommendResources(query).some((resource) => resource.id === "icpsr"));
  }
  assert.equal(inferExplicitModeRequest("Find scholarly studies about primary datasets in economics"), "scholarly");
  assert.equal(inferExplicitModeRequest("Find primary datasets about housing", "books"), "books", "an explicit nondefault source selector remains authoritative");
  assert.equal(inferExplicitModeRequest("Find scholarly books about urban housing"), "books");
});

test("alternative archival formats stay grouped and receive collection-level routes", () => {
  for (const formats of ["letters and diaries", "letters or diaries", "diaries and letters"]) {
    const query = `Find primary sources: ${formats} by enslaved or formerly enslaved people in North Carolina before 1865.`;
    const spec = buildResearchSpec(query);
    assert.equal(spec.mode, "primary");
    assert.match(researchSpecQuery(spec), /\(letters OR diaries\)/);
    assert.match(researchSpecQuery(spec), /\("enslaved people" OR "formerly enslaved people"\)/);
    assert.equal(spec.facets.timePeriod, "before 1865");
    const routes = recommendResources(query);
    assert.deepEqual(routes.slice(0, 2).map((route) => route.id), ["special-collections", "digital-collections"]);
    assert.match(routes[0].nextStep, /finding aids/);
  }
});

test("empty datasets and archival searches have specialized recovery without claiming scarcity", () => {
  const attempts = { catalog: [{ status: "empty", retrievedCount: 0 }] };
  for (const query of ["Find primary datasets on housing", "Find primary sources: letters and diaries about wartime nursing"]) {
    const spec = buildResearchSpec(query);
    const recovery = buildSearchRecovery(spec, { outcomes: attempts });
    assert.equal(recovery.kind, "manual");
    assert.equal(recovery.researchSpec, spec);
    assert.match(recovery.explanation, /does not establish/);
    assert.match(recovery.explanation, spec.mode === "data" ? /codebook/ : /finding aids/);
    assert.equal(buildSearchRecovery(spec, { outcomes: { catalog: [{ status: "timeout" }] } }).kind, "retry", "an outage is still distinguished from a completed empty search");
  }
});


test("explicit world-war history routes to humanities while clinical women studies retain medical tools", () => {
  for (const war of ["World War II", "Second World War", "WWII", "First World War"]) {
    const plan = buildResearchPlan(`Find peer-reviewed articles published since 2020 about women workers in Britain during ${war}, 1939 to 1945.`);
    assert.equal(plan.researchSpec.facets.geography, "Britain");
    assert.ok(!classifyResearchIntent(plan.researchSpec.topic).some((intent) => intent.id === "known-item"));
    assert.equal(plan.recommendations[0].id, "historical-abstracts");
    assert.ok(!plan.recommendations.some((resource) => resource.id === "pubmed-medline"));
  }
  assert.ok(classifyResearchIntent("Smith JA. (2020). Clinical outcomes in older adults").some((intent) => intent.id === "known-item"));
  const clinical = buildResearchPlan("Find clinical studies of treatment for women with heart disease in Britain");
  assert.equal(clinical.researchSpec.facets.geography, "Britain");
  assert.ok(clinical.recommendations.some((resource) => resource.id === "pubmed-medline"));
  const explicitMedical = buildResearchPlan("Medicine during World War II", 5, "biology-health");
  assert.ok(explicitMedical.recommendations.some((resource) => resource.id === "pubmed-medline"), "an explicit medical subject selector remains authoritative");
});


test("educational modality comparison ellipsis retains the shared head without widening to online anything", () => {
  for (const [phrasing, expected] of [
    ["online and in-person teaching", ["online teaching", "in-person teaching"]],
    ["in-person and online teaching", ["in-person teaching", "online teaching"]],
    ["online teaching and in-person", ["online teaching", "in-person teaching"]],
    ["remote versus face-to-face instruction", ["remote instruction", "face-to-face instruction"]],
  ]) {
    const spec = buildResearchSpec(`Find studies comparing ${phrasing} for undergraduate students in the United States.`);
    assert.deepEqual(spec.comparison.terms, expected);
    for (const query of sourceQueryVariants(spec)) {
      for (const term of expected) assert.ok(query.includes(`"${term}"`));
    }
    assert.equal(spec.facets.population, "undergraduates");
    assert.equal(spec.facets.geography, "United States");
  }
  const quoted = buildResearchSpec('Compare "online" and "in-person teaching"');
  assert.deepEqual(quoted.comparison.terms, ["online", "in-person teaching"]);
  const unrelated = buildResearchSpec("Compare online communities and in-person therapy");
  assert.deepEqual(unrelated.comparison.terms, ["online communities", "in-person therapy"]);
  const noHead = buildResearchSpec("Compare online and peer feedback");
  assert.deepEqual(noHead.comparison.terms, ["online", "peer feedback"]);
  const literal = buildResearchSpec('Compare "online and in-person teaching" and "classroom discourse"');
  assert.ok(literal.concepts.some((concept) => concept.preferredTerm === "online and in-person teaching"));
});


test("incidental online surveys do not satisfy an online-teaching comparison arm", () => {
  const spec = buildResearchSpec("Compare online and in-person teaching among undergraduates in the United States");
  const offTopic = { title: "Self-compassion and stress", type: "article", url: "https://example.test/online-survey", abstractText: "We recruited undergraduates in the United States for an online survey about self-compassion and stress." };
  const oneArm = { title: "Online teaching outcomes among undergraduates in the United States", type: "article", url: "https://example.test/online-teaching", abstractText: "We studied online teaching among undergraduates in the United States." };
  const ranked = rankSourceResults([offTopic, oneArm], spec);
  assert.deepEqual(ranked.map((source) => source.url), [oneArm.url]);
  assert.equal(ranked[0].matchExplanation.status, "partial");
});
