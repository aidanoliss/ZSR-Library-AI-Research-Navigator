export const SOURCE_FEEDBACK_STORAGE_KEY = "zsr-source-feedback-v1";
export const SOURCE_FEEDBACK_REASONS = [
  ["useful", "Useful for my question"],
  ["wrong-population", "Wrong population"],
  ["wrong-location", "Wrong location"],
  ["wrong-method", "Wrong method"],
  ["wrong-source-type", "Wrong source type"],
  ["unrelated", "Unrelated topic"],
];
const clean = (value, limit = 2000) => String(value || "").trim().slice(0, limit);
const allowedReasons = new Set(SOURCE_FEEDBACK_REASONS.map(([id]) => id));
const validStatuses = new Set(["meets", "mismatch", "unverified"]);

export function sourceFitSummary(assessment = {}) {
  const checks = (Array.isArray(assessment.checks) ? assessment.checks : []).map((check) => ({ ...check, status: validStatuses.has(check.status) ? check.status : "unverified" }));
  const scope = checks.filter((check) => check.id === "population" || check.id === "geography" || check.id?.startsWith("method-"));
  const joint = checks.find((check) => check.id === "population-geography");
  const rows = scope.length ? scope : checks.filter((check) => check.id !== "population-geography").slice(0, 3);
  const conflict = checks.some((check) => check.status === "mismatch");
  const unknown = checks.some((check) => check.status !== "meets");
  return {
    rows: rows.map((check) => ({ ...check, label: check.id === "population" ? "Population" : check.id === "geography" ? "Location" : check.label,
      statusLabel: check.status === "meets" ? "Supported by metadata" : check.status === "mismatch" ? "Conflicts with request" : "Not established" })),
    joint,
    preferences: (Array.isArray(assessment.preferenceChecks) ? assessment.preferenceChecks : []).map(check => ({ ...check, status: validStatuses.has(check.status) ? check.status : "unverified", statusLabel: check.status === "meets" ? "Preference supported by metadata" : check.status === "mismatch" ? "Does not match preference" : "Preference not established" })),
    summary: conflict ? "Does not satisfy every checked requirement." : !checks.length ? "No specific requirement checks are available for this record." : unknown ? "Some requested criteria are not established. Treat this as a lead to check." : "Reported metadata supports the checked criteria; relevance and claims still need your review.",
    status: conflict ? "mismatch" : !checks.length || unknown ? "unverified" : "meets",
  };
}

export function createSourceFeedback({ source = {}, request = "", researchSpec = {}, reason, note = "", now = Date.now() }) {
  if (!allowedReasons.has(reason)) return null;
  const sourceId = clean(source.doi || source.url || source.id || source.title, 2000);
  if (!sourceId) return null;
  const query = clean(request);
  const terms = values => (Array.isArray(values) ? values : []).slice(0, 10).map(value => clean(value, 100));
  const criteria = { population: clean(researchSpec.facets?.population, 300), geography: clean(researchSpec.facets?.geography, 300), methods: { include: terms(researchSpec.methodRequirements?.include), exclude: terms(researchSpec.methodRequirements?.exclude) }, mode: clean(researchSpec.mode, 100), preferences: { population: clean(researchSpec.preferredFacets?.population, 300), geography: clean(researchSpec.preferredFacets?.geography, 300), method: clean(researchSpec.preferredFacets?.method, 300) }, publicationYearFrom: researchSpec.sourceRequirements?.publicationYearFrom ?? null, publicationYearTo: researchSpec.sourceRequirements?.publicationYearTo ?? null, peerReviewed: researchSpec.sourceRequirements?.peerReviewed === true };
  return { id: JSON.stringify([query, sourceId, criteria]), createdAt: new Date(now).toISOString(), request: query,
    criteria,
    source: { id: sourceId, title: clean(source.title, 600), doi: clean(source.doi, 300), url: /^https?:\/\//i.test(source.url || "") ? clean(source.url, 2000) : "", provider: clean(source.sourceProvider, 200) },
    reason, note: clean(note, 500), reviewStatus: "unreviewed-student-feedback" };
}

export function validFeedbackQueue(value) {
  return Array.isArray(value) && value.length <= 500 && value.every(item => item && typeof item.id === "string" && typeof item.request === "string" && item.source && typeof item.source.title === "string" && allowedReasons.has(item.reason));
}
export function updateFeedbackQueue(queue, entry) {
  if (!entry) return queue;
  return [...queue.filter(item => item.id !== entry.id), entry].slice(-500);
}
export function feedbackReviewExport(queue, now = Date.now()) {
  return { schemaVersion: 1, exportedAt: new Date(now).toISOString(), purpose: "Optional source relevance feedback for human review", reviewNotice: "Student judgments, not verified labels or evidence of librarian review. Do not use these as a gold-standard evaluation set until independently reviewed.", records: queue.map(item => ({ ...item, reviewStatus: "unreviewed-student-feedback" })) };
}
