import { createHash } from "node:crypto";

import { WFU_INSTITUTION_PROFILE } from "../config/institutionProfile.js";
import {
  buildResearchPlan,
  isSubstantiveResearchRequest,
  normalizeSearchOptionKey,
} from "../config/researchAgent.js";

const GENERIC_RESOURCE_IDS = new Set([
  "databases-az",
  "ask-a-librarian",
  "research-guides",
  "business-guide",
]);

const NATURAL_LANGUAGE_QUERY_RE =
  /\b(?:can you|could you|would you|please|help me|i need|i want|how does|how do|why does|what is|tell me|give me|find me|show me)\b/i;

function visibleSearchOptions(plan) {
  return [
    ...plan.recommendations.flatMap((resource) =>
      (resource.searchTerms || []).map((query) => ({
        location: `Recommended path: ${resource.name}`,
        query,
      }))
    ),
    ...plan.otherStartingPoints.flatMap((resource) =>
      (resource.searchTerms || []).map((query) => ({
        location: `Other starting point: ${resource.name}`,
        query,
      }))
    ),
    ...(plan.searchTerms || []).map((query) => ({
      location: "Search terms to try",
      query,
    })),
    ...(plan.fallbacks || [])
      .filter((fallback) => fallback.query)
      .map((fallback) => ({
        location: `Fallback: ${fallback.label}`,
        query: fallback.query,
      })),
  ].filter((option) => String(option.query || "").trim());
}

function duplicateOptions(options, { allowSharedRecommendationQueries = false } = {}) {
  const seen = new Map();
  const duplicates = [];
  for (const option of options) {
    const key = normalizeSearchOptionKey(option.query);
    if (!key) continue;
    if (seen.has(key)) {
      const firstLocation = seen.get(key);
      const firstIsDatabasePath = /^(?:Recommended path|Other starting point):/.test(firstLocation);
      const duplicateIsDatabasePath = /^(?:Recommended path|Other starting point):/.test(option.location);
      if (
        allowSharedRecommendationQueries &&
        firstIsDatabasePath &&
        duplicateIsDatabasePath
      ) continue;
      duplicates.push({
        query: option.query,
        firstLocation,
        duplicateLocation: option.location,
      });
    } else {
      seen.set(key, option.location);
    }
  }
  return duplicates;
}

function includesConcept(text, concept) {
  const normalizedText = String(text || "")
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ");
  const normalizedConcept = String(concept || "")
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalizedConcept && normalizedText.includes(normalizedConcept);
}

function criterion(id, label, passed, detail) {
  return { id, label, passed: Boolean(passed), detail };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

export function hashEvaluationPlan(plan) {
  const reviewablePlan = {
    query: plan?.query || "",
    modeId: plan?.modeId || plan?.sourceMode?.id || "",
    subjectFocus: plan?.subjectFocus || null,
    researchSpec: plan?.researchSpec || null,
    sourceMode: plan?.sourceMode || null,
    intents: plan?.intents || [],
    recommendations: (plan?.recommendations || []).map((resource) => ({
      id: resource.id,
      searchTerms: resource.searchTerms || [],
      filters: resource.filters || [],
      capabilities:
        resource.capabilities ||
        resource.sourceCapabilities ||
        resource.sourceKinds ||
        resource.provenance?.sourceKinds ||
        [],
      provenance: resource.provenance || null,
    })),
    searchTerms: plan?.searchTerms || [],
    fallbacks: plan?.fallbacks || [],
    safety: plan?.safety || null,
    safeFailure: plan?.safeFailure || null,
    configVersion: plan?.configVersion || "",
  };
  return createHash("sha256")
    .update(JSON.stringify(stableValue(reviewablePlan)))
    .digest("hex");
}

function hasMetadataObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length);
}

function queryMissingConceptGroups(query, conceptGroups) {
  return conceptGroups.filter(
    (group) => !group.some((concept) => includesConcept(query, concept))
  );
}

function humanReviewState(humanReview = {}) {
  const ratingFields = [
    "pathRelevance",
    "searchTermQuality",
    "catalogPrecision",
    "fallbackSafety",
  ];
  const completed = ratingFields.every((field) => {
    const value = humanReview[field];
    return Number.isFinite(value) && value >= 1 && value <= 5;
  });
  return {
    status: completed ? "human-reviewed" : "pending-human-review",
    approvalStatus: humanReview.approvalStatus || "not-granted",
    completed,
  };
}

export function expandEvaluationMatrix(matrix) {
  const modes = Object.entries(matrix?.modes || {});
  return (matrix?.disciplines || []).flatMap((discipline) =>
    (discipline.prompts || []).flatMap((prompt, paraphraseIndex) =>
      modes.map(([modeId, mode]) => ({
        id: `${discipline.id}--p${paraphraseIndex + 1}--${modeId}`,
        metamorphicGroupId: `${discipline.id}--${modeId}`,
        discipline: discipline.discipline,
        prompt,
        mode: modeId,
        subjectFocusId: discipline.subjectFocusId,
        expected: {
          acceptedResourceIds: discipline.modeResourceIds?.[modeId] || mode.resourceIds || [],
          forbiddenResourceIds: discipline.forbiddenResourceIds?.[modeId] || [],
          expectedSubjectFocusIds: discipline.expectedFocusIds || [],
          minRecommendations: 1,
          maxRecommendations: 6,
          minVisibleSearchOptions: 5,
          requiredConceptGroups: discipline.requiredConceptGroups || [],
          modeResourceIds: discipline.modeResourceIds?.[modeId] || mode.resourceIds || [],
          modeTopN: mode.topN || 3,
          minModeResourcesInTopN: mode.minInTopN || 1,
          modeRequiredKinds: mode.requiredKinds || [],
          requireConceptsInEveryRecommendation: true,
          requireSafetyMetadata: true,
          requireSafeFailureMetadata: true,
          requireProvenance: true,
          requireCapabilities: true,
          requirePlanMetadata: true,
          allowSharedRecommendationQueries: true,
        },
        humanReview: {
          pathRelevance: null,
          searchTermQuality: null,
          catalogPrecision: null,
          fallbackSafety: null,
          notes: "",
          approvalStatus: "not-granted",
        },
      }))
    )
  );
}

export function evaluatePilotCase(
  sample,
  {
    planBuilder = buildResearchPlan,
    institutionProfile = WFU_INSTITUTION_PROFILE,
    configVersion = institutionProfile.profileVersion,
    allowSharedRecommendationQueries = false,
  } = {}
) {
  const expected = sample.expected || {};
  const modeId = sample.mode || expected.modeId || "scholarly";
  const explicitModeExpectation = Boolean(sample.mode || expected.modeId);
  const sharedRecommendationQueries =
    expected.allowSharedRecommendationQueries ?? allowSharedRecommendationQueries;
  const plan = planBuilder(
    sample.prompt,
    expected.requestedLimit || 6,
    sample.subjectFocusId || "auto",
    modeId,
    sample.context || {}
  );
  const recommendationIds = plan.recommendations.map((resource) => resource.id);
  const otherIds = plan.otherStartingPoints.map((resource) => resource.id);
  const allPathIds = [...recommendationIds, ...otherIds];
  const options = visibleSearchOptions(plan);
  const searchableText = options.map((option) => option.query).join("\n");
  const accepted = expected.acceptedResourceIds || [];
  const forbidden = expected.forbiddenResourceIds || [];
  const expectedFocusIds = expected.expectedSubjectFocusIds || [];
  const conceptGroups = expected.requiredConceptGroups || [];
  const missingConceptGroups = conceptGroups.filter(
    (group) => !group.some((concept) => includesConcept(searchableText, concept))
  );
  const naturalLanguageOptions = options.filter((option) =>
    NATURAL_LANGUAGE_QUERY_RE.test(option.query)
  );
  const duplicates = duplicateOptions(options, {
    allowSharedRecommendationQueries: Boolean(sharedRecommendationQueries),
  });
  const genericPaths = allPathIds.filter((id) => GENERIC_RESOURCE_IDS.has(id));
  const substantive = isSubstantiveResearchRequest(sample.prompt);
  const recommendationQueries = plan.recommendations
    .map((resource) => resource.searchTerms?.[0])
    .filter(Boolean);
  const distinctRecommendationQueries = new Set(
    recommendationQueries.map(normalizeSearchOptionKey)
  );
  const actualModeId = plan.modeId || plan.sourceMode?.id || null;
  const modeResourceIds = expected.modeResourceIds || [];
  const modeRequiredKinds = expected.modeRequiredKinds || [];
  const modeTopN = Math.max(1, expected.modeTopN || 3);
  const topModeIds = recommendationIds.slice(0, modeTopN);
  const minimumModeMatches = Math.max(1, expected.minModeResourcesInTopN || 1);
  const resourceSupportsRequiredKind = (resource) => {
    const kinds = resource.sourceKinds || resource.provenance?.sourceKinds || [];
    return modeRequiredKinds.length
      ? kinds.some((kind) => modeRequiredKinds.includes(kind))
      : modeResourceIds.includes(resource.id);
  };
  const modeMatches = (plan.recommendations || []).filter(resourceSupportsRequiredKind);
  const modeMatchesInTop = (plan.recommendations || [])
    .slice(0, modeTopN)
    .filter(resourceSupportsRequiredKind);
  const modeExpectation = modeRequiredKinds.length
    ? `source kinds ${modeRequiredKinds.join(", ")}`
    : `resources ${modeResourceIds.join(", ")}`;
  const perQueryConceptFailures = (plan.recommendations || [])
    .flatMap((resource) =>
      (resource.searchTerms || []).map((query) => ({
        resourceId: resource.id,
        query,
        missing: queryMissingConceptGroups(query, conceptGroups),
      }))
    )
    .filter((item) => item.missing.length);
  const requiresSafetyMetadata = Boolean(expected.requireSafetyMetadata);
  const requiresFailureMetadata = Boolean(expected.requireSafeFailureMetadata);
  const requiresProvenance = Boolean(expected.requireProvenance);
  const requiresCapabilities = Boolean(expected.requireCapabilities);
  const requiresPlanMetadata = Boolean(expected.requirePlanMetadata);
  const missingProvenanceIds = (plan.recommendations || [])
    .filter((resource) => !hasMetadataObject(resource.provenance))
    .map((resource) => resource.id);
  const missingCapabilityIds = (plan.recommendations || [])
    .filter((resource) => {
      const capabilities =
        resource.capabilities ||
        resource.sourceCapabilities ||
        resource.sourceKinds ||
        resource.provenance?.sourceKinds;
      return !Array.isArray(capabilities) || capabilities.length === 0;
    })
    .map((resource) => resource.id);
  const evaluationPlanHash = hashEvaluationPlan(plan);
  const reviewState = humanReviewState(sample.humanReview);

  const checks = [
    criterion(
      "mode-propagation",
      "Requested source mode reaches the plan",
      !explicitModeExpectation || actualModeId === modeId,
      `Requested: ${modeId}; received: ${actualModeId || "not reported"}.`
    ),
    criterion(
      "accepted-path",
      "At least one appropriate named database",
      accepted.length === 0 || accepted.some((id) => recommendationIds.includes(id)),
      accepted.length
        ? `Expected one of: ${accepted.join(", ")}; received: ${recommendationIds.join(", ") || "none"}`
        : "No path expectation set."
    ),
    criterion(
      "forbidden-path",
      "No explicitly unrelated database",
      forbidden.every((id) => !allPathIds.includes(id)),
      forbidden.filter((id) => allPathIds.includes(id)).join(", ") || "None found."
    ),
    criterion(
      "subject-focus",
      "Subject focus is plausible",
      expectedFocusIds.length === 0 || expectedFocusIds.includes(plan.subjectFocus.id),
      `Expected: ${expectedFocusIds.join(", ") || "not set"}; received: ${plan.subjectFocus.id}`
    ),
    criterion(
      "path-count",
      "Path count stays within the expected range",
      recommendationIds.length >= (expected.minRecommendations ?? 1) &&
        recommendationIds.length <= (expected.maxRecommendations ?? 6),
      `Received ${recommendationIds.length}; expected ${expected.minRecommendations ?? 1}-${expected.maxRecommendations ?? 6}.`
    ),
    criterion(
      "executable-path-searches",
      "Every substantive path has an executable search",
      !substantive ||
        (recommendationQueries.length === recommendationIds.length &&
          (sharedRecommendationQueries ||
            distinctRecommendationQueries.size === recommendationQueries.length)),
      `${recommendationQueries.length}/${recommendationIds.length} paths have searches; ${distinctRecommendationQueries.size} are distinct.`
    ),
    criterion(
      "topic-anchors",
      "Visible searches preserve required topic concepts",
      missingConceptGroups.length === 0,
      missingConceptGroups.length
        ? `Missing groups: ${missingConceptGroups
            .map((group) => `[${group.join(" | ")}]`)
            .join(", ")}`
        : "All required concept groups appear."
    ),
    criterion(
      "no-generic-substantive-routes",
      "Substantive recommendations avoid generic navigation pages",
      !substantive || expected.allowGenericNavigation || genericPaths.length === 0,
      genericPaths.join(", ") || "No generic routes shown."
    ),
    criterion(
      "no-natural-language-searches",
      "Search boxes receive keyword/Boolean queries, not prompts",
      naturalLanguageOptions.length === 0,
      naturalLanguageOptions
        .map((option) => `${option.location}: ${option.query}`)
        .join(" | ") || "No natural-language leakage."
    ),
    criterion(
      "no-visible-duplicates",
      "Visible search options are deduplicated",
      duplicates.length === 0,
      duplicates
        .map(
          (item) =>
            `${item.query} (${item.firstLocation} / ${item.duplicateLocation})`
        )
        .join(" | ") || "No normalized duplicates."
    ),
    criterion(
      "enough-search-options",
      "Substantive plans provide enough distinct search moves",
      !substantive || options.length >= (expected.minVisibleSearchOptions ?? 5),
      `Received ${options.length}; expected at least ${expected.minVisibleSearchOptions ?? 5}.`
    ),
    criterion(
      "source-mode-fidelity",
      "At least one recommendation supports the requested source mode",
      (modeResourceIds.length === 0 && modeRequiredKinds.length === 0) || modeMatches.length > 0,
      modeResourceIds.length || modeRequiredKinds.length
        ? `Expected ${modeExpectation}; received ${recommendationIds.join(", ") || "none"}.`
        : "No mode-specific path expectation set."
    ),
    criterion(
      "source-mode-order",
      "A mode-capable path appears high in the recommendation order",
      (modeResourceIds.length === 0 && modeRequiredKinds.length === 0) || modeMatchesInTop.length >= minimumModeMatches,
      modeResourceIds.length || modeRequiredKinds.length
        ? `Expected at least ${minimumModeMatches} paths supporting ${modeExpectation} in the top ${modeTopN}; received ${topModeIds.join(", ") || "none"}.`
        : "No mode-specific path expectation set."
    ),
    criterion(
      "per-query-concept-retention",
      "Every primary path query preserves the required core concepts",
      !expected.requireConceptsInEveryRecommendation || perQueryConceptFailures.length === 0,
      perQueryConceptFailures.length
        ? perQueryConceptFailures
            .map((item) => `${item.resourceId}: missing ${item.missing.map((group) => `[${group.join(" | ")}]`).join(", ")}`)
            .join("; ")
        : "All primary path queries retain the required concepts."
    ),
    criterion(
      "safety-metadata",
      "Safety posture is explicit and machine-readable",
      !requiresSafetyMetadata || hasMetadataObject(plan.safety),
      hasMetadataObject(plan.safety) ? "Safety metadata present." : "Safety metadata absent."
    ),
    criterion(
      "safe-failure-metadata",
      "Safe-failure behavior is explicit and machine-readable",
      !requiresFailureMetadata || hasMetadataObject(plan.safeFailure),
      hasMetadataObject(plan.safeFailure) ? "Safe-failure metadata present." : "Safe-failure metadata absent."
    ),
    criterion(
      "recommendation-provenance",
      "Every primary recommendation identifies its provenance",
      !requiresProvenance || missingProvenanceIds.length === 0,
      missingProvenanceIds.length
        ? `Missing provenance: ${missingProvenanceIds.join(", ")}.`
        : "Every primary recommendation includes provenance."
    ),
    criterion(
      "recommendation-capabilities",
      "Every primary recommendation declares source capabilities",
      !requiresCapabilities || missingCapabilityIds.length === 0,
      missingCapabilityIds.length
        ? `Missing capabilities: ${missingCapabilityIds.join(", ")}.`
        : "Every primary recommendation declares capabilities."
    ),
    criterion(
      "plan-audit-metadata",
      "Plan reports ResearchSpec, source contract, version, and deterministic hash",
      !requiresPlanMetadata || Boolean(
        hasMetadataObject(plan.researchSpec) &&
        hasMetadataObject(plan.sourceMode) &&
        String(plan.configVersion || "").trim() &&
        /^[a-z0-9][a-z0-9._:-]{7,127}$/i.test(String(plan.planHash || ""))
      ),
      `ResearchSpec: ${hasMetadataObject(plan.researchSpec) ? "yes" : "no"}; source contract: ${hasMetadataObject(plan.sourceMode) ? "yes" : "no"}; config version: ${plan.configVersion || "absent"}; runtime plan hash: ${plan.planHash || "absent"}.`
    ),
  ];

  return {
    id: sample.id,
    discipline: sample.discipline,
    prompt: sample.prompt,
    passed: checks.every((check) => check.passed),
    score: checks.filter((check) => check.passed).length / checks.length,
    checks,
    output: {
      modeId: actualModeId,
      subjectFocus: plan.subjectFocus,
      recommendationIds,
      otherStartingPointIds: otherIds,
      visibleSearchOptions: options,
      researchSpec: plan.researchSpec || null,
      sourceMode: plan.sourceMode || null,
      safety: plan.safety || null,
      safeFailure: plan.safeFailure || null,
      configVersion: plan.configVersion || configVersion,
      planHash: plan.planHash || evaluationPlanHash,
      evaluationPlanHash,
    },
    humanReview: sample.humanReview || {},
    reviewState,
  };
}

export function evaluatePilotSet(samples, options = {}) {
  const caseOptions = {
    ...options,
    allowSharedRecommendationQueries:
      options.allowSharedRecommendationQueries ?? true,
  };
  const cases = samples.map((sample) => evaluatePilotCase(sample, caseOptions));
  const checks = cases.flatMap((sample) => sample.checks);
  const passedChecks = checks.filter((check) => check.passed).length;
  const passedCases = cases.filter((sample) => sample.passed).length;
  const completedHumanReviews = cases.filter((sample) => sample.reviewState.completed).length;
  const humanApprovals = cases.filter(
    (sample) => sample.reviewState.completed && sample.reviewState.approvalStatus === "approved"
  ).length;
  const configVersions = [...new Set(
    cases.map((sample) => sample.output.configVersion).filter(Boolean)
  )].sort();
  return {
    generatedAt: new Date().toISOString(),
    evidenceType: "automated-regression",
    configVersion: configVersions.length === 1
      ? configVersions[0]
      : configVersions.length > 1
        ? "mixed"
        : options.configVersion ||
          options.institutionProfile?.profileVersion ||
          WFU_INSTITUTION_PROFILE.profileVersion,
    configVersions,
    summary: {
      cases: cases.length,
      passedCases,
      failedCases: cases.length - passedCases,
      casePassRate: cases.length ? passedCases / cases.length : 0,
      automatedChecks: checks.length,
      passedChecks,
      checkPassRate: checks.length ? passedChecks / checks.length : 0,
      pendingHumanReviews: cases.length - completedHumanReviews,
      completedHumanReviews,
      humanApprovals,
      automationStatus: passedCases === cases.length ? "automated-checks-pass" : "automated-review-required",
      humanApprovalStatus:
        humanApprovals === cases.length && cases.length > 0
          ? "human-approved"
          : "not-human-approved",
    },
    cases,
  };
}

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function cell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function renderPilotEvaluationMarkdown(report) {
  const lines = [
    "# Librarian Evaluation Baseline",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "> This is an automated regression baseline, not librarian approval. Human ratings remain intentionally blank until ZSR staff review the outputs.",
    "",
    "## Summary",
    "",
    `- Cases passing every automated check: ${report.summary.passedCases}/${report.summary.cases} (${percent(report.summary.casePassRate)})`,
    `- Individual automated checks passing: ${report.summary.passedChecks}/${report.summary.automatedChecks} (${percent(report.summary.checkPassRate)})`,
    `- Cases awaiting human review: ${report.summary.pendingHumanReviews}/${report.summary.cases}`,
    `- Automated status: ${report.summary.automationStatus}`,
    `- Human approval status: ${report.summary.humanApprovalStatus}`,
    `- Configuration version: ${report.configVersion}`,
    "",
    "## Case Results",
    "",
    "| Status | Discipline | Mode | Prompt | Focus | Recommended paths | Plan hash | Failed checks |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const sample of report.cases) {
    const failures = sample.checks
      .filter((check) => !check.passed)
      .map((check) => check.label)
      .join("; ");
    lines.push(
      `| ${sample.passed ? "PASS" : "REVIEW"} | ${cell(sample.discipline)} | ${cell(sample.output.modeId || "not reported")} | ${cell(sample.prompt)} | ${cell(sample.output.subjectFocus.label)} | ${cell(sample.output.recommendationIds.join(", "))} | ${cell(sample.output.planHash.slice(0, 12))} | ${cell(failures || "None")} |`
    );
  }

  lines.push("", "## Detailed Failures", "");
  const failed = report.cases.filter((sample) => !sample.passed);
  if (!failed.length) {
    lines.push("No automated failures.");
  } else {
    for (const sample of failed) {
      lines.push(`### ${sample.id}: ${sample.prompt}`, "");
      for (const check of sample.checks.filter((item) => !item.passed)) {
        lines.push(`- **${check.label}:** ${check.detail}`);
      }
      lines.push("");
    }
  }

  lines.push(
    "## Human Review Rubric",
    "",
    "For every case, a librarian should score each field from 1 (unsafe/unhelpful) to 5 (excellent), then add notes:",
    "",
    "- `pathRelevance`: Are the named databases appropriate and sufficiently specific?",
    "- `searchTermQuality`: Are the queries executable, anchored, and varied?",
    "- `catalogPrecision`: Are returned source leads topically precise enough to show?",
    "- `fallbackSafety`: Do recovery suggestions improve the search without over-broadening?",
    "- `notes`: Corrections, missing resources, or wording changes.",
    "",
    "A strong query may be reused in multiple compatible databases. Duplicate suppression applies within a card and across generic/fallback moves; variation is not required when it would weaken concept retention.",
    ""
  );

  return `${lines.join("\n")}\n`;
}
