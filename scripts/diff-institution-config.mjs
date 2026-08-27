import { INSTITUTION_PROFILES } from "../config/institutionProfile.js";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const failOnDiff = args.includes("--fail-on-diff");
const positional = args.filter((arg) => !arg.startsWith("--"));
const leftId = positional[0] || "wfu-zsr-prototype";
const rightId = positional[1] || "duke-illustrative-unapproved";
const left = INSTITUTION_PROFILES[leftId];
const right = INSTITUTION_PROFILES[rightId];

if (!left || !right) {
  const available = Object.keys(INSTITUTION_PROFILES).join(", ");
  process.stderr.write(`Unknown profile. Available profiles: ${available}\n`);
  process.exit(2);
}

function flatten(value, prefix = "", output = {}) {
  if (Array.isArray(value)) {
    output[prefix] = value;
    return output;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      flatten(item, prefix ? `${prefix}.${key}` : key, output);
    }
    return output;
  }
  output[prefix] = value;
  return output;
}

function display(value) {
  if (value === null) return "<not configured>";
  if (value === undefined) return "<absent>";
  if (Array.isArray(value)) return value.length ? JSON.stringify(value) : "[]";
  return String(value);
}

function markdownCell(value) {
  return display(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

const leftFlat = flatten(left);
const rightFlat = flatten(right);
const paths = [...new Set([...Object.keys(leftFlat), ...Object.keys(rightFlat)])].sort();
const differences = paths
  .filter((path) => JSON.stringify(leftFlat[path]) !== JSON.stringify(rightFlat[path]))
  .map((path) => ({ path, left: leftFlat[path], right: rightFlat[path] }));

const report = {
  generatedAt: new Date().toISOString(),
  schemaVersion: left.schemaVersion,
  leftProfile: leftId,
  rightProfile: rightId,
  warning: "A configuration difference is not institutional approval. Null means no value has been supplied.",
  differences,
};

if (jsonOutput) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const lines = [
    "# Institution Configuration Difference",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `> ${report.warning}`,
    "",
    `- Left: \`${leftId}\``,
    `- Right: \`${rightId}\``,
    `- Changed fields: ${differences.length}`,
    "",
    "| Field | Left | Right |",
    "| --- | --- | --- |",
    ...differences.map(
      (item) => `| ${item.path} | ${markdownCell(item.left)} | ${markdownCell(item.right)} |`
    ),
    "",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}
if (failOnDiff && differences.length) process.exitCode = 1;
