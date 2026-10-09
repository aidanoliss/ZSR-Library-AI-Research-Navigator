import { readFile, writeFile } from "node:fs/promises";

import {
  evaluatePilotSet,
  renderPilotEvaluationMarkdown,
} from "../lib/pilotEvaluation.js";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const strict = args.includes("--strict");
const writeIndex = args.indexOf("--write");
const writePath = writeIndex >= 0 ? args[writeIndex + 1] : "";
const datasetNames = ["librarian-review-set.json", "generalization-review-set.json"];
const samples = (await Promise.all(datasetNames.map(async (name) =>
  JSON.parse(await readFile(new URL(`../evals/${name}`, import.meta.url), "utf8"))
))).flat();
const report = evaluatePilotSet(samples);
const output = jsonOutput
  ? `${JSON.stringify(report, null, 2)}\n`
  : renderPilotEvaluationMarkdown(report);

if (writePath) await writeFile(writePath, output, "utf8");
process.stdout.write(output);
if (strict && report.summary.failedCases > 0) process.exitCode = 1;
