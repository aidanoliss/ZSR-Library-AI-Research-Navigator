import { generateWeeklyReport } from "../lib/reports.js";
import { readJson, shouldWrite, writeJson } from "./_data.js";

const companies = await readJson("data/sample_startups.json");
const investors = await readJson("data/sample_investors.json");
const report = generateWeeklyReport(companies, investors, {
  period_start: process.env.VENTURE_RADAR_PERIOD_START || "2026-06-10",
  period_end: process.env.VENTURE_RADAR_PERIOD_END || "2026-06-17",
});

if (shouldWrite()) {
  await writeJson("data/generated_weekly_report.json", report);
}

console.log(JSON.stringify({ ok: true, report }, null, 2));
