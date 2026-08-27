import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

import {
  DUKE_ILLUSTRATIVE_PROFILE,
  WFU_INSTITUTION_PROFILE,
  validateInstitutionProfile,
} from "../config/institutionProfile.js";
import {
  evaluatePilotSet,
  expandEvaluationMatrix,
} from "../lib/pilotEvaluation.js";
import { buildResearchPlan } from "../config/researchAgent.js";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const strict = args.includes("--strict");
const requireClean = args.includes("--require-clean");
const writeIndex = args.indexOf("--write");
const writePath = writeIndex >= 0 ? args[writeIndex + 1] : "";
if (writeIndex >= 0 && (!writePath || writePath.startsWith("--"))) {
  process.stderr.write("--write requires a file path.\n");
  process.exit(2);
}

const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const [librarianSamples, matrix, loadedCases, packageJson] = await Promise.all([
  readJson("../evals/librarian-review-set.json"),
  readJson("../evals/evaluation-matrix.json"),
  readJson("../evals/loaded-question-review-set.json"),
  readJson("../package.json"),
]);

function gitValue(args, fallback = "unknown") {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const matrixSamples = expandEvaluationMatrix(matrix);
const baseline = evaluatePilotSet(librarianSamples);
const matrixReport = evaluatePilotSet(matrixSamples);
const wfuValidation = validateInstitutionProfile(WFU_INSTITUTION_PROFILE);
const dukeValidation = validateInstitutionProfile(DUKE_ILLUSTRATIVE_PROFILE);
const gitStatus = gitValue(["status", "--porcelain"], "");
const loadedSafetyResults = loadedCases.map((sample) => {
  const plan = buildResearchPlan(sample.prompt, 6, "auto", sample.mode);
  return {
    id: sample.id,
    passed: Boolean(plan.safety?.requiresPremiseCheck && plan.safety?.flags?.length),
    flags: plan.safety?.flags || [],
    planHash: plan.planHash || "",
  };
});

const modes = Object.fromEntries(
  Object.keys(matrix.modes).map((modeId) => {
    const cases = matrixReport.cases.filter((sample) => sample.output.modeId === modeId);
    return [
      modeId,
      {
        cases: cases.length,
        passedCases: cases.filter((sample) => sample.passed).length,
        planHashes: cases.map((sample) => sample.output.planHash),
      },
    ];
  })
);

const evidence = {
  generatedAt: new Date().toISOString(),
  evidenceType: "automated-release-evidence",
  release: {
    packageVersion: packageJson.version,
    institutionProfileVersion: WFU_INSTITUTION_PROFILE.profileVersion,
    routingConfigVersions: matrixReport.configVersions,
    commit: gitValue(["rev-parse", "HEAD"]),
    branch: gitValue(["branch", "--show-current"]),
    workingTreeDirty: Boolean(gitStatus),
    cleanTreeRequired: requireClean,
    nodeVersion: process.version,
  },
  claimsBoundary: {
    automatedApproval: false,
    humanApproval: false,
    institutionalApproval: false,
    note: "Passing automation is regression evidence only. Librarian ratings, privacy review, accessibility review, security review, and institutional approval remain separate gates.",
  },
  institutionProfiles: {
    wfu: {
      id: WFU_INSTITUTION_PROFILE.id,
      valid: wfuValidation.valid,
      approvedForInstitutionalUse: false,
      warnings: wfuValidation.warnings,
    },
    dukeTemplate: {
      id: DUKE_ILLUSTRATIVE_PROFILE.id,
      valid: dukeValidation.valid,
      approvedForInstitutionalUse: false,
      configured: false,
      warnings: dukeValidation.warnings,
    },
  },
  automatedEvaluations: {
    librarianBaseline: baseline.summary,
    metamorphicMatrix: matrixReport.summary,
    byMode: modes,
    loadedQuestionCoverage: {
      cases: loadedCases.length,
      safetyMetadataPasses: loadedSafetyResults.filter((sample) => sample.passed).length,
      categories: [...new Set(loadedCases.map((sample) => sample.category))].sort(),
      casesWithSafetyMetadata: loadedSafetyResults,
      note: "Dataset coverage is reported here. Live model behavior requires the separate opt-in live adversarial test.",
    },
  },
  requiredHumanGates: [
    "Librarian relevance and search-quality scoring",
    "Privacy and data-governance approval",
    "Accessibility review with assistive technology",
    "Application security and deployment review",
    "Institutional branding and content-owner approval",
  ],
};

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function renderMarkdown(report) {
  const baselineSummary = report.automatedEvaluations.librarianBaseline;
  const matrixSummary = report.automatedEvaluations.metamorphicMatrix;
  const lines = [
    "# Release Evidence Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `> ${report.claimsBoundary.note}`,
    "",
    "## Release identity",
    "",
    `- Application version: ${report.release.packageVersion}`,
    `- Institution profile version: ${report.release.institutionProfileVersion}`,
    `- Routing configuration version(s): ${report.release.routingConfigVersions.join(", ") || "not reported"}`,
    `- Commit: ${report.release.commit}`,
    `- Branch: ${report.release.branch}`,
    `- Working tree dirty: ${report.release.workingTreeDirty ? "yes" : "no"}`,
    `- Node: ${report.release.nodeVersion}`,
    "",
    "## Automated evidence",
    "",
    `- Librarian baseline: ${baselineSummary.passedCases}/${baselineSummary.cases} cases (${percent(baselineSummary.casePassRate)})`,
    `- Discipline x mode x paraphrase matrix: ${matrixSummary.passedCases}/${matrixSummary.cases} cases (${percent(matrixSummary.casePassRate)})`,
    `- Loaded-question safety metadata: ${report.automatedEvaluations.loadedQuestionCoverage.safetyMetadataPasses}/${report.automatedEvaluations.loadedQuestionCoverage.cases} cases across ${report.automatedEvaluations.loadedQuestionCoverage.categories.length} categories`,
    `- Human approval status: ${matrixSummary.humanApprovalStatus}`,
    "",
    "| Mode | Passing cases | Total |",
    "| --- | ---: | ---: |",
    ...Object.entries(report.automatedEvaluations.byMode).map(
      ([modeId, result]) => `| ${modeId} | ${result.passedCases} | ${result.cases} |`
    ),
    "",
    "## Institution profiles",
    "",
    `- WFU prototype profile structurally valid: ${report.institutionProfiles.wfu.valid ? "yes" : "no"}; institutional approval: no`,
    `- Duke illustrative profile structurally valid: ${report.institutionProfiles.dukeTemplate.valid ? "yes" : "no"}; configured: no; institutional approval: no`,
    "",
    "## Human gates still required",
    "",
    ...report.requiredHumanGates.map((gate) => `- ${gate}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

const output = jsonOutput
  ? `${JSON.stringify(evidence, null, 2)}\n`
  : renderMarkdown(evidence);
if (writePath) await writeFile(writePath, output, "utf8");
process.stdout.write(output);

const hasFailures =
  baseline.summary.failedCases > 0 ||
  matrixReport.summary.failedCases > 0 ||
  loadedSafetyResults.some((sample) => !sample.passed) ||
  !wfuValidation.valid ||
  !dukeValidation.valid ||
  (requireClean && Boolean(gitStatus));
if (strict && hasFailures) process.exitCode = 1;
