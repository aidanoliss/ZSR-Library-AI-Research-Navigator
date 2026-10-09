import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { buildResearchPlan } from "../config/researchAgent.js";
import { liveSearchQueries } from "../server/liveSearchQueries.js";
import { discoverSourcesForScope } from "../server/sourceDiscovery.js";
import { SEARCH_QUALITY_FORMAT, captureSearchQualityCase } from "../lib/searchQualityEvaluation.js";

const args = process.argv.slice(2);
const option = (name, fallback = "") => {
  const position = args.indexOf(name);
  if (position < 0) return fallback;
  if (!args[position + 1] || args[position + 1].startsWith("--")) throw new Error(`${name} needs a value.`);
  return args[position + 1];
};
if (args.includes("--help")) {
  process.stdout.write("Capture search review evidence; no AI calls.\n\nDefault: planning only, no network. --live contacts configured bibliographic providers.\nOptions: --set FILE --case ID --limit COUNT --candidates COUNT --timeout MS --label NAME --write FILE --live\nExample: node scripts/capture-search-quality.mjs --live --case sanctions-comparison --write /tmp/sanctions-review.json\n");
} else {
  const live = args.includes("--live");
  const set = option("--set");
  const dataset = JSON.parse(await readFile(set || new URL("../evals/search-quality-review-set.json", import.meta.url), "utf8"));
  if (!Array.isArray(dataset)) throw new Error("The review set must be an array.");
  const selectedId = option("--case");
  const count = Number(option("--limit", String(dataset.length)));
  const candidateLimit = Number(option("--candidates", "20"));
  const timeoutMs = Number(option("--timeout", "45000"));
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(candidateLimit) || candidateLimit < 5 || candidateLimit > 30 || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
    throw new Error("Use a positive --limit, 5–30 --candidates, and 1000–120000 --timeout milliseconds.");
  }
  const selected = dataset.filter((entry) => !selectedId || entry.id === selectedId).slice(0, count);
  if (!selected.length) throw new Error("No matching review cases.");
  const capture = { format: SEARCH_QUALITY_FORMAT, version: 1, label: option("--label", live ? "Live provider capture" : "Planning only; retrieval not run"), capturedAt: new Date().toISOString(), live,
    instructions: "Grade each candidate judgment as useful, not-useful, or uncertain after inspecting the source. Leave null until reviewed. Candidate ranks 1–5 are the displayed top five; additional candidates support ranking review. Metadata and rank are not human judgments.",
    cases: [] };
  for (const sample of selected) {
    const entry = await captureSearchQualityCase(sample, { live, candidateLimit, timeoutMs, buildPlan: buildResearchPlan, compileQueries: liveSearchQueries, discover: discoverSourcesForScope });
    if (live) {
      process.stderr.write(`${sample.id}: ${entry.status}, ${entry.candidates.length} candidates\n`);
    }
    capture.cases.push(entry);
  }
  const output = `${JSON.stringify(capture, null, 2)}\n`;
  const target = option("--write");
  if (target) { await writeFile(target, output, "utf8"); process.stdout.write(`Wrote ${capture.cases.length} ${live ? "provider capture" : "planning"} cases to ${target}. Human judgments remain blank.\n`); }
  else process.stdout.write(output);
}
