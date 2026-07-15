import test from "node:test";
import assert from "node:assert/strict";
import { retrieveResources } from "../server/retrieve.js";

test("navigation retrieval returns only task-oriented ZSR entry points", async () => {
  const ids = (await retrieveResources("Help me navigate ZSR", 6)).map((resource) => resource.id);

  assert.deepEqual(ids, ["zsr-homepage", "databases-az", "research-guides", "ask-a-librarian"]);
});

test("broad surveillance topics do not leak unrelated business resources", async () => {
  const ids = (await retrieveResources("The impact of survelliance on citizens", 6)).map((resource) => resource.id);

  assert.ok(ids.includes("databases-az"));
  assert.ok(ids.includes("research-guides"));
  assert.ok(ids.includes("ask-a-librarian"));
  assert.equal(ids.includes("business-guide"), false);
});
