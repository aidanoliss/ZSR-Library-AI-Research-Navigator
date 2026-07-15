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

export function normalizeResearchWorkspace(value) {
  const empty = createResearchWorkspace();
  const assignment = value?.assignment && typeof value.assignment === "object"
    ? { ...empty.assignment, ...value.assignment, enabled: value.assignment.enabled !== false }
    : empty.assignment;
  const trail = Array.isArray(value?.trail)
    ? value.trail.filter((item) => item?.id && item?.title).slice(0, 100)
    : [];
  const searchHistory = Array.isArray(value?.searchHistory)
    ? value.searchHistory.filter((item) => item?.id && item?.query).slice(0, 100)
    : [];
  return { assignment, trail, searchHistory };
}

export function researchItemKey(item) {
  const kind = String(item?.kind || "lead").toLowerCase();
  const value = String(item?.url || item?.title || item?.query || "")
    .trim()
    .replace(/\/$/, "")
    .toLowerCase();
  return value ? `${kind}:${value}` : "";
}

export function addResearchItem(workspace, item, now = Date.now()) {
  const current = normalizeResearchWorkspace(workspace);
  const key = researchItemKey(item);
  if (!key || current.trail.some((entry) => researchItemKey(entry) === key)) return current;
  const next = {
    id: item.id || `trail-${now}-${current.trail.length}`,
    kind: item.kind || "lead",
    title: String(item.title || item.query || "Saved research lead").trim(),
    url: String(item.url || "").trim(),
    detail: String(item.detail || "").trim(),
    status: RESEARCH_ITEM_STATUSES.some((status) => status.id === item.status) ? item.status : "promising",
    notes: String(item.notes || ""),
    citation: String(item.citation || ""),
    savedAt: item.savedAt || now,
  };
  return { ...current, trail: [next, ...current.trail].slice(0, 100) };
}

export function addSearchHistoryEntry(workspace, entry, now = Date.now()) {
  const current = normalizeResearchWorkspace(workspace);
  const query = String(entry?.query || "").trim();
  if (!query) return current;
  const tool = String(entry?.tool || "Search").trim();
  const url = String(entry?.url || "").trim();
  const key = `${query.toLowerCase()}|${tool.toLowerCase()}|${url.toLowerCase()}`;
  const existing = current.searchHistory.find((item) => item.key === key);
  const next = {
    id: existing?.id || `search-${now}-${current.searchHistory.length}`,
    key,
    query,
    tool,
    url,
    resultNote: String(existing?.resultNote || entry?.resultNote || ""),
    usedAt: now,
  };
  return {
    ...current,
    searchHistory: [next, ...current.searchHistory.filter((item) => item.id !== next.id)].slice(0, 100),
  };
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
  const brief = assignmentContext(current.assignment);
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
