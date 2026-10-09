import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildResearchPlan } from "../config/researchAgent.js";

import {
  buildBoundedRefinementPrompt,
  buildInterpretationCorrectionPrompt,
  normalizeResearchSpec,
  researchSpecDiff,
  sourceContractLines,
} from "../src/researchInterpretation.js";

const base = {
  topic: "Social media and adolescent mental health",
  mode: "scholarly",
  disciplines: ["psychology", "communication"],
  concepts: [
    { id: "social-media", preferredTerm: "social media", synonyms: ["social networking"], required: true },
    { id: "mental-health", preferredTerm: "mental health", synonyms: [], required: true },
  ],
  facets: {
    population: "adolescents",
    geography: "",
    timePeriod: "last 10 years",
    method: "",
    documentType: "journal article",
  },
  sourceContract: {
    requiredSourceKinds: ["scholarly_article"],
    minimumCompatibleTopResults: 2,
  },
  planHash: "plan-123",
  configVersion: "wfu-2026.08",
};

test("normalizes the research specification without losing source-contract traceability", () => {
  const spec = normalizeResearchSpec(base);
  assert.equal(spec.topic, base.topic);
  assert.deepEqual(spec.disciplines, ["psychology", "communication"]);
  assert.deepEqual(spec.concepts.map((concept) => concept.preferredTerm), ["social media", "mental health"]);
  assert.equal(spec.facets.population, "adolescents");
  assert.equal(spec.planHash, "plan-123");
  assert.equal(spec.configVersion, "wfu-2026.08");
});

test("student corrections produce a visible, bounded field-by-field change set", () => {
  const edited = normalizeResearchSpec(base);
  edited.mode = "books";
  edited.facets = { ...edited.facets, timePeriod: "any date" };
  const changes = researchSpecDiff(base, edited);

  assert.deepEqual(changes.map((change) => change.field), ["timePeriod", "mode"]);
  assert.deepEqual(changes.map((change) => change.label), ["Date range", "Source type"]);

  const prompt = buildInterpretationCorrectionPrompt(base, edited);
  assert.match(prompt, /student-corrected research constraints/i);
  assert.match(prompt, /Date range from "last 10 years" to "any date"/);
  assert.match(prompt, /Source type from "scholarly" to "books"/);
  assert.match(prompt, /Preserve every field that the student did not change/i);
});

test("each quick refinement changes exactly one dimension", () => {
  for (const kind of ["too-broad", "too-narrow", "wrong-discipline", "wrong-source-type"]) {
    const prompt = buildBoundedRefinementPrompt(kind, { topic: base.topic, mode: "books" });
    assert.match(prompt, /Change exactly one field:/);
    assert.match(prompt, /Keep every other interpreted concept, facet, source constraint, and discipline unchanged/);
    assert.match(prompt, /state the one change you made/);
  }
  const sourceTypePrompt = buildBoundedRefinementPrompt("wrong-source-type", {
    topic: base.topic,
    mode: "scholarly",
    targetMode: "books",
  });
  assert.match(sourceTypePrompt, /source type from "scholarly" to "books"/);
});

test("source contract is disclosed in student-readable terms", () => {
  assert.deepEqual(sourceContractLines(base.sourceContract), [
    "Compatible source kinds: scholarly_article",
    "Top-result requirement: 2 compatible routes",
  ]);
});

test("editing publication requirements preserves topic concepts and records a precise correction", () => {
  const original = { ...base, sourceRequirements: { publicationYearFrom: 2020, publicationYearTo: null, requestedSourceCount: 4, peerReviewed: true } };
  const edited = normalizeResearchSpec(original);
  edited.sourceRequirements = { ...edited.sourceRequirements, publicationYearFrom: 2023 };
  assert.deepEqual(edited.concepts.map((item) => item.preferredTerm), base.concepts.map((item) => item.preferredTerm));
  assert.deepEqual(researchSpecDiff(original, edited).map((item) => item.field), ["publicationYearFrom"]);
  const prompt = buildInterpretationCorrectionPrompt(original, edited);
  assert.match(prompt, /Published from: 2023/);
  assert.match(prompt, /Peer review: Required/);
  assert.match(prompt, /Source target: 4/);
});

test("local source routes use the canonical corrected specification instead of correction instructions", async () => {
  const original = buildResearchPlan("medieval trade networks", 5, "auto", "books").researchSpec;
  const corrected = normalizeResearchSpec(original);
  corrected.sourceRequirements.publicationYearFrom = 2024;
  const correctionText = buildInterpretationCorrectionPrompt(original, corrected);
  assert.match(correctionText, /student-corrected research constraints/);

  // An assistant message's topic prop can contain the generated correction request.
  const topic = correctionText;
  const canonicalSpec = corrected;
  const localPlan = buildResearchPlan(canonicalSpec?.topic || topic, 5, "auto", "scholarly", { researchSpec: canonicalSpec });
  assert.equal(localPlan.query, original.topic);
  assert.equal(localPlan.modeId, "books");
  assert.equal(localPlan.researchSpec.sourceRequirements.publicationYearFrom, 2024);
  const conceptTerms = (spec) => spec.concepts.map(({ preferredTerm, synonyms, required }) => ({ preferredTerm, synonyms, required }));
  assert.deepEqual(conceptTerms(localPlan.researchSpec), conceptTerms(original));
  const routeQueries = [
    ...localPlan.searchTerms,
    ...localPlan.recommendations.flatMap((resource) => resource.searchTerms),
    ...localPlan.fallbacks.map((route) => route.query),
  ].filter(Boolean);
  assert.ok(routeQueries.length > 0);
  assert.match(routeQueries.join(" "), /medieval/i);
  assert.doesNotMatch(routeQueries.join(" "), /student-corrected|constraints|rebuild|Not specified|2024/i);

  // Guard the component integration as well as the pure planner behavior.
  const jsx = await readFile(new URL("../src/AssistantMessage.jsx", import.meta.url), "utf8");
  assert.match(jsx, /const canonicalSpec = researchSpec \|\| researchPlan\?\.researchSpec \|\| reply\.research_spec \|\| reply\.researchSpec/);
  assert.match(jsx, /buildResearchPlan\(canonicalSpec\?\.topic \|\| topic \|\| reply\.message \|\| "", 5, subjectFocusId, mode, \{ researchSpec: canonicalSpec \}\)/);
});

test("interpretation UI exposes editable fields, accessible change status, and all four refinements", async () => {
  const jsx = await readFile(new URL("../src/ResearchInterpretationPanel.jsx", import.meta.url), "utf8");
  assert.match(jsx, /How the navigator interpreted your request/);
  assert.match(jsx, /Rerun with corrections/);
  assert.match(jsx, /role="status"/);
  assert.match(jsx, /aria-live="polite"/);
  assert.match(jsx, /Too broad/);
  assert.match(jsx, /Too narrow/);
  assert.match(jsx, /Wrong discipline/);
  assert.match(jsx, /Wrong source type/);
  assert.match(jsx, /Apply one source-type change/);
  assert.match(jsx, /Source-mode contract/);
});

test("editing preserves exact-phrase and source metadata used by safe recovery", () => {
  const spec = normalizeResearchSpec({ ...base, concepts: [{ id: "quoted", preferredTerm: "floating wetlands", source: "parsed", exactPhrase: true, required: true }] });
  assert.equal(spec.concepts[0].source, "parsed");
  assert.equal(spec.concepts[0].exactPhrase, true);
  assert.equal(researchSpecDiff(spec, normalizeResearchSpec(spec)).length, 0);
});

test("recovery opens the editor, transfers focus, and requires explicit review before rerunning", async () => {
  const panel = await readFile(new URL("../src/ResearchInterpretationPanel.jsx", import.meta.url), "utf8");
  const assistant = await readFile(new URL("../src/AssistantMessage.jsx", import.meta.url), "utf8");
  assert.match(assistant, /onShowStrategy=\{\(\) => \{ setRecoveryEditor\(true\); setResultView\("strategy"\); setEditorRequest/);
  assert.match(panel, /if \(editorRequest > 0 && editorOpen\) topicInputRef\.current\?\.focus\(\)/);
  assert.match(panel, /Nothing has been submitted/);
  assert.match(panel, /Use suggested terms/);
  assert.match(panel, /Suggested terms are in the brief\. Review the changes/);
  assert.match(panel, /No safe automatic wording change is available/);
  assert.match(panel, /role="status" aria-live="polite"/);
});
