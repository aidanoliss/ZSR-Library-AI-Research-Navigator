import { normalizeSourceRequirements, sourceRequirementUpdates } from "../config/sourceRequirements.js";
import { assessSourceRequirements, sourceKindFromMetadata, sourcePeerReviewStatus, sourcePublicationYear } from "./sourceAssessment.js";
import { isSavedSource, normalizeResearchWorkspace, savedSourceIdentity, sourceForResearchItem } from "./researchWorkspace.js";

export const REQUIREMENT_STATUS_LABELS = { meets: "Supported by metadata", unverified: "Needs verification", mismatch: "Does not meet" };

export function workspaceRequirementSpec(assignment = {}, researchSpec = null) {
  const hasAssignment = ["sourceCount", "sourceTypes", "dateRange", "constraints"].some((key) => String(assignment[key] || "").trim());
  if (!hasAssignment && researchSpec) return { ...researchSpec, origin: "Current request" };
  // Empty or unrecognized brief fields do not erase constraints from the
  // active request. Parse fields separately so explicit date expectations take
  // precedence over incidental dates in the free-text constraints field.
  const typeUpdates = sourceRequirementUpdates(assignment.sourceTypes);
  const constraintUpdates = sourceRequirementUpdates(assignment.constraints);
  const dateUpdates = sourceRequirementUpdates(assignment.dateRange);
  const sourceCount = String(assignment.sourceCount || "").trim();
  const countMatch = sourceCount.match(/^(100|[1-9]\d?)(?:\s+sources?)?$/i);
  const sourceRequirements = normalizeSourceRequirements({
    ...researchSpec?.sourceRequirements,
    ...typeUpdates,
    ...constraintUpdates,
    ...dateUpdates,
    ...(countMatch ? { requestedSourceCount: Number(countMatch[1]) } : {}),
  });
  const types = String(assignment.sourceTypes || "").toLowerCase();
  const typeGroups = [
    [/\b(?:articles?|studies|systematic reviews?|literature reviews?)\b/, ["scholarly-article"]],
    [/\b(?:books?|monographs?)\b/, ["book", "book-chapter"]],
    [/\b(?:primary|archives?|archival)\b/, ["primary-source", "archival-material", "legal-primary"]],
    [/\b(?:news|newspapers?)\b/, ["news"]],
    [/\b(?:data|datasets?|statistics?)\b/, ["dataset", "statistics"]],
    [/\bbackground\b/, ["background", "book", "book-chapter"]],
  ];
  const complexTypeRestriction = /\b(?:not|no|without|exclude|except)\b/.test(types);
  const matchedTypes = complexTypeRestriction ? [] : typeGroups.filter(([pattern]) => pattern.test(types));
  const allowedKinds = [...new Set(matchedTypes.flatMap(([, kinds]) => kinds))];
  const dateUnderstood = Object.hasOwn(dateUpdates, "publicationYearFrom") || Object.hasOwn(dateUpdates, "publicationYearTo");
  const manualRequirements = [
    ...(researchSpec?.manualRequirements || []),
    assignment.constraints && "Other assignment constraints need your review.",
    sourceCount && !countMatch && "The source target could not be interpreted; enter a number from 1 to 100.",
    assignment.dateRange && !dateUnderstood && "Date expectations need your review; the current request's date limits are retained.",
    types && !allowedKinds.length && (complexTypeRestriction || !Object.hasOwn(typeUpdates, "peerReviewed")) && "Source-type requirements need your review; the current request's source types are retained.",
    matchedTypes.length > 1 && "Check the required mix of source types with your assignment.",
  ].filter(Boolean);
  return {
    ...researchSpec,
    sourceRequirements,
    sourceContract: allowedKinds.length ? { allowedKinds, label: "the source types in your brief" } : researchSpec?.sourceContract || null,
    origin: hasAssignment ? researchSpec ? "Assignment brief + current request" : "Assignment brief" : "Current request",
    manualRequirements: [...new Set(manualRequirements)],
  };
}

export function assessSavedSource(item, spec) {
  const source = sourceForResearchItem(item);
  const assessment = assessSourceRequirements(source, spec);
  const checks = assessment.checks.map((check) => item.imported && check.status === "meets" ? { ...check, status: "unverified", detail: `${check.detail} Imported metadata has not been rechecked against the provider.` } : check);
  if (spec?.manualRequirements?.length) checks.push({ id: "assignment-review", label: "Assignment details", status: "unverified", detail: spec.manualRequirements.join(" ") });
  if (source.provenance?.demoData === true || source.accessScope === "demo") checks.push({ id: "demo-data", label: "Usable source", status: "mismatch", detail: "This is demonstration data and cannot be counted as a research source." });
  const status = checks.some((check) => check.status === "mismatch") ? "mismatch" : checks.some((check) => check.status === "unverified") || !checks.length ? "unverified" : "meets";
  return { status, checks, issues: checks.filter((check) => check.status !== "meets").map((check) => check.detail) };
}

export function assignmentProgress(workspace, researchSpec = null) {
  const current = normalizeResearchWorkspace(workspace);
  const spec = workspaceRequirementSpec(current.assignment, researchSpec);
  const selected = current.trail.filter((item) => isSavedSource(item) && item.status === "use");
  const seen = new Set();
  const unique = selected.filter((item) => {
    const id = savedSourceIdentity(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const assessed = unique.map((item) => ({ item, ...assessSavedSource(item, spec) }));
  const checks = new Map();
  for (const assessment of assessed) for (const check of assessment.checks) {
    if (!checks.has(check.id)) checks.set(check.id, { id: check.id, label: check.label, meets: 0, unverified: 0, mismatch: 0 });
    checks.get(check.id)[check.status] += 1;
  }
  return {
    spec,
    target: spec.sourceRequirements?.requestedSourceCount || null,
    selected: unique.length,
    duplicates: selected.length - unique.length,
    supported: assessed.filter((entry) => entry.status === "meets").length,
    unknown: assessed.filter((entry) => entry.status === "unverified").length,
    mismatches: assessed.filter((entry) => entry.status === "mismatch").length,
    checks: [...checks.values()],
    sources: assessed,
  };
}

export function savedSourceDetails(item, spec = {}) {
  const source = sourceForResearchItem(item);
  const author = source.author || (source.authors || source.citation?.authors || []).map((value) => typeof value === "string" ? value : value.name || value.displayName || [value.given, value.family].filter(Boolean).join(" ")).filter(Boolean).join("; ");
  const kind = sourceKindFromMetadata(source).replaceAll("-", " ") || source.type || "Not supplied";
  const year = sourcePublicationYear(source);
  const peer = sourcePeerReviewStatus(source);
  const provider = source.sourceProvider || source.provenance?.provider || "Not recorded";
  const sourceText = [source.title, source.abstractExcerpt, ...(source.subjects || [])].join(" ").toLowerCase();
  const matched = (spec.concepts || []).filter((concept) => [concept.preferredTerm, ...(concept.synonyms || [])].some((term) => term && String(term).replaceAll("*", "").length > 2 && sourceText.includes(String(term).toLowerCase().replaceAll("*", "")))).map((concept) => concept.preferredTerm);
  const match = source.matchExplanation;
  return {
    author: author || "Not supplied",
    year: year || "Not supplied",
    kind, provider,
    peerReview: item.imported ? "Unverified imported metadata" : peer === "meets" ? "Reported peer reviewed" : peer === "mismatch" ? "Reported not peer reviewed" : "Not established by metadata",
    access: source.accessScope === "open-access" ? `Provider reports open access${source.openAccess?.version ? ` · ${source.openAccess.version}` : ""}` : source.accessScope === "library" ? "Check access in the library record" : "Access not verified",
    license: source.openAccess?.license || source.provenance?.license || "Not supplied for this work",
    doi: source.doi || source.citation?.doi || "Not supplied",
    fit: matched.length ? `Saved metadata mentions: ${matched.join(", ")}. Check whether the source addresses your question.` : match?.explanation || "Read the record or abstract to judge topic relevance; metadata alone does not establish fit.",
    checks: assessSavedSource(item, spec).checks,
  };
}
