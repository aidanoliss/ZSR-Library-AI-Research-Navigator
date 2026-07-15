import test from "node:test";
import assert from "node:assert/strict";

import { shouldLookupCatalog } from "../server/catalogIntent.js";

test("first-turn source modes can use catalog discovery", () => {
  assert.equal(shouldLookupCatalog("AI and cognitive offloading in college students", "hybrid", 1), true);
  assert.equal(shouldLookupCatalog("Find peer-reviewed sources on climate justice", "sources", 1), true);
});

test("brainstorming and narrowing turns never search the catalog", () => {
  assert.equal(shouldLookupCatalog("Give me three different research angle options", "hybrid", 2), false);
  assert.equal(shouldLookupCatalog("Help me narrow this into a research question", "sources", 2), false);
  assert.equal(shouldLookupCatalog("Brainstorm topics about artificial intelligence", "hybrid", 1), false);
});

test("follow-ups search only when they explicitly request discovery", () => {
  assert.equal(shouldLookupCatalog("Find source leads for the second option", "hybrid", 2), true);
  assert.equal(shouldLookupCatalog("How should I evaluate what I found?", "hybrid", 2), false);
  assert.equal(shouldLookupCatalog("Help me cite this in APA", "hybrid", 2), false);
});
