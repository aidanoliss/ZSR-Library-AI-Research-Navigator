import test from "node:test";
import assert from "node:assert/strict";
import { retrieveResources } from "../server/retrieve.js";
import { buildResearchPlan, normalizeSearchOptionKey } from "../config/researchAgent.js";

test("navigation retrieval returns only task-oriented ZSR entry points", async () => {
  const ids = (await retrieveResources("Help me navigate ZSR", 6)).map((resource) => resource.id);

  assert.deepEqual(ids, ["zsr-homepage", "databases-az", "research-guides", "ask-a-librarian"]);
});

test("substantive surveillance topics return named databases without navigation padding", async () => {
  const ids = (await retrieveResources("The impact of survelliance on citizens", 6)).map((resource) => resource.id);

  assert.ok(ids.includes("socindex"));
  assert.ok(ids.includes("proquest-political-science"));
  assert.equal(ids.includes("databases-az"), false);
  assert.equal(ids.includes("research-guides"), false);
  assert.equal(ids.includes("ask-a-librarian"), false);
  assert.equal(ids.includes("business-guide"), false);
});

test("server retrieval uses the authoritative named-database plan", async () => {
  const queries = [
    "AI and cognitive offloading in college students",
    "protein folding and disease",
    "market data on energy drinks",
    "typographic watermarks in privately printed almanacs",
    "misinformation and public trust",
    "quantum sensors for precision agriculture",
  ];
  const genericIds = new Set([
    "zsr-homepage",
    "databases-az",
    "research-guides",
    "ask-a-librarian",
    "business-guide",
  ]);

  for (const query of queries) {
    const expected = buildResearchPlan(query, 6).recommendations.map((resource) => resource.id);
    const resources = await retrieveResources(query, 6);
    const ids = resources.map((resource) => resource.id);
    const queryKeys = resources.map((resource) => normalizeSearchOptionKey(resource.recommended_query));

    assert.deepEqual(ids, expected, `${query} should use the deterministic routed shortlist`);
    assert.ok(resources.length > 0, `${query} should have at least one named database`);
    assert.ok(resources.every((resource) => !genericIds.has(resource.id)));
    assert.ok(resources.every((resource) => resource.recommended_query));
    assert.ok(resources.every((resource) => resource.recommended_filters.length >= 3));
    assert.equal(new Set(queryKeys).size, queryKeys.length, `${query} should assign distinct database queries`);
  }
});

test("citation utility requests can still return citation help without becoming topic recommendations", async () => {
  const ids = (await retrieveResources("How do I cite a website in APA?", 6)).map((resource) => resource.id);

  assert.deepEqual(ids, ["citation-zotero", "research-guides"]);
});
