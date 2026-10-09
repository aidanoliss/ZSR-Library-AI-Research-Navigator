import test from "node:test";
import assert from "node:assert/strict";
import { normalizePrimoDocs } from "../server/primo.js";
import { assessSourceRelevance, rankSourceResults } from "../server/sourceRelevance.js";
import { prepareSourceEvidence, validateEvidenceNotes } from "../server/sourceEvidence.js";
import { sourceForReview } from "../lib/searchQualityEvaluation.js";
import { assessSourceRequirements } from "../src/sourceAssessment.js";

const spec = { mode: "scholarly", concepts: [{ id: "canopy", preferredTerm: "urban canopy" }, { id: "birds", preferredTerm: "bird diversity" }] };
const intro = "Urban canopy provides ecosystem services. These benefits are important to city planning.";
const method = "We measured bird diversity in 120 urban canopy plots using acoustic surveys.";
const conclusion = "The observed association cannot establish that tree planting caused greater bird diversity.";
const abstract = `${intro} ${method} ${conclusion}`;
const doc = (text) => ({ pnx: { control: { recordid: ["canopy-study"] }, display: { title: ["Urban canopy structure"], type: ["article"], creationdate: ["2024"] }, addata: { abstract: [`<jats:p>${text}</jats:p>`] } } });

test("ranking retains relevant sources whose topic evidence follows the card preview", () => {
  const [source] = normalizePrimoDocs({ docs: [doc(abstract)] }, { query: "urban canopy bird diversity", researchSpec: spec });
  assert.ok(source, "the full abstract establishes both concepts");
  assert.equal(source.abstractText, abstract);
  assert.equal(source.abstractTruncated, false);
  assert.doesNotMatch(source.abstractExcerpt, /acoustic surveys/);
  assert.match(source.matchExplanation.evidence.find((item) => item.concept === "bird diversity").excerpt, /bird diversity/);
  assert.equal(source.matchExplanation.status, "meets");
  assert.equal(assessSourceRelevance({ ...source, abstractText: "" }, spec).status, "mismatch", "short preview alone does not establish the full topic");
});

test("abstract evidence includes later methods and limitations, but validates only supplied passages", () => {
  const [source] = normalizePrimoDocs({ docs: [doc(abstract)] }, { query: "urban canopy bird diversity", researchSpec: spec });
  const { sources, records } = prepareSourceEvidence([source]);
  assert.equal(records[0].abstract_excerpt, abstract);
  assert.equal(records[0].excerpt_truncated, false);
  const notes = [method, conclusion].map((quote) => ({ source_id: sources[0].evidenceId, quote, evidence_scope: "abstract" }));
  assert.deepEqual(validateEvidenceNotes({ evidence_notes: notes }, sources).fields.evidence_notes, notes);
  assert.equal(validateEvidenceNotes({ evidence_notes: [{ ...notes[1], quote: conclusion.replace("cannot", "can") }] }, sources).dropped[0].reason, "quote_not_in_provider_excerpt");
  assert.equal(validateEvidenceNotes({ evidence_notes: notes }, sources).fields.message_basis, "unverified_orientation");
});

test("provider and model bounds remain explicit for unusually large abstracts", () => {
  const [source] = normalizePrimoDocs({ docs: [doc(`${abstract} ${"Additional provider metadata. ".repeat(1200)}`)] }, { query: "urban canopy bird diversity", researchSpec: spec });
  assert.equal(source.abstractText.length, 20000);
  assert.equal(source.abstractTruncated, true);
  assert.ok(source.abstractExcerpt.length <= 363);
  assert.equal(prepareSourceEvidence([source]).records[0].excerpt_truncated, true);
});

test("combined interventions described later in the abstract do not become direct comparisons", () => {
  const comparisonSpec = { mode: "scholarly", concepts: [{ id: "cbt", preferredTerm: "CBT" }, { id: "mindfulness", preferredTerm: "mindfulness" }, { id: "anxiety", preferredTerm: "anxiety" }], comparison: { conceptIds: ["cbt", "mindfulness"], terms: ["CBT", "mindfulness"] } };
  const preview = "Anxiety affects many people. CBT and mindfulness are common approaches.";
  const source = { title: "CBT and mindfulness for anxiety", type: "article", abstractExcerpt: preview, abstractText: `${preview} We studied the combined effects of CBT and mindfulness. The combined intervention was compared to a wait-list control group.` };
  const match = assessSourceRelevance(source, comparisonSpec);
  assert.equal(match.category, "supporting");
  assert.equal(match.status, "partial");
  assert.equal(match.relationship.status, "combined-approach");
});

test("confirmed study scope outranks an otherwise equivalent source with unknown participants", () => {
  const scopedSpec = { ...spec, facets: { population: "college students" } };
  const common = { title: "Urban canopy and bird diversity", type: "article" };
  const unknown = { ...common, author: "Unknown Scope", abstractText: abstract };
  const confirmed = { ...common, author: "Confirmed Scope", abstractText: `${abstract} We recruited 120 college students to participate in acoustic surveys.` };
  const results = rankSourceResults([unknown, confirmed], scopedSpec);
  assert.equal(results[0].author, "Confirmed Scope");
  assert.equal(results[0].sourceAssessment.status, "meets");
  assert.equal(results[1].matchExplanation.status, "partial");
  assert.match(results[1].matchExplanation.label, /scope needs checking/);
});

test("the review capture retains fuller provider evidence without inventing a human rating", () => {
  const captured = sourceForReview({ title: "Urban canopy structure", abstractText: abstract, abstractExcerpt: intro, abstractTruncated: false }, 0);
  assert.equal(captured.abstractText, abstract);
  assert.equal(captured.abstractExcerpt, intro);
  assert.equal(captured.judgment, null);
});

test("interviewing teachers does not establish a student participant sample", () => {
  const source = { type: "article", abstractText: "We interviewed teachers of college students about their use of feedback." };
  assert.equal(assessSourceRequirements(source, { facets: { population: "college students" } }).checks[0].status, "unverified");
});

test("comparison labels require the requested relationship, not a discipline or unrelated comparison", () => {
  const comparisonSpec = { mode: "scholarly", concepts: [{ id: "sanctions", preferredTerm: "sanctions" }, { id: "autocracy", preferredTerm: "autocracy", synonyms: ["authoritarian", "autocratic"] }, { id: "democracy", preferredTerm: "democracy", synonyms: ["democratic"] }], comparison: { conceptIds: ["autocracy", "democracy"], terms: ["autocracy", "democracy"] } };
  const related = { type: "article", title: "Democracy versus autocracy promotion", abstractText: "A comparative foreign policy analysis argues that sanctions increased autocratic influence and weakened a transition to democracy." };
  const direct = { type: "article", title: "Sanctions and regime type", abstractText: "We compare responses to sanctions in authoritarian and democratic regimes." };
  const prior = { ...related, title: "Sanctions and regime type", abstractText: "Previous studies compared sanctions in authoritarian and democratic regimes. This paper describes a new database." };
  assert.equal(assessSourceRelevance(related, comparisonSpec).category, "supporting");
  assert.equal(assessSourceRelevance(prior, comparisonSpec).category, "supporting");
  assert.equal(rankSourceResults([related, direct], comparisonSpec)[0].title, direct.title);
});
