export const RESEARCH_ITEM_STATUSES = [
  { id: "promising", label: "Promising" },
  { id: "opened", label: "Opened" },
  { id: "use", label: "Use" },
  { id: "not-relevant", label: "Not relevant" },
];

export const COURSE_TEMPLATES = [
  {
    id: "first-year",
    label: "First-year seminar",
    assignmentType: "Research paper",
    sourceCount: "5",
    sourceTypes: "Peer-reviewed articles plus background sources",
    dateRange: "Use the most relevant dates; prioritize recent scholarship when appropriate",
    constraints: "Use multiple perspectives and explain why each source is credible.",
  },
  {
    id: "humanities",
    label: "Humanities research",
    assignmentType: "Argument-driven research paper",
    sourceCount: "6",
    sourceTypes: "Scholarly books and articles; primary sources when appropriate",
    dateRange: "No fixed date limit unless the assignment specifies one",
    constraints: "Track editions, translations, historical context, and citation trails.",
  },
  {
    id: "social-science",
    label: "Social science study",
    assignmentType: "Literature review or research paper",
    sourceCount: "8",
    sourceTypes: "Peer-reviewed empirical studies and review articles",
    dateRange: "Prioritize the last 10 years while retaining foundational studies",
    constraints: "Record population, sample, methods, measures, and limitations.",
  },
  {
    id: "stem-health",
    label: "STEM / health review",
    assignmentType: "Evidence review",
    sourceCount: "8",
    sourceTypes: "Peer-reviewed studies, systematic reviews, and authoritative data",
    dateRange: "Prioritize the last 5 years plus foundational evidence",
    constraints: "Track DOI or PMID, study design, population, outcomes, and conflicts of interest.",
  },
];

export function createResearchWorkspace() {
  return {
    assignment: {
      enabled: true,
      course: "",
      assignmentType: "",
      dueDate: "",
      sourceCount: "",
      sourceTypes: "",
      dateRange: "",
      constraints: "",
    },
    trail: [],
    searchHistory: [],
  };
}

export const WORKSPACE_FORMAT = "zsr-research-workspace";
export const WORKSPACE_VERSION = 1;
export const WORKSPACE_MAX_BYTES = 2 * 1024 * 1024;
export const WORKSPACE_MAX_ITEMS = 100;
const ITEM_KINDS = new Set(["lead", "catalog", "source", "database", "search", "guide", "service", "collection", "library_portal"]);
const ASSIGNMENT_FIELDS = ["course", "assignmentType", "dueDate", "sourceCount", "sourceTypes", "dateRange", "constraints"];
const RECORD_TEXT_FIELDS = ["id", "title", "author", "type", "date", "publicationDate", "sourceProvider", "sourceKind", "sourceMode", "accessScope", "doi", "pmid", "isbn", "issn", "containerTitle", "publisher", "edition", "volume", "issue", "pages", "abstractExcerpt", "abstractSource", "description", "retrievedAt"];
const NESTED_FIELDS = {
  matchExplanation: ["status", "matchedConcepts", "missingConcepts", "explanation"],
  sourceAssessment: ["status", "checks", "issues"],
  quality: ["peerReviewed"],
  provenance: ["provider", "recordType", "metadataLicense", "metadataOnly", "accessVerified", "accessReportedByProvider", "accessScope", "demoData", "oaStatus", "license", "licenseId", "version", "host", "hostOrganization", "landingPageUrl", "pdfUrl", "peerReviewed", "peerReviewSource", "peerReviewEvidence", "retrievedAt", "metadataSource", "sourceKinds", "queryDialect", "reviewStatus", "maintenanceOwner", "configReviewedOn", "librarianReviewedOn", "configVersion"],
  openAccess: ["status", "isOpenAccess", "license", "licenseId", "licenseKind", "version", "host", "hostOrganization", "sourceType", "landingPageUrl", "pdfUrl"],
  fulfillment: ["location", "callNumber", "availabilityStatus", "availabilityLabel", "availabilityChecked", "actionLabel", "recordUrl", "url"],
  citation: ["title", "authors", "publicationDate", "year", "venue", "volume", "issue", "firstPage", "lastPage", "doi", "openAlexId", "type"],
};

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
}

function textValue(value, limit = 4000) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, limit)
    : "";
}

function safeUrl(value) {
  const raw = textValue(value, 2048).trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? raw : "";
  } catch { return ""; }
}

function boundedMetadata(value, depth = 0) {
  if (depth > 3) return undefined;
  if (typeof value === "string") return textValue(value, 4000);
  if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return value;
  if (value === null) return null;
  if (Array.isArray(value)) return value.slice(0, 40).map((entry) => boundedMetadata(entry, depth + 1)).filter((entry) => entry !== undefined);
  if (!plainObject(value)) return undefined;
  // Author name objects and peer-review evidence use only these scalar fields.
  const allowed = ["id", "label", "name", "displayName", "family", "given", "familyName", "givenName", "status", "source", "value", "detail", "evidence", "field", "provider", "verified", "url"];
  return Object.fromEntries(allowed.filter((key) => value[key] !== undefined).map((key) => [key, key === "url" ? safeUrl(value[key]) : boundedMetadata(value[key], depth + 1)]));
}

export function normalizeSourceRecord(value) {
  if (!plainObject(value)) return {};
  const record = {};
  for (const key of RECORD_TEXT_FIELDS) if (value[key] !== undefined) record[key] = textValue(value[key]);
  for (const key of ["url", "cover"]) if (value[key] !== undefined) record[key] = safeUrl(value[key]);
  for (const key of ["year", "publicationYear"]) {
    if (value[key] !== undefined && Number.isInteger(Number(value[key])) && Number(value[key]) >= 1000 && Number(value[key]) <= 9999) record[key] = Number(value[key]);
  }
  for (const key of ["authors", "subjects", "detailPoints"]) {
    if (Array.isArray(value[key])) record[key] = boundedMetadata(value[key]);
  }
  for (const key of ["peerReviewed", "peerReview", "peerReviewEvidence"]) {
    if (value[key] !== undefined) record[key] = boundedMetadata(value[key]);
  }
  for (const [field, allowed] of Object.entries(NESTED_FIELDS)) {
    if (!plainObject(value[field])) continue;
    record[field] = Object.fromEntries(allowed.filter((key) => value[field][key] !== undefined).map((key) => [key, /url$/i.test(key) ? safeUrl(value[field][key]) : boundedMetadata(value[field][key])]));
  }
  return record;
}

function normalizeTrailItem(item, index = 0) {
  if (!plainObject(item) || !textValue(item.title || item.query).trim()) return null;
  const sourceRecord = normalizeSourceRecord(item.sourceRecord || item);
  const kind = ITEM_KINDS.has(item.kind) ? item.kind : "lead";
  return {
    id: textValue(item.id || `trail-restored-${index}`, 160),
    kind,
    title: textValue(item.title || item.query, 1000).trim(),
    url: safeUrl(item.url || sourceRecord.url),
    detail: textValue(item.detail),
    status: RESEARCH_ITEM_STATUSES.some((status) => status.id === item.status) ? item.status : "promising",
    notes: textValue(item.notes),
    citation: typeof item.citation === "string" ? textValue(item.citation) : "",
    savedAt: Number.isFinite(Number(item.savedAt)) && Number(item.savedAt) > 0 ? Number(item.savedAt) : 0,
    sourceRecord,
    imported: item.imported === true,
  };
}

function normalizeAssignment(value) {
  const assignment = { ...createResearchWorkspace().assignment, enabled: value?.enabled !== false };
  for (const key of ASSIGNMENT_FIELDS) assignment[key] = textValue(value?.[key], key === "constraints" ? 4000 : 1000);
  return assignment;
}

function normalizeHistoryItem(entry, index) {
  if (!plainObject(entry) || !textValue(entry.query).trim()) return null;
  const query = textValue(entry.query).trim();
  const tool = textValue(entry.tool || "Search", 200).trim();
  const url = safeUrl(entry.url);
  return {
    id: textValue(entry.id || `search-restored-${index}`, 160),
    key: `${query.toLowerCase()}|${tool.toLowerCase()}|${url.toLowerCase()}`,
    query, tool, url,
    resultNote: textValue(entry.resultNote),
    usedAt: Number.isFinite(Number(entry.usedAt)) ? Number(entry.usedAt) : 0,
  };
}

function uniqueBy(items, keyFor) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeResearchWorkspace(value) {
  const trail = Array.isArray(value?.trail) ? value.trail.slice(0, WORKSPACE_MAX_ITEMS).map(normalizeTrailItem).filter(Boolean) : [];
  const searchHistory = Array.isArray(value?.searchHistory) ? value.searchHistory.slice(0, WORKSPACE_MAX_ITEMS).map(normalizeHistoryItem).filter(Boolean) : [];
  return {
    assignment: normalizeAssignment(value?.assignment),
    trail: uniqueBy(uniqueBy(trail, researchItemKey), (item) => item.id),
    searchHistory: uniqueBy(uniqueBy(searchHistory, (item) => item.key), (item) => item.id),
  };
}

export function researchItemKey(item) {
  const kind = textValue(item?.kind || "lead").toLowerCase();
  const value = textValue(item?.url || item?.title || item?.query).trim().replace(/\/$/, "").toLowerCase();
  return value ? `${kind}:${value}` : "";
}

export function addResearchItem(workspace, item, now = Date.now()) {
  const current = normalizeResearchWorkspace(workspace);
  const key = researchItemKey(item);
  if (!key || current.trail.some((entry) => researchItemKey(entry) === key)) return current;
  const next = normalizeTrailItem({ ...item, id: item.id || `trail-${now}-${current.trail.length}`, savedAt: item.savedAt || now });
  if (!next) return current;
  if (current.trail.length >= WORKSPACE_MAX_ITEMS) throw Object.assign(new Error("Your workspace already has 100 saved items. Remove an unused item or start a new chat before saving another."), { code: "WORKSPACE_FULL" });
  return { ...current, trail: [next, ...current.trail] };
}

/** Save a student's reading notes without duplicating the work or replacing its other fields. */
export function saveSourceNotes(workspace, item, notes, now = Date.now()) {
  const current = normalizeResearchWorkspace(workspace);
  const existing = current.trail.find((entry) => researchItemKey(entry) === researchItemKey(item));
  const boundedNotes = textValue(notes);
  if (existing) return { ...current, trail: current.trail.map((entry) => entry.id === existing.id ? { ...entry, notes: boundedNotes } : entry) };
  return addResearchItem(current, { ...item, notes: boundedNotes }, now);
}

export function addSearchHistoryEntry(workspace, entry, now = Date.now()) {
  const current = normalizeResearchWorkspace(workspace);
  const next = normalizeHistoryItem({ ...entry, usedAt: now }, current.searchHistory.length);
  if (!next) return current;
  const existing = current.searchHistory.find((item) => item.key === next.key);
  if (!existing && current.searchHistory.length >= WORKSPACE_MAX_ITEMS) throw Object.assign(new Error("Your workspace already has 100 searches. Remove an unused search or start a new chat before recording another."), { code: "WORKSPACE_FULL" });
  next.id = existing?.id || `search-${now}-${current.searchHistory.length}`;
  next.resultNote = existing?.resultNote || next.resultNote;
  return { ...current, searchHistory: [next, ...current.searchHistory.filter((item) => item.id !== next.id)] };
}

export function isSavedSource(item) {
  return ["catalog", "lead", "source"].includes(item?.kind);
}

export function sourceForResearchItem(item) {
  return { ...normalizeSourceRecord(item?.sourceRecord || item), title: textValue(item?.title), url: safeUrl(item?.url) };
}

export function savedSourceIdentity(item) {
  const source = sourceForResearchItem(item);
  const doi = textValue(source.doi || source.citation?.doi).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").toLowerCase().trim();
  return doi ? `doi:${doi}` : `record:${safeUrl(item.url).replace(/\/$/, "").toLowerCase() || item.title.toLowerCase()}`;
}

function validatePortableValue(value, depth = 0, field = "workspace") {
  if (depth > 10) throw new Error("The workspace file contains too many nested fields.");
  if (typeof value === "string") {
    if (value.length > 8000) throw new Error("A field in the workspace file is too long.");
    if (/url$|^cover$/i.test(field) && value && !safeUrl(value)) throw new Error("The workspace contains an unsafe or invalid link. Only HTTP or HTTPS links are allowed.");
    return;
  }
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return;
  if (Array.isArray(value)) {
    if (value.length > WORKSPACE_MAX_ITEMS) throw new Error("A workspace file can contain at most 100 saved items or searches.");
    value.forEach((entry) => validatePortableValue(entry, depth + 1, field));
    return;
  }
  if (!plainObject(value)) throw new Error("The workspace file contains an invalid field.");
  if (Object.keys(value).length > 80) throw new Error("The workspace file contains too many fields.");
  for (const [key, entry] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("The workspace file contains a disallowed field.");
    validatePortableValue(entry, depth + 1, key);
  }
}

export function workspaceToJson(workspace, topic = "Research topic", now = Date.now()) {
  const payload = { format: WORKSPACE_FORMAT, version: WORKSPACE_VERSION, exportedAt: new Date(now).toISOString(), topic: textValue(topic, 1000), workspace: normalizeResearchWorkspace(workspace) };
  const json = JSON.stringify(payload, null, 2);
  if (new TextEncoder().encode(json).length > WORKSPACE_MAX_BYTES) throw new Error("This workspace exceeds the 2 MB export limit. Shorten notes or remove unused records, then retry.");
  return json;
}

export function parseWorkspaceImport(json) {
  if (typeof json !== "string" || new TextEncoder().encode(json).length > WORKSPACE_MAX_BYTES) throw new Error("Choose a workspace JSON file smaller than 2 MB.");
  let payload;
  try { payload = JSON.parse(json); } catch { throw new Error("This file is not valid JSON. Choose a Navigator workspace export."); }
  if (!plainObject(payload) || payload.format !== WORKSPACE_FORMAT || payload.version !== WORKSPACE_VERSION) throw new Error("This is not a supported Navigator workspace export (version 1).");
  validatePortableValue(payload);
  const value = payload.workspace;
  if (!plainObject(value) || !plainObject(value.assignment) || !Array.isArray(value.trail) || !Array.isArray(value.searchHistory)) throw new Error("The workspace file is missing its assignment, saved items, or searches.");
  if (value.assignment.enabled !== undefined && typeof value.assignment.enabled !== "boolean") throw new Error("The assignment preference must be true or false.");
  for (const field of ASSIGNMENT_FIELDS) if (value.assignment[field] !== undefined && typeof value.assignment[field] !== "string") throw new Error(`The assignment field ${field} must be text.`);
  for (const item of value.trail) {
    if (!plainObject(item) || typeof item.title !== "string" || !item.title.trim() || typeof item.id !== "string" || !item.id || !ITEM_KINDS.has(item.kind)) throw new Error("Every saved item must include an ID, title, and supported kind.");
    if (item.status !== undefined && !RESEARCH_ITEM_STATUSES.some((status) => status.id === item.status)) throw new Error("A saved item has an unsupported status.");
    if (item.title.length > 1000 || item.id.length > 160) throw new Error("A saved item's title or ID is too long.");
    if (item.sourceRecord !== undefined && !plainObject(item.sourceRecord)) throw new Error("A saved source contains invalid metadata.");
    for (const field of ["url", "detail", "notes", "citation"]) if (item[field] !== undefined && typeof item[field] !== "string") throw new Error(`A saved item's ${field} must be text.`);
  }
  for (const item of value.searchHistory) if (!plainObject(item) || typeof item.query !== "string" || !item.query.trim() || typeof item.id !== "string" || !item.id) throw new Error("Every saved search must include an ID and search text.");
  const workspace = normalizeResearchWorkspace(value);
  workspace.assignment.enabled = false; // An imported file cannot opt the student into sending its assignment to AI.
  workspace.trail = workspace.trail.map((item) => ({ ...item, imported: true }));
  return { workspace, topic: textValue(payload.topic, 1000) };
}

export function mergeWorkspaceImport(workspace, imported, now = Date.now()) {
  const current = normalizeResearchWorkspace(workspace);
  const incoming = normalizeResearchWorkspace(imported);
  const existingItems = new Set(current.trail.map(researchItemKey));
  const existingSearches = new Set(current.searchHistory.map((item) => item.key));
  const addedItems = incoming.trail.filter((item) => !existingItems.has(researchItemKey(item)));
  const addedSearches = incoming.searchHistory.filter((item) => !existingSearches.has(item.key));
  if (current.trail.length + addedItems.length > WORKSPACE_MAX_ITEMS || current.searchHistory.length + addedSearches.length > WORKSPACE_MAX_ITEMS) throw new Error("Import would exceed 100 saved items or searches. Remove unused items or import into a new chat.");
  const hasBrief = ASSIGNMENT_FIELDS.some((key) => current.assignment[key].trim());
  const assignment = hasBrief ? current.assignment : { ...incoming.assignment, enabled: false };
  const merged = {
    assignment,
    trail: [...current.trail, ...addedItems.map((item, index) => ({ ...item, id: `import-${now}-${index}`, imported: true }))],
    searchHistory: [...current.searchHistory, ...addedSearches.map((entry, index) => ({ ...entry, id: `import-search-${now}-${index}` }))],
  };
  return { workspace: merged, addedItems: addedItems.length, addedSearches: addedSearches.length, skippedDuplicates: incoming.trail.length + incoming.searchHistory.length - addedItems.length - addedSearches.length, keptExistingBrief: hasBrief };
}

export function assignmentContext(assignment) {
  if (!assignment?.enabled) return "";
  const lines = [
    assignment.course ? `Course: ${assignment.course}` : "",
    assignment.assignmentType ? `Assignment: ${assignment.assignmentType}` : "",
    assignment.dueDate ? `Due date: ${assignment.dueDate}` : "",
    assignment.sourceCount ? `Source target: ${assignment.sourceCount}` : "",
    assignment.sourceTypes ? `Required source types: ${assignment.sourceTypes}` : "",
    assignment.dateRange ? `Date expectations: ${assignment.dateRange}` : "",
    assignment.constraints ? `Other constraints: ${assignment.constraints}` : "",
  ].filter(Boolean);
  return lines.length ? lines.map((line) => `- ${line}`).join("\n") : "";
}

export function workspaceToMarkdown(workspace, topic = "Research topic") {
  const current = normalizeResearchWorkspace(workspace);
  const lines = ["# ZSR Research Trail", "", `## Topic`, "", topic || "Research topic", ""];
  const brief = assignmentContext({ ...current.assignment, enabled: true });
  if (brief) lines.push("## Assignment brief", "", brief, "");

  lines.push("## Saved research", "");
  if (!current.trail.length) {
    lines.push("No research leads saved yet.", "");
  } else {
    for (const item of current.trail) {
      const title = item.url ? `[${item.title}](${item.url})` : item.title;
      lines.push(`- ${title} — ${item.status}`);
      if (item.detail) lines.push(`  - ${item.detail}`);
      if (item.notes) lines.push(`  - Notes: ${item.notes}`);
      if (item.citation) lines.push(`  - Citation details: ${item.citation}`);
      const source = sourceForResearchItem(item);
      const provider = source.sourceProvider || source.provenance?.provider;
      if (provider) lines.push(`  - Metadata provider: ${provider}${item.imported ? " (imported; recheck in the provider record)" : ""}`);
      if (source.doi) lines.push(`  - DOI: ${source.doi}`);
      if (source.date || source.year || source.publicationYear) lines.push(`  - Publication date: ${source.date || source.year || source.publicationYear}`);
      if (source.openAccess?.license) lines.push(`  - Provider-reported source license: ${source.openAccess.license}`);
      if (isSavedSource(item)) lines.push(`  - Peer review: ${!item.imported && source.peerReviewed === true ? "explicitly reported by provider" : !item.imported && source.peerReviewed === false ? "provider reports not peer reviewed" : "not verified"}`);
    }
    lines.push("");
  }

  lines.push("## Searches tried", "");
  if (!current.searchHistory.length) {
    lines.push("No searches recorded yet.", "");
  } else {
    for (const entry of current.searchHistory) {
      lines.push(`- \`${entry.query}\` in ${entry.tool}`);
      if (entry.resultNote) lines.push(`  - Result note: ${entry.resultNote}`);
    }
    lines.push("");
  }

  lines.push(
    "---",
    "",
    "_Saved locally by the ZSR Research Navigator prototype. Open each source to confirm relevance, access, and citation details._"
  );
  return lines.join("\n");
}

export function workspaceTabAfterKey(current, key, ids = ["brief", "trail", "history", "review"]) {
  const index = ids.indexOf(current);
  if (index < 0 || !ids.length) return null;
  if (key === "ArrowRight") return ids[(index + 1) % ids.length];
  if (key === "ArrowLeft") return ids[(index - 1 + ids.length) % ids.length];
  if (key === "Home") return ids[0];
  if (key === "End") return ids[ids.length - 1];
  return null;
}
