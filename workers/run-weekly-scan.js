import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runWeeklyScan } from "../lib/pipeline.js";
import { buildWeeklyScanSummary } from "../lib/weeklySummary.js";
import { getVentureStore } from "../server/ventureStore.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SUMMARY_MD_PATH = resolve(ROOT, "data/generated_weekly_summary.md");
const SUMMARY_JSON_PATH = resolve(ROOT, "data/generated_weekly_summary.json");

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function writeSummaryFiles(summary) {
  await mkdir(dirname(SUMMARY_MD_PATH), { recursive: true });
  await Promise.all([
    writeFile(SUMMARY_MD_PATH, summary.markdown, "utf8"),
    writeFile(SUMMARY_JSON_PATH, `${JSON.stringify(summary.json, null, 2)}\n`, "utf8"),
  ]);
}

const source = argValue("source", process.env.VENTURE_RADAR_WEEKLY_SOURCE || "hn");
const limit = Number(argValue("limit", process.env.VENTURE_RADAR_WEEKLY_LIMIT || "12"));
const shouldWrite = process.argv.includes("--write") || process.env.VENTURE_RADAR_WRITE_SUMMARY !== "false";
const store = getVentureStore();
let job;

try {
  const state = await store.readState();
  job = await store.createJob({ source });
  const result = await runWeeklyScan({
    source,
    limit: Number.isFinite(limit) ? limit : 12,
    companies: state.companies,
    investors: state.investors,
  });
  const nextState = await store.completeJob(job.id, result);
  const summary = buildWeeklyScanSummary(result, nextState);

  if (shouldWrite) {
    await writeSummaryFiles(summary);
  }

  console.log(summary.markdown);
  console.log(JSON.stringify({
    ok: true,
    summary_file: shouldWrite ? SUMMARY_MD_PATH : null,
    summary_json_file: shouldWrite ? SUMMARY_JSON_PATH : null,
    result: summary.json,
  }, null, 2));
} catch (err) {
  if (job) await store.failJob(job.id, err).catch(() => {});
  const failedAt = new Date().toISOString();
  const failureMarkdown = `# Weekly Venture Radar Scan Summary

Generated: ${failedAt}

## Run Status
- Job: failed${job?.id ? ` (${job.id})` : ""}
- Error: ${err.message}

## Next Action
- Check network access, HN API availability, and Supabase/local persistence configuration, then rerun \`npm run venture:weekly-scan\`.
`;
  if (shouldWrite) {
    await writeSummaryFiles({
      markdown: failureMarkdown,
      json: {
        title: "Weekly Venture Radar Scan Summary",
        created_at: failedAt,
        job_status: "failed",
        job_id: job?.id || null,
        error: err.message,
      },
    });
  }
  console.error(failureMarkdown);
  process.exitCode = 1;
}
