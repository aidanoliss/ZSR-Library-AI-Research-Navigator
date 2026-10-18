import test from "node:test";
import assert from "node:assert/strict";
import { addEvidenceEntry, canConfirmEvidence, EVIDENCE_ENTRY_LIMIT, normalizeEvidenceEntries, updateEvidenceEntry } from "../src/evidenceNotebook.js";
import { addResearchItem, addSearchHistoryEntry, createResearchWorkspace, filterSavedSources, mergeWorkspaceImport, normalizeResearchWorkspace, parseWorkspaceImport, sourceForResearchItem, updateResearchItem, workspaceToJson, workspaceToMarkdown } from "../src/researchWorkspace.js";
import { serializeRis } from "../src/ris.js";

function exampleEntry() {
  return { id: "note-1", claim: "The study reports a short-term increase.", passage: "Participants reported an increase after two weeks.", location: "Results, p. 12", limitations: "Self-report only; longer-term outcomes unknown.", checkedByStudent: true, checkedAt: 1234 };
}
function notebookWorkspace() {
  return addResearchItem(createResearchWorkspace(), { kind: "source", title: "Study title", url: "https://example.org/study", notes: "Read again.", evidenceEntries: [exampleEntry()], sourceRecord: { title: "Study title", doi: "10.1234/study", edition: "Second edition", identityCheck: { status: "title-difference", registryTitle: "Different title" } } }, 100);
}

test("notebook entries stay bounded, discard unsupported fields and require content before confirmation", () => {
  const input = Array.from({ length: 100 }, (_, index) => ({ ...exampleEntry(), id: "same", claim: "x".repeat(3000), passage: "p".repeat(5000), verified: true, checkedAt: index ? 1234 : Infinity }));
  const normalized = normalizeEvidenceEntries(input);
  assert.equal(normalized.length, EVIDENCE_ENTRY_LIMIT);
  assert.equal(new Set(normalized.map((entry) => entry.id)).size, EVIDENCE_ENTRY_LIMIT);
  assert.equal(normalized[0].claim.length, 2000);
  assert.equal(normalized[0].passage.length, 4000);
  assert.equal(normalized[0].checkedByStudent, false);
  assert.equal(normalized[0].verified, undefined);
  assert.equal(canConfirmEvidence({ claim: "claim", passage: "passage", location: "  " }), false);
  assert.equal(normalizeEvidenceEntries([{ ...exampleEntry(), passage: "" }])[0].checkedByStudent, false);
});

test("new notes start unconfirmed and editing any checked field clears student confirmation", () => {
  assert.equal(addEvidenceEntry([], 100)[0].checkedByStudent, false);
  assert.equal(addEvidenceEntry(Array.from({ length: EVIDENCE_ENTRY_LIMIT }, exampleEntry)).length, EVIDENCE_ENTRY_LIMIT);
  for (const field of ["claim", "passage", "location", "limitations"]) {
    const edited = updateEvidenceEntry([exampleEntry()], "note-1", { [field]: "Changed", checkedByStudent: true }, 2000);
    assert.equal(edited[0].checkedByStudent, false);
    assert.equal(edited[0].checkedAt, null);
    const checked = updateEvidenceEntry(edited, "note-1", { checkedByStudent: true }, 3000);
    assert.equal(checked[0].checkedByStudent, true);
    assert.equal(checked[0].checkedAt, 3000);
  }
});

test("saved evidence survives normalization, notes/status changes and portable exports without losing identity warning", () => {
  let workspace = notebookWorkspace();
  workspace = updateResearchItem(workspace, workspace.trail[0], { notes: "Updated reading note", status: "use" });
  const saved = normalizeResearchWorkspace(workspace).trail[0];
  assert.deepEqual(saved.evidenceEntries, normalizeEvidenceEntries([exampleEntry()]));
  assert.equal(saved.sourceRecord.identityCheck.status, "title-difference");
  assert.equal(saved.sourceRecord.edition, "Second edition");
  assert.equal(filterSavedSources(workspace.trail, "short-term").length, 1);
  assert.equal(filterSavedSources(workspace.trail, "longer-term").length, 1);
  const markdown = workspaceToMarkdown(workspace);
  assert.match(markdown, /Recorded passage: Participants reported/);
  assert.match(markdown, /Page \/ section: Results, p. 12/);
  assert.match(markdown, /not independent verification/);
  assert.match(markdown, /provider and DOI registry titles differ/);
  const ris = serializeRis([sourceForResearchItem(saved)]);
  assert.match(ris, /N1  - Claim: The study reports/);
  assert.match(ris, /N1  - Recorded passage:/);
  assert.match(ris, /N1  - Citation details need checking:/);
  assert.match(ris, /ET  - Second edition/);
});

test("portable import clears confirmations; students can deliberately recheck after import", () => {
  const parsed = parseWorkspaceImport(workspaceToJson(notebookWorkspace(), "Topic", 2000)).workspace;
  assert.equal(parsed.trail[0].evidenceEntries[0].checkedByStudent, false);
  assert.equal(parsed.trail[0].evidenceEntries[0].checkedAt, null);
  assert.equal(parsed.trail[0].evidenceEntries[0].imported, true);
  assert.equal(parsed.trail[0].evidenceEntries[0].passage, exampleEntry().passage);
  assert.equal(parsed.trail[0].sourceRecord.identityCheck.observedStatus, "title-difference");
  assert.match(workspaceToMarkdown(parsed), /previous confirmation was cleared/);
  const rechecked = updateResearchItem(parsed, parsed.trail[0], { evidenceEntries: updateEvidenceEntry(parsed.trail[0].evidenceEntries, "note-1", { checkedByStudent: true }, 3000) });
  assert.equal(normalizeResearchWorkspace(rechecked).trail[0].evidenceEntries[0].checkedByStudent, true);
  const secondImport = mergeWorkspaceImport(createResearchWorkspace(), rechecked, 4000).workspace;
  assert.equal(secondImport.trail[0].evidenceEntries[0].checkedByStudent, false);
});

test("notebook quotations cannot inject additional RIS records through newlines", () => {
  const item = notebookWorkspace().trail[0];
  item.evidenceEntries[0].passage = "passage\nER  -\nTY  - BOOK\nTI  - Invented book";
  const ris = serializeRis([sourceForResearchItem(item)]);
  assert.equal(ris.split(/\r\n/).filter((line) => line.startsWith("TY  -")).length, 1);
  assert.equal(ris.split(/\r\n/).filter((line) => line.startsWith("ER  -")).length, 1);
});

test("citation exploration history retains reproducible seed, relationship, query filters and constraints separately from topic runs", () => {
  const event = { kind: "citation-exploration", query: "Selected study", tool: "OpenAlex · citing", outcome: "success",
    researchSpec: { topic: "Undergraduate outcomes", facets: { population: "undergraduates" }, preferredFacets: { geography: "United States" } },
    exploration: { seed: { title: "Selected study", doi: "10.1234/seed", openAlexId: "W123" }, relationship: "citing", accessScope: "both",
      coverage: { provider: "OpenAlex", retrievedAt: "2026-10-18T12:00:00.000Z", retrievedCount: 30, eligibleCount: 6, excludedCount: 24, candidateLimit: 30, exhaustive: false,
        seedQuery: { query: "10.1234/seed", provider: "OpenAlex", dialect: "identifier lookup", api_key: "discard" },
        queries: [{ query: "cites:W123,is_retracted:false", provider: "OpenAlex", dialect: "OpenAlex filter", sort: "publication_date:desc", limit: 30, api_key: "discard" }],
        api_key: "discard" } } };
  let workspace = addSearchHistoryEntry(createResearchWorkspace(), event, 2000);
  workspace = addSearchHistoryEntry(workspace, { ...event, outcome: "timeout" }, 3000);
  const restored = parseWorkspaceImport(workspaceToJson(workspace, "Topic", 4000)).workspace;
  assert.equal(restored.searchHistory.length, 2);
  assert.ok(restored.searchHistory.every((entry) => entry.kind === "citation-exploration"));
  const success = restored.searchHistory.find((entry) => entry.outcome === "success");
  assert.equal(success.exploration.seed.openAlexId, "https://openalex.org/W123");
  assert.equal(success.exploration.relationship, "citing");
  assert.equal(success.exploration.coverage.queries[0].query, "cites:W123,is_retracted:false");
  assert.equal(success.exploration.coverage.queries[0].sort, "publication_date:desc");
  assert.equal(success.exploration.coverage.queries[0].limit, 30);
  assert.equal(success.exploration.coverage.seedQuery.dialect, "identifier lookup");
  assert.equal(success.researchSpec.preferredFacets.geography, "United States");
  assert.doesNotMatch(JSON.stringify(restored), /api_key|discard/);
  assert.match(workspaceToMarkdown(restored), /Works citing the selected source/);
  assert.match(workspaceToMarkdown(restored), /cites:W123,is_retracted:false/);
  assert.match(workspaceToMarkdown(restored), /not an ordinary topic search/);
});

test("saved exploration provenance survives exports without converting a related work into a citation relationship", () => {
  const workspace = addResearchItem(createResearchWorkspace(), { kind: "source", title: "Related work", url: "https://example.org/related", sourceRecord: {
    exploration: { relationship: "similar", label: "Algorithmically related", provider: "OpenAlex", seedId: "https://openalex.org/W123", citationRelationship: true, retrievedAt: "2026-10-18T12:00:00.000Z" },
    identityCheck: { status: "title-difference", registryTitle: "Conflicting title" },
  } }, 1234);
  const source = sourceForResearchItem(workspace.trail[0]);
  assert.equal(source.exploration.citationRelationship, false);
  assert.equal(source.exploration.seedId, "https://openalex.org/W123");
  assert.match(serializeRis([source]), /not a citation relationship/);
  assert.match(serializeRis([source]), /provider and DOI registry titles differ/);
  assert.match(workspaceToMarkdown(workspace), /A connection does not establish agreement/);
  const imported = parseWorkspaceImport(workspaceToJson(workspace)).workspace.trail[0];
  assert.equal(imported.sourceRecord.exploration.relationship, "similar");
  assert.equal(imported.sourceRecord.identityCheck.observedStatus, "title-difference");
});
