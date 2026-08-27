import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
