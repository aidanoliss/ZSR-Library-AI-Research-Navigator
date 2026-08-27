import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
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
const STORE_QUERY_TEXT = (process.env.LOG_QUERY_TEXT || "off").toLowerCase() === "on";
const STORE_FEEDBACK_TEXT = (process.env.FEEDBACK_STORE_TEXT || "off").toLowerCase() === "on";
const STORE_FEEDBACK_TOPIC = (process.env.FEEDBACK_STORE_TOPIC || "off").toLowerCase() === "on";
const STORE_HANDOFF_DETAIL = (process.env.HANDOFF_STORE_DETAIL || "off").toLowerCase() === "on";
const FEEDBACK_ENABLED = (process.env.LOG_FEEDBACK || "on").toLowerCase() !== "off";
const HANDOFFS_ENABLED = (process.env.LOG_HANDOFFS || "on").toLowerCase() !== "off";
const RETENTION_DAYS = Math.min(Math.max(Number.parseInt(process.env.LOG_RETENTION_DAYS || "30", 10) || 30, 1), 365);
const MAX_RECORDS = Math.min(Math.max(Number.parseInt(process.env.LOG_MAX_RECORDS || "1000", 10) || 1000, 50), 100_000);
const appendQueues = new Map();

function redactText(value, max = 2000) {
  return String(value || "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, "[phone]")
    .replace(/\b\d{7,}\b/g, "[number]")
    .slice(0, max);
}

async function appendRecord(file, record) {
  await mkdir(DATA_DIR, { recursive: true });
  await prune(file);
  await appendFile(file, JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n");
}

async function withFileQueue(file, operation) {
  const previous = appendQueues.get(file) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  appendQueues.set(file, current);
  try {
    return await current;
  } finally {
    if (appendQueues.get(file) === current) appendQueues.delete(file);
  }
}

async function append(file, record) {
  return withFileQueue(file, () => appendRecord(file, record));
}

function retainedRecords(raw) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return String(raw || "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const record = JSON.parse(line);
        const timestamp = Date.parse(record.ts || "");
        return Number.isFinite(timestamp) && timestamp >= cutoff ? [record] : [];
      } catch {
        return [];
      }
    })
    .slice(-MAX_RECORDS);
}

async function prune(file) {
  try {
    const raw = await readFile(file, "utf8");
    const records = retainedRecords(raw).slice(-(MAX_RECORDS - 1));
    const normalized = records.map((record) => JSON.stringify(record)).join("\n");
    const next = normalized ? `${normalized}\n` : "";
    if (next !== raw) await writeFile(file, next);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function readJsonl(file, limit = 100) {
  try {
    return await withFileQueue(file, async () => {
      if (process.env.NODE_ENV === "production") await prune(file);
      const raw = await readFile(file, "utf-8");
      return retainedRecords(raw)
        .slice(-Math.min(Math.max(Number(limit) || 100, 1), MAX_RECORDS))
        .reverse();
    });
  } catch {
    return [];
  }
}

if (process.env.NODE_ENV === "production") {
  const pruneAll = () => Promise.all(
    [QUERIES_LOG, FEEDBACK_LOG, HANDOFF_LOG].map((file) => withFileQueue(file, () => prune(file)))
  ).catch(() => {});
  pruneAll();
  setInterval(pruneAll, 6 * 60 * 60 * 1000).unref?.();
}

/** Log the topic of a turn plus which curated resources matched (for gap analysis). */
export async function logQuery({ topic, matchedIds, blocked = false }) {
  if (!QUERIES_ENABLED) return;
  try {
    await append(QUERIES_LOG, {
      type: "query",
      ...(STORE_QUERY_TEXT ? { topic: redactText(topic) } : { topicProvided: Boolean(String(topic || "").trim()) }),
      matchedIds: (matchedIds || []).slice(0, 12).map((id) => String(id || "").slice(0, 120)),
      blocked: Boolean(blocked),
    });
  } catch (err) {
    console.warn("[log] could not write aggregate query event");
  }
}

/** Log a student's thumbs up/down or "gap" report on a reply. */
export async function logFeedback({ rating, note, topic }) {
  if (!FEEDBACK_ENABLED) return;
  await append(FEEDBACK_LOG, {
    type: "feedback",
    rating,
    noteProvided: Boolean(String(note || "").trim()),
    topicProvided: Boolean(String(topic || "").trim()),
    ...(STORE_FEEDBACK_TEXT ? { note: redactText(note, 1000) } : {}),
    ...(STORE_FEEDBACK_TOPIC ? { topic: redactText(topic, 2000) } : {}),
  });
}

/** Log an explicit librarian handoff package. Contact details are not retained by default. */
export async function logHandoff({ topic, mode, responseStyle, note, contact, searchTerms, liveResults, matchedResources, librarianRoutes }) {
  if (!HANDOFFS_ENABLED) return;
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
    mode: mode || "",
    responseStyle: responseStyle || "",
    topicProvided: Boolean(String(topic || "").trim()),
    noteProvided: Boolean(String(note || "").trim()),
    contactProvided: Boolean(String(contact || "").trim()),
    resultCount: safeResults.length,
    matchedResourceIds: safeResources.map((item) => item.id).filter(Boolean),
    librarianRouteIds: safeRoutes.map((item) => item.id).filter(Boolean),
    ...(STORE_HANDOFF_DETAIL ? {
      topic: redactText(topic, 2000),
      note: redactText(note, 1000),
      contact: STORE_HANDOFF_CONTACT ? redactText(contact, 300) : "",
      searchTerms: (searchTerms || []).slice(0, 12).map((term) => redactText(term, 220)),
      liveResults: safeResults,
      matchedResources: safeResources,
      librarianRoutes: safeRoutes,
    } : {}),
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
    queryTextStorageEnabled: QUERIES_ENABLED && STORE_QUERY_TEXT,
    feedbackLoggingEnabled: FEEDBACK_ENABLED,
    feedbackTextStorageEnabled: FEEDBACK_ENABLED && STORE_FEEDBACK_TEXT,
    feedbackTopicStorageEnabled: FEEDBACK_ENABLED && STORE_FEEDBACK_TOPIC,
    handoffLoggingEnabled: HANDOFFS_ENABLED,
    handoffDetailStorageEnabled: HANDOFFS_ENABLED && STORE_HANDOFF_DETAIL,
    handoffContactStorageEnabled: HANDOFFS_ENABLED && STORE_HANDOFF_DETAIL && STORE_HANDOFF_CONTACT,
    queryLoggingDefault: "off",
    textStorageDefault: "off",
    retentionDays: RETENTION_DAYS,
    maxRecordsPerLog: MAX_RECORDS,
  };
}
