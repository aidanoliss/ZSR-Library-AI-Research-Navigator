#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { sourceForReview } from "../lib/searchQualityEvaluation.js";

const hash = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const hashPattern = /^[a-f0-9]{64}$/;
export const blankCases = () => ({
  format: "zsr-independent-cases-v1",
  provenance: { collectedBy: "", collectedAt: "", authorship: "human", anonymized: false, consentToEvaluation: false, notUsedForTuning: false },
  acceptanceCriteria: { approvedBy: "", minimumCases: null, minimumUsefulProportion: null, maximumEmptyProportion: null },
  cases: [],
});

// Hash application inputs, including uncommitted changes. Exclude logs, user text,
// credentials, generated dist and review documents from the release manifest.
export async function releaseManifest(root) {
  const paths = [];
  async function walk(path) {
    let items;
    try { items = await readdir(path, { withFileTypes: true }); }
    catch (error) { if (error.code === "ENOENT") return; throw error; }
    for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = resolve(path, item.name);
      if (item.isDirectory()) await walk(child);
      else if (item.isFile() && /\.(?:[cm]?js|jsx|ts|tsx|json|css|html|svg)$/.test(item.name)) paths.push(child);
    }
  }
  for (const directory of ["server", "src", "config", "lib"]) await walk(resolve(root, directory));
  for (const file of ["package.json", "package-lock.json", "index.html", "vite.config.js"]) {
    try { await readFile(resolve(root, file)); paths.push(resolve(root, file)); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const files = await Promise.all(paths.sort().map(async (path) => ({ path: relative(root, path), sha256: hash(await readFile(path, "utf8")) })));
  if (!files.length) throw new Error("No application files found for release fingerprint.");
  return { sha256: hash(files), files };
}

function validateCases(input) {
  const p = input.provenance || {};
  if (input.format !== "zsr-independent-cases-v1" || p.authorship !== "human" || !p.collectedBy || !Number.isFinite(Date.parse(p.collectedAt)) || !p.anonymized || !p.consentToEvaluation || !p.notUsedForTuning) throw new Error("Independent human authorship, collection date, anonymization, consent and no-tuning attestations are required.");
  if (!Array.isArray(input.cases) || !input.cases.length) throw new Error("Supply independently collected cases; the template intentionally has no questions.");
  const ids = new Set();
  for (const entry of input.cases) {
    if (!entry.id || ids.has(entry.id) || !String(entry.query || "").trim()) throw new Error("Each case needs a unique id and a non-empty anonymized question.");
    ids.add(entry.id);
  }
}
const requestSignature = (entry) => JSON.stringify([entry.query, entry.modeId || "scholarly", entry.subjectFocusId || "auto", entry.accessScopeId || "library", entry.requestContext || {}]);

export function prepareReview(input, release, capture = null) {
  validateCases(input);
  if (!hashPattern.test(release?.sha256 || "")) throw new Error("A release SHA-256 fingerprint is required.");
  if (capture && (capture.format !== "zsr-search-quality-review" || capture.releaseSha256 !== release.sha256 || !capture.capturedBy || !Number.isFinite(Date.parse(capture.generatedAt)))) throw new Error("Capture must record this release fingerprint, capture operator and timestamp.");
  const captures = new Map((capture?.cases || []).map((entry) => [entry.id, entry]));
  if (capture && (captures.size !== input.cases.length || captures.size !== capture.cases.length)) throw new Error("Capture must contain exactly the frozen independent cases.");
  const cases = input.cases.map((sample) => {
    const entry = captures.get(sample.id);
    if (capture && (!entry || requestSignature(entry) !== requestSignature(sample))) throw new Error(`Capture request changed for case ${sample.id}.`);
    const candidates = (entry?.candidates || []).slice(0, 5).map((source, index) => ({
      ...sourceForReview(source, index),
      judgment: null, reviewer: "", notes: "",
      identityVerified: null, evidenceContextAccurate: null,
    }));
    return {
      input: sample, captureStatus: entry?.status || "not_captured", retrieval: entry?.retrieval || null,
      generatedOverview: String(entry?.generatedOverview || entry?.message || ""),
      evidenceNotes: entry?.evidenceNotes || entry?.evidence_notes || [],
      displayedResponse: entry?.displayedResponse || null, candidates,
      review: { reviewer: "", reviewedAt: "", independentHumanReview: false, intentPreserved: null, emptyOutcomeAppropriate: null, unsupportedClaims: null, notes: "" },
    };
  });
  const packet = { format: "zsr-independent-review-v1", createdAt: new Date().toISOString(), release, provenance: input.provenance, acceptanceCriteria: input.acceptanceCriteria || {}, casesSha256: hash(input.cases), cases };
  packet.evidenceSha256 = evidenceFingerprint(packet);
  return packet;
}

function evidenceFingerprint(packet) {
  return hash({ release: packet.release, provenance: packet.provenance, acceptanceCriteria: packet.acceptanceCriteria, casesSha256: packet.casesSha256,
    cases: packet.cases.map(({ review, candidates, ...entry }) => ({ ...entry, candidates: candidates.map(({ judgment, reviewer, notes, identityVerified, evidenceContextAccurate, ...source }) => source) })) });
}

export function checkReview(packet) {
  if (packet?.format !== "zsr-independent-review-v1" || !Array.isArray(packet.cases)) throw new Error("Expected an independent review packet.");
  const problems = [];
  if (packet.evidenceSha256 !== evidenceFingerprint(packet) || packet.casesSha256 !== hash(packet.cases.map((entry) => entry.input)) || packet.release?.sha256 !== hash(packet.release?.files)) problems.push("Frozen evidence, cases or release manifest changed; recapture and review the changed release.");
  const a = packet.acceptanceCriteria || {};
  if (!a.approvedBy || !Number.isInteger(a.minimumCases) || a.minimumCases < 1 || !Number.isFinite(a.minimumUsefulProportion) || a.minimumUsefulProportion < 0 || a.minimumUsefulProportion > 1 || !Number.isFinite(a.maximumEmptyProportion) || a.maximumEmptyProportion < 0 || a.maximumEmptyProportion > 1) problems.push("Librarian-approved acceptance criteria are missing or invalid.");
  if (!packet.cases.length || packet.cases.length < a.minimumCases) problems.push("Insufficient independent cases.");
  let useful = 0; let judged = 0; let empty = 0; let complete = true;
  for (const entry of packet.cases) {
    const r = entry.review || {};
    if (entry.captureStatus !== "captured") { problems.push(`${entry.input.id}: capture missing or failed.`); complete = false; }
    if (!entry.displayedResponse || typeof entry.displayedResponse !== "object" || !Object.keys(entry.displayedResponse).length) { problems.push(`${entry.input.id}: complete displayed response was not captured; source-only evaluation is insufficient.`); complete = false; }
    if (!entry.candidates.length) empty++;
    if (!r.reviewer || !Number.isFinite(Date.parse(r.reviewedAt)) || r.independentHumanReview !== true || typeof r.intentPreserved !== "boolean" || !Number.isInteger(r.unsupportedClaims) || r.unsupportedClaims < 0 || (!entry.candidates.length && typeof r.emptyOutcomeAppropriate !== "boolean")) { problems.push(`${entry.input.id}: case review incomplete.`); complete = false; }
    if (r.intentPreserved === false || r.unsupportedClaims > 0 || r.emptyOutcomeAppropriate === false) problems.push(`${entry.input.id}: intent, unsupported-claim or empty-result review failed.`);
    for (const source of entry.candidates) {
      if (!source.reviewer || !["useful", "not-useful"].includes(source.judgment) || typeof source.identityVerified !== "boolean" || typeof source.evidenceContextAccurate !== "boolean") { problems.push(`${entry.input.id}: source review incomplete.`); complete = false; }
      if (["useful", "not-useful"].includes(source.judgment)) { judged++; if (source.judgment === "useful") useful++; }
      if (source.identityVerified === false || source.evidenceContextAccurate === false) problems.push(`${entry.input.id}: source identity or evidence context failed.`);
    }
  }
  const usefulProportion = judged ? useful / judged : null;
  const emptyProportion = packet.cases.length ? empty / packet.cases.length : null;
  if (usefulProportion === null || usefulProportion < a.minimumUsefulProportion) problems.push("Useful-source proportion has not met the approved threshold.");
  if (emptyProportion > a.maximumEmptyProportion) problems.push("Empty-search proportion exceeds the approved threshold.");
  return { readyForReviewedPilot: problems.length === 0, humanReviewComplete: complete && packet.cases.length > 0, cases: packet.cases.length, useful, judged, usefulProportion, emptyProportion, problems, interpretation: "Human attestations must be independently verified. This gate is a pilot review decision, not a guarantee of factual accuracy or a comprehensive literature search." };
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag) => { const i = args.indexOf(flag); return i < 0 ? null : args[i + 1]; };
  const load = async (path) => JSON.parse(await readFile(resolve(path), "utf8"));
  let output;
  if (args.includes("--template")) output = blankCases();
  else if (args.includes("--manifest")) output = await releaseManifest(resolve(value("--root") || "."));
  else if (value("--check")) {
    const packet = await load(value("--check"));
    output = checkReview(packet);
    const currentRelease = await releaseManifest(resolve(value("--root") || "."));
    if (packet.release.sha256 !== currentRelease.sha256) {
      output.readyForReviewedPilot = false;
      output.problems.push("Current application files differ from the reviewed release; evaluate this release before claiming readiness.");
    }
    if (!output.readyForReviewedPilot) process.exitCode = 1;
  } else {
    if (!value("--cases")) throw new Error("Use --template, --manifest, --check FILE, or --cases FILE [--capture FILE] [--out FILE].");
    output = prepareReview(await load(value("--cases")), await releaseManifest(resolve(value("--root") || ".")), value("--capture") ? await load(value("--capture")) : null);
  }
  if (value("--out")) await writeFile(resolve(value("--out")), `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  else console.log(JSON.stringify(output, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
