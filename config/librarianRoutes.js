import { LIBRARY_LINKS } from "./libraryLinks.js";
import {
  WFU_LIBRARIAN_DIRECTORY,
  getActiveLibrarianRecords,
  validateLibrarianRecord,
} from "./librarianDirectory.js";

const ROUTES = [
  {
    id: "history-humanities",
    label: "History / Humanities librarian",
    unit: "Subject research support",
    href: LIBRARY_LINKS.zsrAsk,
    patterns: [/history|historical|historiography|medieval|middle ages|archives?|primary sources?|manuscripts?|literature|humanities|jazz|cultural identity/i],
    modes: ["scholarly", "books", "primary", "general"],
    reason: "Best fit for historical context, humanities scholarship, books, and primary-source research strategy.",
  },
  {
    id: "psychology-social-sciences",
    label: "Psychology / Social Sciences librarian",
    unit: "Subject research support",
    href: LIBRARY_LINKS.zsrAsk,
    patterns: [/psych/i, /ptsd|trauma|mental health|anxiety|depression|adolescent|teen|youth/i],
    modes: ["scholarly", "general"],
    reason: "Best fit for behavioral-health, adolescent-development, and social-science research questions.",
  },
  {
    id: "communication-media",
    label: "Communication / Media Studies librarian",
    unit: "Subject research support",
    href: LIBRARY_LINKS.zsrAsk,
    patterns: [/communication|media|television|tv|film|news|social media|instagram|tiktok|snapchat/i],
    modes: ["scholarly", "news", "general"],
    reason: "Useful when the research scope is media effects, representation, platforms, audiences, or journalism.",
  },
  {
    id: "health-sciences",
    label: "Health Sciences research support",
    unit: "Database and evidence support",
    href: LIBRARY_LINKS.zsrAsk,
    patterns: [/health|clinical|medicine|medical|pubmed|medline|therapy|diagnosis|symptom/i],
    modes: ["scholarly", "data"],
    reason: "Good route for PubMed/MEDLINE searches, clinical terms, evidence filters, and health outcomes.",
  },
  {
    id: "data-statistics",
    label: "Data and Statistics support",
    unit: "Data research support",
    href: LIBRARY_LINKS.zsrAsk,
    patterns: [/data|statistics|survey|dataset|prevalence|trend|poll|icpsr|statista/i],
    modes: ["data"],
    reason: "Best when the student needs datasets, statistics, survey instruments, or trend evidence.",
  },
  {
    id: "primary-special-collections",
    label: "Special Collections & Archives",
    unit: "Primary-source support",
    href: "https://zsr.wfu.edu/special/",
    patterns: [/archive|archival|primary source|manuscript|letters|photographs|oral history|special collections/i],
    modes: ["primary"],
    reason: "Best for original materials, archives, campus history, rare books, and primary-source strategy.",
  },
  {
    id: "citation-zotero",
    label: "Citation and Zotero help",
    unit: "Research services",
    href: LIBRARY_LINKS.zsrCitationGuide,
    patterns: [/citation|cite|apa|mla|chicago|zotero|bibliography|works cited/i],
    modes: [],
    reason: "Useful when the main blocker is citation style, source management, or bibliography cleanup.",
  },
  {
    id: "ask-zsr",
    label: "Ask ZSR general research help",
    unit: "Research consultations",
    href: LIBRARY_LINKS.zsrAsk,
    patterns: [],
    modes: [],
    reason: "Fallback route when the topic spans multiple departments or the best subject owner is unclear.",
  },
];

function routeScore(route, text, modeId, matchedResources = []) {
  let topicalScore = 0;
  for (const pattern of route.patterns) {
    if (pattern.test(text)) topicalScore += 3;
  }
  for (const resource of matchedResources) {
    const haystack = `${resource?.name || ""} ${resource?.description || ""} ${(resource?.tags || []).join(" ")}`;
    for (const pattern of route.patterns) {
      if (pattern.test(haystack)) topicalScore += 1;
    }
  }
  return topicalScore > 0 ? topicalScore + (route.modes.includes(modeId) ? 2 : 0) : 0;
}

function directoryScore(record, text, modeId, matchedResources = []) {
  let topicalScore = 0;
  for (const patternText of record.subjectPatterns || []) {
    const pattern = new RegExp(patternText, "i");
    if (pattern.test(text)) topicalScore += 4;
    for (const resource of matchedResources) {
      const haystack = `${resource?.name || ""} ${resource?.description || ""} ${(resource?.tags || []).join(" ")}`;
      if (pattern.test(haystack)) topicalScore += 1;
    }
  }
  for (const tag of record.subjectTags || []) {
    if (tag && text.includes(String(tag).toLowerCase())) topicalScore += 2;
  }
  return topicalScore > 0 ? topicalScore + (record.modes?.includes(modeId) ? 1 : 0) : 0;
}

function namedRoute(route, record) {
  return {
    id: record.id,
    routeId: route.id,
    label: record.personName,
    unit: record.title,
    href: record.appointmentUrl,
    reason: `${route.reason} Contact information is sourced from ZSR's public directory and has not been marked as librarian-approved for this prototype.`,
    institutionId: record.institutionId,
    personName: record.personName,
    title: record.title,
    profileUrl: record.profileUrl,
    email: record.email,
    appointmentUrl: record.appointmentUrl,
    reviewStatus: record.reviewStatus,
    librarianApproved: record.librarianApproved,
    lastReviewedDate: record.lastReviewedDate,
    nextReviewDate: record.nextReviewDate,
    sourceUrl: record.sourceUrl,
    directoryRecordId: record.id,
  };
}

function fallbackRouteFromDirectory(record) {
  if (!record) return ROUTES.find((route) => route.id === "ask-zsr");
  return {
    id: "ask-zsr",
    label: record.title,
    unit: record.unit,
    href: record.profileUrl || LIBRARY_LINKS.zsrAsk,
    reason: "Fallback route when the topic spans multiple departments or the best subject owner is unclear.",
    institutionId: record.institutionId,
    email: record.email,
    appointmentUrl: record.appointmentUrl,
    reviewStatus: record.reviewStatus,
    librarianApproved: record.librarianApproved,
    lastReviewedDate: record.lastReviewedDate,
    nextReviewDate: record.nextReviewDate,
    sourceUrl: record.sourceUrl,
    directoryRecordId: record.id,
  };
}

function selectNamedRecord(route, activeNamedRecords, text, modeId, matchedResources) {
  return activeNamedRecords
    .filter((record) => record.routeIds.includes(route.id))
    .map((record) => ({
      record,
      score: directoryScore(record, text, modeId, matchedResources),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.record.personName.localeCompare(b.record.personName))[0]?.record || null;
}

/**
 * Deterministic routing only. No model or network request participates.
 * The optional fourth argument exists for institution adapters and tests; the
 * original three-argument call and output fields remain supported.
 */
export function recommendLibrarianRoutes(
  topic,
  modeId = "scholarly",
  matchedResources = [],
  {
    institutionId = "wfu-zsr-prototype",
    directory = WFU_LIBRARIAN_DIRECTORY,
    asOf = new Date(),
  } = {}
) {
  const text = String(topic || "").toLowerCase();
  const ranked = ROUTES
    .map((route) => ({ ...route, score: routeScore(route, text, modeId, matchedResources) }))
    .sort((a, b) => b.score - a.score || ROUTES.findIndex((item) => item.id === a.id) - ROUTES.findIndex((item) => item.id === b.id));

  const activeRecords = getActiveLibrarianRecords({ institutionId, records: directory, asOf });
  const activeNamedRecords = activeRecords.filter((record) => validateLibrarianRecord(record, { asOf }).eligibleForNamedRouting);
  const genericFallback = activeRecords.find((record) => record.genericFallback);

  const selected = [];
  const selectedRouteOwners = new Set();
  for (const route of ranked.filter((candidate) => candidate.id !== "ask-zsr" && candidate.score > 0)) {
    const named = selectNamedRecord(route, activeNamedRecords, text, modeId, matchedResources);
    const candidate = named
      ? namedRoute(route, named)
      : (({ score, patterns, modes, ...genericRoute }) => genericRoute)(route);
    const ownerKey = String(candidate.directoryRecordId || candidate.id || candidate.label || "").toLowerCase();
    if (!ownerKey || selectedRouteOwners.has(ownerKey)) continue;
    selectedRouteOwners.add(ownerKey);
    selected.push(candidate);
    if (selected.length >= 2) break;
  }

  selected.push(fallbackRouteFromDirectory(genericFallback));
  return selected.filter(Boolean).slice(0, 3);
}
