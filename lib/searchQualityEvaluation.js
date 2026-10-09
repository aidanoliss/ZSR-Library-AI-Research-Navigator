import { uniqueSourceResults } from "../src/sourceDedup.js";

export const SEARCH_QUALITY_FORMAT = "zsr-search-quality-review";
export const HUMAN_JUDGMENTS = ["useful", "not-useful", "uncertain"];
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const normalize = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function evaluationSourceIdentity(source = {}) {
  const doi = String(source.doi || "").trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "");
  if (doi) return `doi:${doi}`;
  const authors = normalize(source.author || (source.authors || []).join(" ")).split(" ").filter(Boolean).sort().join(" ");
  if (source.title) return `title:${normalize(source.title)}|author:${authors}|year:${String(source.date || "").slice(0, 4)}`;
  return `url:${String(source.url || "").split("#")[0]}`;
}

/** Preserve provider evidence and leave every human rating blank. */
export function sourceForReview(source, index) {
  const allowed = ["title", "author", "authors", "date", "type", "url", "doi", "pmid", "isbn", "issn", "containerTitle", "publisher", "edition", "volume", "issue", "pages", "sourceKind", "abstractText", "abstractTruncated", "abstractExcerpt", "abstractSource", "sourceProvider", "accessScope", "peerReviewed", "provenance", "retrievedAt", "sourceAssessment", "matchExplanation", "metadataRank"];
  const bibliographic = Object.fromEntries(allowed.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
  return { rank: index + 1, sourceId: evaluationSourceIdentity(source), ...bibliographic, judgment: null, reviewer: "", notes: "" };
}

export async function captureSearchQualityCase(sample, { live = false, candidateLimit = 20, timeoutMs = 45000, buildPlan, compileQueries, discover, clock = () => performance.now() } = {}) {
  const modeId = sample.modeId || "scholarly";
  const subjectFocusId = sample.subjectFocusId || "auto";
  const accessScopeId = sample.accessScopeId || "library";
  const plan = buildPlan(sample.query, 5, subjectFocusId, modeId, sample.requestContext || {});
  const queries = compileQueries(plan, sample.query);
  const entry = { ...sample, modeId, subjectFocusId, accessScopeId, status: "planned", researchSpec: plan.researchSpec, queries, topFive: [], candidates: [], retrieval: { latencyMs: null, outcomes: {} } };
  if (!live) return entry;
  const started = clock();
  try {
    const discovered = await discover(queries, candidateLimit, plan.researchSpec?.mode || plan.modeId || modeId, accessScopeId, { researchSpec: plan.researchSpec, signal: AbortSignal.timeout(timeoutMs) });
    entry.status = "captured";
    entry.candidates = discovered.results.map(sourceForReview);
    entry.topFive = entry.candidates.slice(0, 5).map(({ rank, sourceId }) => ({ rank, sourceId }));
    entry.retrieval = { latencyMs: Math.round(clock() - started), outcomes: discovered.outcomes, recovery: discovered.recovery || null };
  } catch (error) {
    entry.status = "failed";
    entry.retrieval = { latencyMs: Math.round(clock() - started), outcomes: {}, error: error?.name || "Error" };
  }
  return entry;
}

function metadataFields(source) {
  return {
    title: Boolean(source.title && source.title !== "(untitled)"),
    author: Boolean(source.author || source.authors?.length),
    year: /\b(?:18|19|20)\d{2}\b/.test(String(source.date || "")),
    type: Boolean(source.type),
    link: /^https?:\/\//.test(String(source.url || "")),
    provider: Boolean(source.sourceProvider || source.provenance?.provider),
    abstract: Boolean(source.abstractExcerpt),
  };
}

function evaluateCase(entry) {
  const captured = entry.status === "captured";
  const candidates = captured && Array.isArray(entry.candidates) ? entry.candidates : [];
  const top = candidates.slice(0, 5);
  const graded = top.filter((source) => ["useful", "not-useful"].includes(source.judgment));
  const useful = graded.filter((source) => source.judgment === "useful").length;
  const uncertain = top.filter((source) => source.judgment === "uncertain").length;
  const unjudged = top.filter((source) => !HUMAN_JUDGMENTS.includes(source.judgment)).length;
  const completion = candidates.map(metadataFields);
  const duplicateCount = candidates.length - uniqueSourceResults(candidates).length;
  const topFiveDuplicates = top.length - uniqueSourceResults(top).length;
  const outcomes = Object.values(entry.retrieval?.outcomes || {}).flat();
  return {
    id: entry.id, query: entry.query, captured,
    status: entry.status || "planned", candidateCount: candidates.length, topFiveCount: top.length,
    useful, judged: graded.length, unjudged, uncertain,
    judgedPrecisionAt5: graded.length ? useful / graded.length : null,
    precisionAt5: captured && graded.length > 0 && !unjudged && !uncertain ? useful / 5 : null,
    empty: captured ? candidates.length === 0 : null,
    duplicateCount, topFiveDuplicates,
    latencyMs: captured && Number.isFinite(entry.retrieval?.latencyMs) ? entry.retrieval.latencyMs : null,
    providerFailures: outcomes.filter((outcome) => ["error", "timeout", "rate_limited", "cancelled"].includes(outcome.status)).length,
    disabledProviderOutcomes: outcomes.filter((outcome) => ["disabled", "unsupported"].includes(outcome.status)).length,
    metadata: Object.fromEntries(["title", "author", "year", "type", "link", "provider", "abstract"].map((field) => [field, {
      present: completion.filter((row) => row[field]).length, total: candidates.length,
      proportion: candidates.length ? completion.filter((row) => row[field]).length / candidates.length : null,
    }])),
  };
}

export function evaluateSearchQuality(artifact) {
  if (!artifact || artifact.format !== SEARCH_QUALITY_FORMAT || !Array.isArray(artifact.cases)) {
    throw new Error("Expected a zsr-search-quality-review capture with a cases array.");
  }
  const cases = artifact.cases.map(evaluateCase);
  const captured = cases.filter((row) => row.captured);
  const sum = (key) => cases.reduce((total, row) => total + row[key], 0);
  const judged = sum("judged");
  const unjudged = sum("unjudged");
  const uncertain = sum("uncertain");
  const complete = judged > 0 && unjudged === 0 && uncertain === 0;
  return {
    label: artifact.label || "Search review", generatedAt: new Date().toISOString(),
    interpretation: "Human usefulness is separate from metadata matching. Unrated and uncertain results are excluded from judged precision; missing values are not successes or zero scores. Standard precision@5 uses five slots per captured query and is withheld until displayed results have determinate judgments.",
    summary: {
      totalCases: cases.length, capturedCases: captured.length,
      plannedCases: cases.filter((row) => row.status === "planned").length,
      failedCaptures: cases.filter((row) => row.status === "failed").length,
      emptyResults: captured.filter((row) => row.empty).length,
      emptyWithProviderFailures: captured.filter((row) => row.empty && row.providerFailures > 0).length,
      emptyWithDisabledProviders: captured.filter((row) => row.empty && row.disabledProviderOutcomes > 0).length,
      candidateCount: sum("candidateCount"), topFiveCount: sum("topFiveCount"),
      judged, useful: sum("useful"), unjudged, uncertain,
      humanReviewStatus: !judged && !uncertain ? "not_started" : complete ? "complete" : "incomplete",
      judgedPrecisionAt5: judged ? sum("useful") / judged : null,
      precisionAt5: complete && captured.length ? sum("useful") / (5 * captured.length) : null,
      duplicateCount: sum("duplicateCount"), topFiveDuplicates: sum("topFiveDuplicates"),
      meanLatencyMs: mean(captured.map((row) => row.latencyMs).filter((value) => value !== null)),
      providerFailures: sum("providerFailures"),
      metadata: Object.fromEntries(["title", "author", "year", "type", "link", "provider", "abstract"].map((field) => {
        const present = captured.reduce((count, row) => count + row.metadata[field].present, 0);
        const total = sum("candidateCount");
        return [field, { present, total, proportion: total ? present / total : null }];
      })),
    }, cases,
  };
}

/** Pair exact requests only; changed query/mode/requirements cannot prove a ranking improvement. */
export function compareSearchQuality(before, after) {
  const beforeById = new Map(before.cases.map((entry) => [entry.id, entry]));
  const compatible = [];
  const excluded = [];
  const signature = (entry) => JSON.stringify([entry.query, entry.modeId || "scholarly", entry.subjectFocusId || "auto", entry.accessScopeId || "library", entry.requestContext || {}]);
  for (const next of after.cases) {
    const prior = beforeById.get(next.id);
    if (!prior || signature(prior) !== signature(next) || prior.status !== "captured" || next.status !== "captured") {
      excluded.push({ id: next.id, reason: !prior ? "missing_before" : signature(prior) !== signature(next) ? "request_changed" : "capture_missing" });
    } else compatible.push({ prior, next });
  }
  const left = evaluateSearchQuality({ ...before, cases: compatible.map(({ prior }) => prior) });
  const right = evaluateSearchQuality({ ...after, cases: compatible.map(({ next }) => next) });
  const fullyReviewed = compatible.filter(({ prior, next }) => {
    const a = evaluateCase(prior); const b = evaluateCase(next);
    return a.judged > 0 && b.judged > 0 && !a.unjudged && !b.unjudged && !a.uncertain && !b.uncertain;
  });
  return {
    pairedCases: compatible.length, fullyReviewedPairs: fullyReviewed.length, excluded,
    before: left.summary, after: right.summary,
    precisionAt5Delta: fullyReviewed.length ? mean(fullyReviewed.map(({ prior, next }) => evaluateCase(next).precisionAt5 - evaluateCase(prior).precisionAt5)) : null,
    emptyResultDelta: compatible.length ? right.summary.emptyResults - left.summary.emptyResults : null,
    duplicateDelta: compatible.length ? right.summary.duplicateCount - left.summary.duplicateCount : null,
    meanLatencyDeltaMs: compatible.length ? mean(compatible.map(({ prior, next }) => {
      const a = prior.retrieval?.latencyMs; const b = next.retrieval?.latencyMs;
      return Number.isFinite(a) && Number.isFinite(b) ? b - a : null;
    }).filter((value) => value !== null)) : null,
    interpretation: "Precision delta is restricted to matched requests whose top results were fully judged in both captures. Provider changes, capture dates, query differences, and latency conditions can confound comparisons. No positive delta establishes statistical significance.",
  };
}

const value = (number, percentage = false) => number === null ? "Not measured" : percentage ? `${(number * 100).toFixed(1)}%` : String(number);
export function renderSearchQualityMarkdown(report, comparison = null) {
  const s = report.summary;
  const lines = ["# Search quality review", "", `Capture: ${report.label}`, "", `Human review: **${s.humanReviewStatus.replaceAll("_", " ")}**. Automated metadata checks do not establish relevance or research usefulness.`, "",
    "| Measure | Observed value |", "|---|---:|",
    ["Captured / planned / failed queries", `${s.capturedCases} / ${s.plannedCases} / ${s.failedCaptures}`],
    ["Useful / determinate judgments in top five", `${s.useful} / ${s.judged}`],
    ["Unjudged / uncertain results in top five", `${s.unjudged} / ${s.uncertain}`],
    ["Judged precision in top five (partial reviews may be biased)", value(s.judgedPrecisionAt5, true)],
    ["Precision@5 (complete judgments required)", value(s.precisionAt5, true)],
    ["Empty captured searches", s.emptyResults], ["Empty searches with provider failures / disabled providers", `${s.emptyWithProviderFailures} / ${s.emptyWithDisabledProviders}`], ["Duplicate candidates / top-five duplicates", `${s.duplicateCount} / ${s.topFiveDuplicates}`],
    ["Mean search latency, ms", s.meanLatencyMs === null ? "Not measured" : Math.round(s.meanLatencyMs)], ["Provider failure outcomes", s.providerFailures],
  ].map((line) => Array.isArray(line) ? `| ${line[0]} | ${line[1]} |` : line);
  lines.push("", "Metadata presence across candidate records (missing abstracts can be legitimate):", "", "| Field | Present / records |", "|---|---:|",
    ...Object.entries(s.metadata).map(([field, stats]) => `| ${field} | ${stats.present} / ${stats.total} |`), "", report.interpretation);
  if (comparison) lines.push("", "## Matched before/after", "", `Matched captures: ${comparison.pairedCases}; fully reviewed pairs: ${comparison.fullyReviewedPairs}; excluded: ${comparison.excluded.length}.`, "",
    `Precision@5 change: ${value(comparison.precisionAt5Delta, true)}. Empty-search change: ${value(comparison.emptyResultDelta)}. Duplicate change: ${value(comparison.duplicateDelta)}.`, "", comparison.interpretation);
  return `${lines.join("\n")}\n`;
}
