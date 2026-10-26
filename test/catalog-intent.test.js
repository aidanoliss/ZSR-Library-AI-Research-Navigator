import test from "node:test";
import assert from "node:assert/strict";

import { shouldLookupCatalog } from "../server/catalogIntent.js";

test("first-turn source modes can use catalog discovery", () => {
  assert.equal(shouldLookupCatalog("AI and cognitive offloading in college students", "hybrid", 1), true);
  assert.equal(shouldLookupCatalog("Find peer-reviewed sources on climate justice", "sources", 1), true);
});

test("Answer + sources searches a complete brainstorming topic while planning-only modes can defer", () => {
  assert.equal(shouldLookupCatalog("Give me three different research angle options about Keynesian economics", "hybrid", 2), true);
  assert.equal(shouldLookupCatalog("Help me narrow this into a research question", "sources", 2), false);
  assert.equal(shouldLookupCatalog("Brainstorm topics about artificial intelligence", "hybrid", 1), true);
});

test("follow-ups search only when they explicitly request discovery", () => {
  assert.equal(shouldLookupCatalog("Find source leads for the second option", "hybrid", 2), true);
  assert.equal(shouldLookupCatalog("How should I evaluate what I found?", "hybrid", 2), false);
  assert.equal(shouldLookupCatalog("Help me cite this in APA", "hybrid", 2), false);
});

test("an edited search brief always requests fresh source discovery", () => {
  assert.equal(shouldLookupCatalog("Apply the corrected population", "answer", 3), false);
  assert.equal(shouldLookupCatalog("Apply the corrected population", "answer", 3, { correctedResearchSpec: true }), true);
});

test("guided planning and explore mode search a substantive question without a source keyword", () => {
  for (const style of ['plan','answer']) assert.equal(shouldLookupCatalog('do vaccines cause autism', style, 1), true);
  assert.equal(shouldLookupCatalog('urban tree canopy and neighborhood temperatures','plan',1),true);
  assert.equal(shouldLookupCatalog('Help narrow this research question','plan',2),false);
  assert.equal(shouldLookupCatalog('Help me cite this in APA','answer',2),false);
});

test("guided choices and scoped refinements request discovery across response styles", () => {
  assert.equal(shouldLookupCatalog('do vaccines cause autism','plan',1,{plannerContext:'Publication date: Last 5 years'}),true);
  for (const text of ['What about children?','systematic reviews only','recent peer reviewed only','any stronger studies','change time range']) assert.equal(shouldLookupCatalog(text,'plan',2,{previousResearchSpec:{topic:'vaccines and autism'}}),true,text);
});
