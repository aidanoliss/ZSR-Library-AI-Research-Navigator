import test from "node:test";
import assert from "node:assert/strict";

import {
  addResearchItem,
  addSearchHistoryEntry,
  assignmentContext,
  createResearchWorkspace,
  normalizeResearchWorkspace,
  workspaceToMarkdown,
} from "../src/researchWorkspace.js";

test("research workspace defaults to local assignment, trail, and history state", () => {
  const workspace = normalizeResearchWorkspace(null);
  assert.equal(workspace.assignment.enabled, true);
  assert.deepEqual(workspace.trail, []);
  assert.deepEqual(workspace.searchHistory, []);
});

test("saved research leads are deduplicated by kind and URL", () => {
  const first = addResearchItem(createResearchWorkspace(), {
    kind: "catalog",
    title: "Useful article",
    url: "https://example.com/item/",
  }, 100);
  const duplicate = addResearchItem(first, {
    kind: "catalog",
    title: "Duplicate label",
    url: "https://example.com/item",
  }, 200);
  assert.equal(duplicate.trail.length, 1);
  assert.equal(duplicate.trail[0].status, "promising");
});

test("search history records repeated searches as one updated entry", () => {
  const first = addSearchHistoryEntry(createResearchWorkspace(), {
    query: "cognitive offloading AND students",
    tool: "Google Scholar",
  }, 100);
  const repeated = addSearchHistoryEntry(first, {
    query: "cognitive offloading AND students",
    tool: "Google Scholar",
  }, 200);
  assert.equal(repeated.searchHistory.length, 1);
  assert.equal(repeated.searchHistory[0].usedAt, 200);
});

test("assignment context includes only enabled, populated constraints", () => {
  const workspace = createResearchWorkspace();
  workspace.assignment.course = "FYS 100";
  workspace.assignment.sourceCount = "6";
  const context = assignmentContext(workspace.assignment);
  assert.match(context, /Course: FYS 100/);
  assert.match(context, /Source target: 6/);
  workspace.assignment.enabled = false;
  assert.equal(assignmentContext(workspace.assignment), "");
});

test("workspace export includes brief, saved items, and searches", () => {
  let workspace = createResearchWorkspace();
  workspace.assignment.assignmentType = "Literature review";
  workspace = addResearchItem(workspace, { kind: "database", title: "PsycINFO", url: "https://example.com/psycinfo" }, 100);
  workspace = addSearchHistoryEntry(workspace, { query: "social media AND adolescents", tool: "ZSR Articles" }, 200);
  const markdown = workspaceToMarkdown(workspace, "Social media and adolescent mental health");
  assert.match(markdown, /Assignment brief/);
  assert.match(markdown, /PsycINFO/);
  assert.match(markdown, /social media AND adolescents/);
});

// Portable work must preserve evidence without converting imported assertions into verification.
import {
  WORKSPACE_MAX_BYTES,
  mergeWorkspaceImport,
  parseWorkspaceImport,
  sourceForResearchItem,
  workspaceTabAfterKey,
  workspaceToJson,
} from "../src/researchWorkspace.js";
import { assignmentProgress, savedSourceDetails } from "../src/workspaceRequirements.js";

const providerLead = {
  title: "Adolescent sleep and social media",
  url: "https://example.org/article",
  sourceProvider: "Example metadata provider",
  sourceKind: "scholarly-article",
  date: "2024-04-12",
  peerReviewed: true,
  doi: "10.1000/sleep",
  authors: [{ given: "Ada", family: "Example" }],
  retrievedAt: "2026-09-15T10:00:00.000Z",
  subjects: ["Sleep", "Adolescents"],
  provenance: { provider: "Example metadata provider", metadataOnly: true, accessVerified: false },
  openAccess: { license: "CC-BY", version: "publishedVersion", landingPageUrl: "https://example.org/article" },
  citation: { title: "Adolescent sleep and social media", authors: ["Ada Example"], year: 2024, doi: "10.1000/sleep" },
  matchExplanation: { status: "meets", matchedConcepts: ["sleep"], missingConcepts: [], explanation: "The supplied title contains sleep." },
  sourceAssessment: { status: "unverified", checks: [{ id: "peer-review", label: "Peer review", status: "unverified", detail: "Check the journal." }], issues: ["Check the journal."] },
};

function savedLead(overrides = {}, now = 100) {
  return addResearchItem(createResearchWorkspace(), { kind: "catalog", title: providerLead.title, url: providerLead.url, status: "use", sourceRecord: { ...providerLead, ...overrides } }, now).trail[0];
}

function withBrief(trail) {
  const workspace = createResearchWorkspace();
  workspace.assignment = { ...workspace.assignment, sourceCount: "3", sourceTypes: "Peer-reviewed articles", dateRange: "2022-2026" };
  workspace.trail = trail;
  return workspace;
}

test("saving retains provider citation, access, retrieval, fit and quality metadata separately from notes", () => {
  const item = savedLead();
  assert.equal(item.citation, "");
  assert.equal(item.sourceRecord.citation.year, 2024);
  assert.equal(item.sourceRecord.provenance.accessVerified, false);
  assert.equal(item.sourceRecord.openAccess.license, "CC-BY");
  assert.equal(item.sourceRecord.peerReviewed, true);
  assert.equal(item.sourceRecord.retrievedAt, providerLead.retrievedAt);
  assert.deepEqual(item.sourceRecord.matchExplanation.matchedConcepts, ["sleep"]);
  assert.equal(item.sourceRecord.sourceAssessment.checks[0].id, "peer-review");
  assert.deepEqual(normalizeResearchWorkspace({ trail: [item] }).trail[0].sourceRecord, item.sourceRecord);
  assert.equal(sourceForResearchItem(item).doi, providerLead.doi);
});

test("workspace JSON round-trip retains data and marks imported metadata unverified", () => {
  const original = withBrief([{ ...savedLead(), notes: "Check sample size.", citation: "My citation notes" }]);
  const restored = parseWorkspaceImport(workspaceToJson(original, "Sleep", 100));
  assert.equal(restored.topic, "Sleep");
  assert.equal(restored.workspace.trail[0].sourceRecord.doi, providerLead.doi);
  assert.equal(restored.workspace.trail[0].notes, "Check sample size.");
  assert.equal(restored.workspace.trail[0].citation, "My citation notes");
  assert.equal(restored.workspace.trail[0].imported, true);
  assert.equal(restored.workspace.assignment.enabled, false);
  const progress = assignmentProgress(restored.workspace);
  assert.equal(progress.supported, 0);
  assert.equal(progress.unknown, 1);
  assert.equal(savedSourceDetails(restored.workspace.trail[0]).peerReview, "Unverified imported metadata");
});

test("import rejects unsupported, malformed, oversized and executable-link payloads before merging", () => {
  const workspace = withBrief([savedLead()]);
  const payload = JSON.parse(workspaceToJson(workspace));
  assert.throws(() => parseWorkspaceImport("{oops"), /not valid JSON/);
  assert.throws(() => parseWorkspaceImport(JSON.stringify({ ...payload, version: 9 })), /supported/);
  assert.throws(() => parseWorkspaceImport(" ".repeat(WORKSPACE_MAX_BYTES + 1)), /2 MB/);
  assert.throws(() => parseWorkspaceImport(JSON.stringify({ ...payload, workspace: { ...payload.workspace, trail: Array(101).fill(payload.workspace.trail[0]) } })), /100/);
  for (const url of ["javascript:alert(1)", "data:text/html,hello", "https://name:password@example.org/", "file:///private/secret", "/relative"]) {
    const unsafe = structuredClone(payload);
    unsafe.workspace.trail[0].sourceRecord.openAccess.pdfUrl = url;
    assert.throws(() => parseWorkspaceImport(JSON.stringify(unsafe)), /unsafe or invalid link/);
  }
  const malformed = structuredClone(payload);
  malformed.workspace.trail[0].notes = { unsafe: true };
  assert.throws(() => parseWorkspaceImport(JSON.stringify(malformed)), /must be text/);
  assert.throws(() => parseWorkspaceImport(JSON.stringify(payload).replace('"assignment":{', '"assignment":{"__proto__":{},')), /disallowed field/);
  assert.equal(workspace.trail[0].sourceRecord.openAccess.pdfUrl, undefined);
});

test("import merges without replacing existing notes, brief or AI preference and rejects capacity loss", () => {
  const current = withBrief([{ ...savedLead(), notes: "Keep this note" }]);
  current.assignment.course = "Existing course";
  const incoming = parseWorkspaceImport(workspaceToJson(withBrief([
    { ...savedLead(), notes: "Do not overwrite" },
    { ...savedLead({ doi: "10.1000/second" }, 200), id: "second", title: "Second source", url: "https://example.org/second" },
  ]))).workspace;
  incoming.assignment.course = "Imported course";
  const result = mergeWorkspaceImport(current, incoming, 500);
  assert.equal(result.workspace.trail.length, 2);
  assert.equal(result.workspace.trail[0].notes, "Keep this note");
  assert.equal(result.workspace.assignment.course, "Existing course");
  assert.equal(result.workspace.assignment.enabled, true);
  assert.equal(result.addedItems, 1);
  assert.equal(result.skippedDuplicates, 1);
  const full = { ...current, trail: Array.from({ length: 100 }, (_, i) => ({ ...savedLead(), id: `i-${i}`, title: `Source ${i}`, url: `https://example.org/${i}` })) };
  assert.throws(() => mergeWorkspaceImport(full, incoming), /exceed 100/);
  assert.equal(full.trail.length, 100);
});

test("requirements distinguish supported, missing and incompatible metadata and exclude routes and duplicate works", () => {
  const supported = savedLead();
  const unknown = { ...savedLead({ doi: "10.1000/unknown", peerReviewed: null, date: "", citation: {} }, 200), id: "unknown", title: "Unknown date", url: "https://example.org/unknown" };
  const old = { ...savedLead({ doi: "10.1000/old", date: "2015", citation: {} }, 300), id: "old", title: "Old source", url: "https://example.org/old" };
  const duplicate = { ...supported, id: "same-work", url: "https://catalog.example.org/sleep" };
  const path = { id: "path", kind: "database", title: "A database", url: "https://example.org/database", status: "use" };
  const result = assignmentProgress(withBrief([supported, unknown, old, duplicate, path]));
  assert.equal(result.target, 3);
  assert.equal(result.selected, 3);
  assert.equal(result.supported, 1);
  assert.equal(result.unknown, 1);
  assert.equal(result.mismatches, 1);
  assert.equal(result.duplicates, 1);
  assert.deepEqual(result.checks.find((check) => check.id === "publication-date"), { id: "publication-date", label: "Publication date", meets: 1, unverified: 1, mismatch: 1 });
});

test("article type and citation notes never establish peer review; demo and unmatched source types do not count as supported", () => {
  const article = savedLead({ peerReviewed: null });
  article.citation = "Peer-reviewed article";
  assert.equal(assignmentProgress(withBrief([article])).supported, 0);
  const book = savedLead({ sourceKind: "book", type: "book" });
  assert.equal(assignmentProgress(withBrief([book])).mismatches, 1);
  const demo = savedLead({ provenance: { demoData: true } });
  assert.equal(assignmentProgress(withBrief([demo])).mismatches, 1);
  assert.match(savedSourceDetails(article).peerReview, /Not established/);
});

test("legacy saved items remain usable with explicit unknown metadata and safe links", () => {
  const workspace = normalizeResearchWorkspace({ trail: [{ id: "old", kind: "catalog", title: "Old saved item", detail: "Book — 2024", url: "javascript:alert(1)", status: "use" }] });
  assert.equal(workspace.trail[0].url, "");
  const detail = savedSourceDetails(workspace.trail[0]);
  assert.equal(detail.year, "Not supplied");
  assert.equal(detail.provider, "Not recorded");
  assert.equal(detail.peerReview, "Not established by metadata");
  assert.equal(assignmentProgress(workspace).unknown, 1);
});

test("comparison describes only provided metadata and explicit topic matches", () => {
  const item = savedLead();
  const detail = savedSourceDetails(item, { concepts: [{ preferredTerm: "sleep", synonyms: [] }, { preferredTerm: "calculus", synonyms: [] }] });
  assert.equal(detail.author, "Ada Example");
  assert.equal(detail.year, 2024);
  assert.match(detail.fit, /mentions: sleep/);
  assert.doesNotMatch(detail.fit, /calculus/);
  assert.equal(detail.license, "CC-BY");
});

test("workspace tab keyboard navigation wraps with arrows and supports Home and End", () => {
  assert.equal(workspaceTabAfterKey("brief", "ArrowLeft"), "review");
  assert.equal(workspaceTabAfterKey("review", "ArrowRight"), "brief");
  assert.equal(workspaceTabAfterKey("trail", "Home"), "brief");
  assert.equal(workspaceTabAfterKey("trail", "End"), "review");
  assert.equal(workspaceTabAfterKey("trail", "Tab"), null);
});

test("a full workspace rejects new saved items without evicting existing work", () => {
  const current = createResearchWorkspace();
  current.trail = Array.from({ length: 100 }, (_, index) => ({ id: `saved-${index}`, kind: "catalog", title: `Source ${index}`, url: `https://example.org/${index}`, notes: `Keep note ${index}` }));
  const before = structuredClone(current);
  assert.throws(() => addResearchItem(current, { kind: "catalog", title: "New item", url: "https://example.org/new" }), (error) => error.code === "WORKSPACE_FULL" && /100 saved items/.test(error.message));
  assert.deepEqual(current, before);
  const duplicate = addResearchItem(current, current.trail[99]);
  assert.equal(duplicate.trail.length, 100);
  assert.equal(duplicate.trail[99].notes, "Keep note 99");
});

test("a full search history permits repeats but rejects new queries without evicting notes", () => {
  let current = createResearchWorkspace();
  for (let index = 0; index < 100; index += 1) current = addSearchHistoryEntry(current, { query: `query ${index}`, tool: "Catalog", resultNote: `Keep result ${index}` }, index + 1);
  const before = structuredClone(current);
  assert.throws(() => addSearchHistoryEntry(current, { query: "New query", tool: "Catalog" }), (error) => error.code === "WORKSPACE_FULL" && /100 searches/.test(error.message));
  assert.deepEqual(current, before);
  const repeated = addSearchHistoryEntry(current, { query: "query 0", tool: "Catalog" }, 1000);
  assert.equal(repeated.searchHistory.length, 100);
  assert.equal(repeated.searchHistory[0].resultNote, "Keep result 0");
  assert.equal(repeated.searchHistory[0].usedAt, 1000);
});
