import test from "node:test";
import assert from "node:assert/strict";

import { buildResearchPlan } from "../config/researchAgent.js";
import { requestContextFromBody } from "../server/requestContext.js";

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
