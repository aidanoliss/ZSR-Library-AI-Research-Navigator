import { writeFile } from "node:fs/promises";

import { ZSR_RESOURCE_CONFIG } from "../config/researchAgent.js";
import { auditResourceConfig, checkResourceUrls } from "../lib/resourceAudit.js";

const args = process.argv.slice(2);
const live = args.includes("--live");
const writeIndex = args.indexOf("--write");
const writePath = writeIndex >= 0 ? args[writeIndex + 1] : "";
const audit = auditResourceConfig(ZSR_RESOURCE_CONFIG);
const liveResults = live ? await checkResourceUrls(ZSR_RESOURCE_CONFIG) : [];
const payload = {
  generatedAt: new Date().toISOString(),
  technicalAudit: audit,
  liveUrlChecks: liveResults,
  note:
    "Technical checks do not constitute librarian approval. Pending review and ownership fields must be resolved by ZSR staff.",
};

const lines = [
  "# ZSR Resource Configuration Audit",
  "",
  `Generated: ${payload.generatedAt}`,
  "",
  payload.note,
  "",
  `- Resources: ${audit.summary.resources}`,
  `- Technical errors: ${audit.summary.errors}`,
  `- Pending librarian review: ${audit.summary.pendingLibrarianReview}`,
  `- Unassigned maintenance owners: ${audit.summary.unassignedOwners}`,
];

if (audit.errors.length) {
  lines.push("", "## Errors", "");
  for (const item of audit.errors) {
    lines.push(`- \`${item.resourceId}\`: ${item.message}`);
  }
}

if (live) {
  const failures = liveResults.filter((result) => !result.ok);
  lines.push(
    "",
    "## Live URL Check",
    "",
    `- Reachable: ${liveResults.length - failures.length}/${liveResults.length}`,
    `- Failed or blocked: ${failures.length}`
  );
  for (const result of failures) {
    lines.push(
      `- \`${result.id}\`: ${result.status || result.error || "No response"}`
    );
  }
}

const report = `${lines.join("\n")}\n`;
if (writePath) await writeFile(writePath, report, "utf8");
process.stdout.write(report);
if (!audit.ok) process.exitCode = 1;
