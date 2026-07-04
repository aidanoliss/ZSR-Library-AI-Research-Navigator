import { appendFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const QUERIES_LOG = join(DATA_DIR, "queries.jsonl");
const FEEDBACK_LOG = join(DATA_DIR, "feedback.jsonl");
const HANDOFF_LOG = join(DATA_DIR, "handoffs.jsonl");

// Local-only, privacy-conscious logging so librarians can see what students
// need and where the curated collection has gaps. Keep off by default for demos.
const QUERIES_ENABLED = (process.env.LOG_QUERIES || "off").toLowerCase() === "on";
const STORE_HANDOFF_CONTACT = (process.env.HANDOFF_STORE_CONTACT || "off").toLowerCase() === "on";

function redactText(value, max = 2000) {
  return String(value || "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, "[phone]")
    .replace(/\b\d{7,}\b/g, "[number]")
    .slice(0, max);
}

async function append(file, record) {
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(file, JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n");
}

async function readJsonl(file, limit = 100) {
  try {
    const raw = await readFile(file, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .reverse()
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

/** Log the topic of a turn plus which curated resources matched (for gap analysis). */
export async function logQuery({ topic, matchedIds, blocked = false }) {
  if (!QUERIES_ENABLED) return;
  try {
    await append(QUERIES_LOG, { type: "query", topic: redactText(topic), matchedIds, blocked: Boolean(blocked) });
  } catch (err) {
    console.warn("[log] could not write query:", err.message);
  }
}

/** Log a student's thumbs up/down or "gap" report on a reply. */
export async function logFeedback({ rating, note, topic }) {
  await append(FEEDBACK_LOG, {
    type: "feedback",
    rating,
    note: redactText(note, 1000),
    topic: redactText(topic, 2000),
  });
}

/** Log an explicit librarian handoff package. Contact details are not retained by default. */
export async function logHandoff({ topic, mode, responseStyle, note, contact, searchTerms, liveResults, matchedResources, librarianRoutes }) {
  const safeResults = (liveResults || []).slice(0, 8).map((item) => ({
    title: redactText(item.title, 240),
    type: item.type || "",
    date: item.date || "",
    url: item.url || "",
  }));
  const safeResources = (matchedResources || []).slice(0, 8).map((item) => ({
    id: item.id || "",
    name: item.name || item.resource_name || "",
    url: item.url || "",
  }));
  const safeRoutes = (librarianRoutes || []).slice(0, 3).map((item) => ({
    id: item.id || "",
    label: redactText(item.label, 160),
    unit: redactText(item.unit, 160),
    reason: redactText(item.reason, 260),
    href: item.href || "",
  }));

  await append(HANDOFF_LOG, {
    type: "handoff",
    topic: redactText(topic, 2000),
    mode: mode || "",
    responseStyle: responseStyle || "",
    note: redactText(note, 1000),
    contact: STORE_HANDOFF_CONTACT ? redactText(contact, 300) : "",
    contactProvided: Boolean(String(contact || "").trim()),
    searchTerms: (searchTerms || []).slice(0, 12).map((term) => redactText(term, 220)),
    liveResults: safeResults,
    matchedResources: safeResources,
    librarianRoutes: safeRoutes,
  });
}

/** Read recent feedback (most recent first) for a simple librarian view. */
export async function readFeedback(limit = 100) {
  return readJsonl(FEEDBACK_LOG, limit);
}

export async function readHandoffs(limit = 50) {
  return readJsonl(HANDOFF_LOG, limit);
}

export async function readQueries(limit = 200) {
  return readJsonl(QUERIES_LOG, limit);
}

export async function readQuerySummary(limit = 200) {
  const queries = await readQueries(limit);
  const topicCounts = new Map();
  const resourceCounts = new Map();
  let blockedCount = 0;

  for (const query of queries) {
    if (query.blocked) blockedCount += 1;
    const topic = String(query.topic || "").trim();
    if (topic) topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    for (const id of query.matchedIds || []) {
      resourceCounts.set(id, (resourceCounts.get(id) || 0) + 1);
    }
  }

  const rank = (map) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));

  return {
    enabled: QUERIES_ENABLED,
    total: queries.length,
    blockedCount,
    topTopics: rank(topicCounts),
    topResourceIds: rank(resourceCounts),
  };
}

export function loggingStatus() {
  return {
    queryLoggingEnabled: QUERIES_ENABLED,
    handoffContactStorageEnabled: STORE_HANDOFF_CONTACT,
    queryLoggingDefault: "off",
  };
}
