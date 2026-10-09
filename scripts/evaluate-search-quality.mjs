import { readFile, writeFile } from "node:fs/promises";
import { evaluateSearchQuality, compareSearchQuality, renderSearchQualityMarkdown } from "../lib/searchQualityEvaluation.js";

const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  if (at < 0) return "";
  if (!args[at + 1] || args[at + 1].startsWith("--")) throw new Error(`${name} needs a value.`);
  return args[at + 1];
};
const capturePath = option("--input");
if (args.includes("--help") || !capturePath) {
  process.stdout.write("Evaluate provider captures and recorded human judgments without network access.\nUsage: node scripts/evaluate-search-quality.mjs --input CAPTURE.json [--before BASELINE.json] [--json] [--write REPORT]\nUnjudged results never receive a usefulness score or a passing grade.\n");
  if (!capturePath && !args.includes("--help")) process.exitCode = 1;
} else {
  const capture = JSON.parse(await readFile(capturePath, "utf8"));
  const report = evaluateSearchQuality(capture);
  const before = option("--before");
  const comparison = before ? compareSearchQuality(JSON.parse(await readFile(before, "utf8")), capture) : null;
  const output = args.includes("--json") ? `${JSON.stringify({ ...report, ...(comparison ? { comparison } : {}) }, null, 2)}\n` : renderSearchQualityMarkdown(report, comparison);
  const write = option("--write");
  if (write) await writeFile(write, output, "utf8");
  process.stdout.write(output);
}
