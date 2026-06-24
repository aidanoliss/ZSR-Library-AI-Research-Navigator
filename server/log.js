import { appendFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const QUERIES_LOG = join(DATA_DIR, "queries.jsonl");
const FEEDBACK_LOG = join(DATA_DIR, "feedback.jsonl");

// Local-only, privacy-conscious logging so librarians can see what students
// need and where the curated collection has gaps. Disable with LOG_QUERIES=off.
const QUERIES_ENABLED = (process.env.LOG_QUERIES || "on").toLowerCase() !== "off";

async function append(file, record) {
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(file, JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n");
}

/** Log the topic of a turn plus which curated resources matched (for gap analysis). */
export async function logQuery({ topic, matchedIds }) {
  if (!QUERIES_ENABLED) return;
  try {
    await append(QUERIES_LOG, { type: "query", topic, matchedIds });
  } catch (err) {
    console.warn("[log] could not write query:", err.message);
  }
}

/** Log a student's thumbs up/down or "gap" report on a reply. */
export async function logFeedback({ rating, note, topic }) {
  await append(FEEDBACK_LOG, { type: "feedback", rating, note: note || "", topic: topic || "" });
}

/** Read recent feedback (most recent first) for a simple librarian view. */
export async function readFeedback(limit = 100) {
  try {
    const raw = await readFile(FEEDBACK_LOG, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .reverse()
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}
