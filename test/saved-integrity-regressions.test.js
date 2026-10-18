import test from "node:test";
import assert from "node:assert/strict";
import {
  addResearchItem, addSearchHistoryEntry, addSearchRun, createResearchWorkspace, mergeWorkspaceImport,
  normalizeSourceRecord, parseWorkspaceImport, removeResearchItem, sourceForResearchItem,
  sourceIdentityNotes, updateResearchItem, workspaceToJson, workspaceToMarkdown,
} from "../src/researchWorkspace.js";
import { conversationToMarkdown, conversationToPlainText } from "../src/exportPlan.js";
import { serializeRis } from "../src/ris.js";

const disputedSource = {
  title: "Local election study", url: "https://example.org/elections", doi: "10.1234/elections",
  sourceProvider: "Primo", retrievedAt: "2026-10-18T10:00:00.000Z",
  identityCheck: { status: "title-difference", provider: "Crossref", doi: "10.1234/elections",
    registryTitle: "General election study", checkedAt: "2026-10-18T10:01:00.000Z",
    detail: "Provider and DOI registry titles differ.", url: "https://doi.org/10.1234/elections" },
};
const save = (source = disputedSource) => addResearchItem(createResearchWorkspace(), {
  kind: "catalog", title: source.title, url: source.url, sourceRecord: source,
}, 100);

test("known DOI conflicts survive save, edit, unsave/undo and every portable export", () => {
  let workspace = save();
  workspace = updateResearchItem(workspace, workspace.trail[0], { notes: "Read both records", status: "use" });
  const item = workspace.trail[0];
  assert.deepEqual(item.sourceRecord.identityCheck, disputedSource.identityCheck);
  workspace = addResearchItem(removeResearchItem(workspace, item), item);
  assert.deepEqual(workspace.trail[0], item);
  for (const output of [workspaceToMarkdown(workspace), serializeRis(sourceForResearchItem(item))]) {
    assert.match(output, /Citation details need checking/);
    assert.match(output, /General election study/);
    assert.match(output, /2026-10-18T10:01:00.000Z/);
    assert.match(output, /Crossref/);
  }
  assert.match(workspaceToJson(workspace), /title-difference/);
});

test("import keeps conflicts and unavailable checks historical without upgrading any verification", () => {
  for (const status of ["title-difference", "unverified", "title-matched"]) {
    const workspace = save({ ...disputedSource, identityCheck: { ...disputedSource.identityCheck, status } });
    const imported = parseWorkspaceImport(workspaceToJson(workspace)).workspace;
    const item = imported.trail[0];
    assert.equal(item.sourceRecord.identityCheck.status, "unverified");
    assert.equal(item.sourceRecord.identityCheck.observedStatus, status);
    assert.equal(item.sourceRecord.identityCheck.historical, true);
    assert.match(sourceIdentityNotes(item.sourceRecord).join(" "), /Imported historical check/);
    assert.match(serializeRis(sourceForResearchItem(item)), /not currently verified/);
    const twice = parseWorkspaceImport(workspaceToJson(imported)).workspace;
    assert.equal(twice.trail[0].sourceRecord.identityCheck.observedStatus, status);
    const merged = mergeWorkspaceImport(createResearchWorkspace(), imported).workspace;
    assert.equal(merged.trail[0].sourceRecord.identityCheck.status, "unverified");
  }
});

test("identity evidence is typed, bounded and cannot retain executable links", () => {
  const record = normalizeSourceRecord({ identityCheck: { status: "verified-real", provider: {}, registryTitle: "x".repeat(3000), url: "javascript:alert(1)", arbitrary: "ignored", checkedAt: ["not text"] } });
  assert.equal(record.identityCheck.status, "unverified");
  assert.equal(record.identityCheck.registryTitle.length, 1000);
  assert.equal(record.identityCheck.url, "");
  assert.equal(record.identityCheck.provider, undefined);
  assert.equal(record.identityCheck.checkedAt, undefined);
  assert.equal(record.identityCheck.arbitrary, undefined);
});

test("research plan export labels actual metadata providers and never falsely denies live discovery", () => {
  for (const providers of [["Primo"], ["Crossref"], ["OpenAlex"], ["Primo", "Crossref", "OpenAlex"], []]) {
    const messages = [{ role: "assistant", reply: {}, liveResults: providers.map((provider) => ({ ...disputedSource, sourceProvider: provider })) }];
    for (const output of [conversationToMarkdown(messages), conversationToPlainText(messages)]) {
      assert.doesNotMatch(output, /Live ZSR discovery leads|does not search live databases/);
      assert.match(output, /live provider metadata/);
      if (providers.length) {
        assert.match(output, /Retrieved source records/);
        assert.match(output, /Citation details need checking/);
        assert.match(output, /General election study/);
        assert.match(output, /2026-10-18T10:00:00.000Z/);
      }
      for (const provider of providers) assert.ok(output.includes(`Metadata provider: ${provider}`));
    }
  }
});

const firstRun = {
  originalRequest: "Find studies about sleep among US undergraduates since 2020", query: "sleep students",
  queries: [{ query: "sleep AND undergraduate", provider: "Crossref", dialect: "bibliographic" }],
  researchSpec: { topic: "sleep", mode: "scholarly", facets: { population: "undergraduates", geography: "United States" }, sourceRequirements: { publicationDate: { fromYear: 2020 } }, comparison: null, concepts: [{ id: "sleep", preferredTerm: "sleep", synonyms: ["sleep deprivation"] }], planHash: "first" },
  providers: [{ id: "Crossref", status: "timeout", count: 0, lane: "library", query: "sleep AND undergraduate" }],
  resultCount: 0, resultNote: "Timed out", releaseId: "abc123", configVersion: "resources-3", startedAt: 100, completedAt: 200,
};

test("same-query runs preserve changed population/date criteria and retry outcomes independently", () => {
  let workspace = addSearchRun(createResearchWorkspace(), firstRun, 200);
  workspace = addSearchRun(workspace, { ...firstRun, researchSpec: { ...firstRun.researchSpec, facets: { population: "children", geography: "Canada" }, sourceRequirements: { publicationDate: { fromYear: 2024 } } }, resultCount: 5, resultNote: "Different population" }, 300);
  workspace = addSearchRun(workspace, { ...firstRun, resultCount: 2, providers: [{ id: "Crossref", status: "success", count: 2 }], resultNote: "Retry succeeded" }, 400);
  assert.equal(workspace.searchHistory.length, 3);
  assert.equal(workspace.searchHistory[2].resultNote, "Timed out");
  assert.equal(workspace.searchHistory[0].resultNote, "Retry succeeded");
  assert.equal(workspace.searchHistory[1].researchSpec.facets.population, "children");
  const restored = parseWorkspaceImport(workspaceToJson(workspace)).workspace;
  assert.deepEqual(restored.searchHistory, workspace.searchHistory);
  const markdown = workspaceToMarkdown(restored);
  for (const expected of ["Timed out", "Retry succeeded", "children", "undergraduates", "2024", "2020", "bibliographic", "Crossref", "abc123", "resources-3", "Resolved criteria", "Original request", "completed"]) assert.ok(markdown.includes(expected), expected);
  const reimport = mergeWorkspaceImport(workspace, restored);
  assert.equal(reimport.addedSearches, 0);
  assert.equal(reimport.workspace.searchHistory.length, 3);
});

test("opened links and manual queries are distinct and never silently replace prior notes", () => {
  let workspace = addSearchHistoryEntry(createResearchWorkspace(), { query: "Sleep paper", tool: "Primo", url: "https://example.org/sleep", kind: "opened-resource", resultNote: "First opening" }, 100);
  workspace = addSearchHistoryEntry(workspace, { query: "Sleep paper", tool: "Primo", url: "https://example.org/sleep", kind: "opened-resource", resultNote: "Second opening" }, 100);
  workspace = addSearchHistoryEntry(workspace, { query: "sleep AND students", tool: "Manual note" }, 100);
  assert.equal(new Set(workspace.searchHistory.map((item) => item.id)).size, 3);
  assert.equal(workspace.searchHistory[2].resultNote, "First opening");
  const markdown = workspaceToMarkdown(workspace);
  assert.match(markdown, /## Opened resources/);
  assert.match(markdown, /## Searches recorded manually/);
  assert.doesNotMatch(markdown, /## Search runs/);
  assert.match(markdown, /https:\/\/example.org\/sleep/);
});

test("RIS includes edition metadata and keeps distinct un-identified editions", () => {
  const output = serializeRis([{ title: "A book", type: "book", edition: "First edition" }, { title: "A book", type: "book", edition: "Second edition" }]);
  assert.equal(output.split("TY  - BOOK").length - 1, 2);
  assert.match(output, /ET  - First edition/);
  assert.match(output, /ET  - Second edition/);
});

test("separate editions remain citable saved records but count once toward the source target", async () => {
  const { assignmentProgress } = await import("../src/workspaceRequirements.js");
  let workspace = createResearchWorkspace();
  workspace.assignment.sourceCount = "3";
  for (const [index, edition] of ["First edition", "Second edition"].entries()) {
    const source = { title: "The organization of research libraries", sourceKind: "book", type: "Book", authors: [{ given: "Alex", family: "Smith" }], edition, doi: `10.1234/book-${index}`, isbn: index ? "9780123456796" : "9780123456789" };
    workspace = addResearchItem(workspace, { kind: "catalog", title: source.title, url: `https://example.org/book-${index}`, status: "use", sourceRecord: source }, index + 1);
  }
  const before = structuredClone(workspace.trail);
  const progress = assignmentProgress(workspace);
  assert.equal(workspace.trail.length, 2);
  assert.equal(progress.selected, 1);
  assert.equal(progress.duplicates, 1);
  assert.deepEqual(workspace.trail, before);
  const ris = serializeRis(workspace.trail.map(sourceForResearchItem));
  assert.equal(ris.split("TY  - BOOK").length - 1, 2);
  assert.match(ris, /ET  - First edition/);
  assert.match(ris, /ET  - Second edition/);
});

test("chapter versions count once conservatively, without collapsing unrelated chapters", async () => {
  const { assignmentProgress } = await import("../src/workspaceRequirements.js");
  let workspace = createResearchWorkspace();
  const saveChapter = (id, source) => {
    workspace = addResearchItem(workspace, { kind: "catalog", title: source.title, url: `https://example.org/${id}`, status: "use", sourceRecord: { ...source, sourceKind: "book-chapter", type: "Book chapter", doi: `10.1234/${id}` } });
  };
  const chapter = { title: "Collective governance in research libraries", authors: ["Alex Smith"], containerTitle: "Library organization", pages: "20-40", abstractExcerpt: "A chapter about collective governance in research libraries, describing the same collaboration and decision process. The supplied abstract opening continues with matching text across the versions to establish a conservative connection." };
  saveChapter("chapter-first", { ...chapter, edition: "First edition" });
  saveChapter("chapter-second", { ...chapter, edition: "Second edition", pages: "50-70" });
  assert.equal(assignmentProgress(workspace).selected, 1);
  saveChapter("different-book", { ...chapter, containerTitle: "Another book", pages: "1-20", abstractExcerpt: "An unrelated chapter about a different subject." });
  assert.equal(assignmentProgress(workspace).selected, 2);
  saveChapter("different-author", { ...chapter, authors: ["Morgan Jones"] });
  assert.equal(assignmentProgress(workspace).selected, 3);
  assert.equal(workspace.trail.length, 4);
});
