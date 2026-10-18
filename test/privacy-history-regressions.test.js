import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PRIVATE_MODE_KEY, readPrivateMode, setPrivateModePreference } from "../src/researchPrivacy.js";
import { searchRunSnapshot } from "../src/searchRunHistory.js";

test("privacy preference persists only a tab flag and works with blocked storage", () => {
  const values = new Map([["saved-research", "prior notes"]]);
  const storage = { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  setPrivateModePreference(true, storage);
  assert.equal(readPrivateMode(storage), true);
  assert.deepEqual([...values], [["saved-research", "prior notes"], [PRIVATE_MODE_KEY, "true"]]);
  setPrivateModePreference(false, storage);
  assert.equal(readPrivateMode(storage), false);
  assert.equal(values.get("saved-research"), "prior notes");
  const blocked = { getItem(){ throw Error(); }, setItem(){ throw Error(); }, removeItem(){ throw Error(); } };
  assert.doesNotThrow(() => setPrivateModePreference(true, blocked));
  assert.equal(readPrivateMode(blocked), false);
});

test("run snapshots retain observed query attempts without inventing execution of suggestions", () => {
  const run = searchRunSnapshot({ id:"run-1", originalRequest:"WWII letters", startedAt:"2026-10-18T10:00:00Z", completedAt:1234, status:"partial", payload:{
    releaseId:"release-1", liveResults:[{}], researchSpec:{ topic:"World War II", mode:"primary-sources" },
    researchPlan:{searchTerms:["UNEXECUTED SUGGESTION"]},
    sourceDiscovery:{lanes:{library:{requested:true, attempts:[{provider:"Primo", query:'"World War II" AND letters',status:"success",resultCount:1},{provider:"Crossref",query:"WWII letters",status:"timeout"}]},openAccess:{requested:false}}},
  }});
  assert.equal(run.queries.length,2);
  assert.equal(run.providers[1].status,"timeout");
  assert.equal(run.providers[1].count,null);
  assert.equal(run.startedAt,Date.parse("2026-10-18T10:00:00Z"));
  assert.equal(run.resultCount,1);
  assert.doesNotMatch(JSON.stringify(run),/UNEXECUTED/);
  assert.match(run.resultNote,/not verified relevant studies/);
  const failed = searchRunSnapshot({ originalRequest:"WWII letters",status:"error" });
  assert.equal(failed.queries.length,0);
  assert.match(failed.resultNote,/not supplied/);
});

test("gold source-button normal and hover backgrounds meet AA with white text", async () => {
  const css = await readFile(new URL("../src/resultsWorkspace.css",import.meta.url),"utf8");
  const rules = [...css.matchAll(/a\.source-open-button\[href\](?::hover)?\s*\{([^}]+)\}/g)];
  assert.equal(rules.length,2);
  for(const [,body] of rules){
    const hex = body.match(/background:\s*#([a-f0-9]{6})/i)[1];
    const rgb = [0,2,4].map(i => parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
    const ratio = 1.05/(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]+.05);
    assert.ok(ratio>=4.5, `${hex}: ${ratio}`);
  }
});

test("run execution settings and outcome survive portable history without replacing notes", async () => {
  const { addSearchRun, createResearchWorkspace, workspaceToJson, parseWorkspaceImport } = await import("../src/researchWorkspace.js");
  const config = { accessScope: "both", subjectFocusId: "history", responseStyle: "sources" };
  const run = searchRunSnapshot({ originalRequest: "World War II", status: "cancelled", searchConfig: config });
  const workspace = addSearchRun(createResearchWorkspace(), run);
  const restored = parseWorkspaceImport(workspaceToJson(workspace)).workspace;
  assert.deepEqual(restored.searchHistory[0].searchConfig, config);
  assert.equal(restored.searchHistory[0].runStatus, "cancelled");
});
