import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const src = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("librarian QA does not request protected data until an access code is submitted", async () => {
  const jsx = await src("src/AdminPanel.jsx");
  assert.match(jsx, /type="password"/);
  assert.match(jsx, /onSubmit=\{authorize\}/);
  assert.match(jsx, /Authorization: `Bearer \$\{token\}`/);
  assert.match(jsx, /credentials: "same-origin"/);
  assert.doesNotMatch(jsx, /useEffect/);
  assert.doesNotMatch(jsx, /localStorage|sessionStorage/);
  assert.match(jsx, /\[401, 403, 404\]\.includes\(response\.status\)/);
});

test("authorized QA supports local plan, source-contract, and provenance inspection", async () => {
  const jsx = await src("src/AdminPanel.jsx");
  for (const label of [
    "Interpreted research specification",
    "Exact source-mode contract",
    "Exact plan validation and failure contract",
    "Recommendation provenance",
    "Why it fits",
    "Query dialect",
    "Maintenance owner",
    "Review status",
  ]) {
    assert.match(jsx, new RegExp(label, "i"));
  }
  assert.match(jsx, /Export review packet/);
  assert.match(jsx, /downloadJson/);
  assert.match(jsx, /does not edit resource configuration/i);
});

test("application retains research spec and release trace data from compatible response shapes", async () => {
  const app = await src("src/App.jsx");
  assert.match(app, /finalPayload\.researchSpec/);
  assert.match(app, /finalPayload\.reply\?\.research_spec/);
  assert.match(app, /finalPayload\.releaseId/);
  assert.match(app, /finalPayload\.researchPlan/);
  assert.match(app, /reviewPackets=\{librarianReviewPackets\}/);
  assert.match(app, /onRerunInterpretation=\{rerunInterpretation\}/);
});

test("student recommendations disclose configured provenance", async () => {
  const message = await src("src/AssistantMessage.jsx");
  assert.match(message, /Why this was recommended and provenance/);
  for (const field of [
    "sourceKinds",
    "queryDialect",
    "whyFits",
    "notBestFor",
    "maintenanceOwner",
    "reviewStatus",
    "configReviewedOn",
    "librarianReviewedOn",
  ]) {
    assert.match(message, new RegExp(field));
  }
});
