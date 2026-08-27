/**
 * Governed librarian directory records used by deterministic handoff routing.
 *
 * The Wake Forest entries below were checked against public ZSR directory and
 * research-session pages on 2026-08-27. `public-source-checked` means only that
 * the prototype maintainer checked those public pages. It does not mean that a
 * librarian or Wake Forest approved the record or the navigator.
 */

export const LIBRARIAN_DIRECTORY_SCHEMA_VERSION = "1.0.0";

export const LIBRARIAN_REVIEW_STATUSES = Object.freeze([
  "public-source-checked",
  "librarian-approved",
  "pending-review",
  "retired",
]);

const ROUTABLE_REVIEW_STATUSES = new Set(["public-source-checked", "librarian-approved"]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

const WFU_PUBLIC_DIRECTORY_GOVERNANCE = {
  institutionId: "wfu-zsr-prototype",
  effectiveDate: "2026-08-27",
  lastReviewedDate: "2026-08-27",
  nextReviewDate: "2027-02-27",
  owner: "prototype-maintainer",
  reviewStatus: "public-source-checked",
  librarianApproved: false,
  status: "active",
  sourceUrl: "https://zsr.wfu.edu/research/librarians/",
};

export const WFU_LIBRARIAN_DIRECTORY = deepFreeze([
  {
    ...WFU_PUBLIC_DIRECTORY_GOVERNANCE,
    id: "kathy-shields",
    kind: "person",
    personName: "Kathy Shields",
    title: "Head of Research and Liaison Services",
    unit: "Research, Instruction, & Outreach",
    subjectTags: [
      "psychology",
      "history",
      "american history",
      "world history",
      "anthropology",
      "area studies",
      "law",
      "neuroscience",
      "social sciences",
    ],
    subjectPatterns: [
      "\\bpsycholog(?:y|ical)\\b|mental health|anxiety|depression|trauma|ptsd",
      "\\bhistor(?:y|ical|iography)\\b|american history|world history|medieval|jazz|cultural identity",
      "anthropolog|african studies|east asian|latin american|middle east|russian",
    ],
    modes: ["scholarly", "books", "primary", "legal", "general"],
    routeIds: ["psychology-social-sciences", "history-humanities"],
    profileUrl: "https://zsr.wfu.edu/directory/kathy-shields/",
    email: "shielddk@wfu.edu",
    appointmentUrl: "https://wfu.libcal.com/appointment/17180",
    genericFallback: false,
  },
  {
    ...WFU_PUBLIC_DIRECTORY_GOVERNANCE,
    id: "meghan-webb",
    kind: "person",
    personName: "Meghan Webb",
    title: "Social Sciences Librarian",
    unit: "Research, Instruction, & Outreach",
    subjectTags: [
      "communication",
      "journalism",
      "sociology",
      "environment and sustainability studies",
      "environmental science",
      "social sciences",
    ],
    subjectPatterns: [
      "communication|social media|instagram|tiktok|snapchat|digital culture",
      "journalism|news coverage|news framing|misinformation|disinformation",
      "sociolog|environment(?:al)?|sustainability",
    ],
    modes: ["scholarly", "news", "books", "general"],
    routeIds: ["communication-media"],
    profileUrl: "https://zsr.wfu.edu/directory/meghan-webb/",
    email: "webbmm@wfu.edu",
    appointmentUrl: "https://wfu.libcal.com/appointment/15579",
    genericFallback: false,
  },
  {
    ...WFU_PUBLIC_DIRECTORY_GOVERNANCE,
    id: "colleen-foy",
    kind: "person",
    personName: "Colleen Foy",
    title: "STEM Librarian",
    unit: "Research, Instruction, & Outreach",
    subjectTags: [
      "biology",
      "chemistry",
      "health sciences and medicine",
      "neuroscience",
      "physics",
      "environmental science",
      "stem",
    ],
    subjectPatterns: [
      "health|clinical|medicine|medical|pubmed|medline|therapy|diagnosis|symptom",
      "biolog|chemistr|neuroscience|physics|stem|environmental science",
    ],
    modes: ["scholarly", "data", "books", "general"],
    routeIds: ["health-sciences"],
    profileUrl: "https://zsr.wfu.edu/directory/colleen-foy/",
    email: "foyc@wfu.edu",
    appointmentUrl: "https://wfu.libcal.com/appointment/103618",
    genericFallback: false,
  },
  {
    ...WFU_PUBLIC_DIRECTORY_GOVERNANCE,
    id: "joddy-marchesoni",
    kind: "person",
    personName: "Joddy Marchesoni",
    title: "Data Services Librarian",
    unit: "Digital Initiatives & Scholarly Communication",
    subjectTags: ["data services", "mathematics", "statistics"],
    subjectPatterns: [
      "data|statistics?|dataset|survey|prevalence|trend|poll|icpsr|statista",
      "mathematics|quantitative|variables?|sample size|methodology",
    ],
    modes: ["data", "scholarly", "general"],
    routeIds: ["data-statistics"],
    profileUrl: "https://zsr.wfu.edu/directory/joddy-marchesoni/",
    email: "marchej@wfu.edu",
    appointmentUrl: "https://wfu.libcal.com/appointment/156403",
    genericFallback: false,
  },
  {
    ...WFU_PUBLIC_DIRECTORY_GOVERNANCE,
    id: "ask-zsr",
    kind: "service",
    personName: null,
    title: "Ask ZSR general research help",
    unit: "Research consultations",
    subjectTags: [],
    subjectPatterns: [],
    modes: [],
    routeIds: ["ask-zsr"],
    profileUrl: "https://zsr.wfu.edu/ask/",
    email: "askzsr@wfu.edu",
    appointmentUrl: "https://wfu.libcal.com/appointments/?g=519&lid=1229&nprf=1",
    genericFallback: true,
  },
]);

export const LIBRARIAN_DIRECTORIES = deepFreeze({
  "wfu-zsr-prototype": WFU_LIBRARIAN_DIRECTORY,
});

function requiredString(errors, value, path) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${path} must be a non-empty string.`);
}

function validHttpsUrl(errors, value, path) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") errors.push(`${path} must use HTTPS.`);
  } catch {
    errors.push(`${path} must be a valid HTTPS URL.`);
  }
}

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

function normalizedAsOf(asOf) {
  const parsed = asOf instanceof Date ? new Date(asOf) : new Date(asOf || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function validateLibrarianRecord(record, { asOf = new Date() } = {}) {
  const errors = [];
  const warnings = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { valid: false, active: false, eligibleForNamedRouting: false, errors: ["Record must be an object."], warnings };
  }

  requiredString(errors, record.id, "id");
  requiredString(errors, record.institutionId, "institutionId");
  requiredString(errors, record.title, "title");
  requiredString(errors, record.unit, "unit");
  requiredString(errors, record.owner, "owner");
  requiredString(errors, record.reviewStatus, "reviewStatus");
  requiredString(errors, record.status, "status");
  requiredString(errors, record.email, "email");
  requiredString(errors, record.sourceUrl, "sourceUrl");

  if (!['person', 'service'].includes(record.kind)) errors.push("kind must be person or service.");
  if (!LIBRARIAN_REVIEW_STATUSES.includes(record.reviewStatus)) errors.push("reviewStatus is not recognized.");
  if (!['active', 'inactive'].includes(record.status)) errors.push("status must be active or inactive.");
  if (typeof record.librarianApproved !== "boolean") errors.push("librarianApproved must be a boolean.");
  if (record.librarianApproved && record.reviewStatus !== "librarian-approved") {
    errors.push("librarianApproved may be true only when reviewStatus is librarian-approved.");
  }
  if (record.reviewStatus === "public-source-checked" && record.librarianApproved) {
    errors.push("A public-source-checked record cannot claim librarian approval.");
  }

  const arrayFields = ["subjectTags", "subjectPatterns", "modes", "routeIds"];
  for (const field of arrayFields) {
    if (!Array.isArray(record[field]) || record[field].some((item) => typeof item !== "string")) {
      errors.push(`${field} must be an array of strings.`);
    }
  }

  for (const [index, pattern] of (record.subjectPatterns || []).entries()) {
    try {
      new RegExp(pattern, "i");
    } catch {
      errors.push(`subjectPatterns[${index}] must be a valid regular expression.`);
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(record.email || ""))) errors.push("email must be valid.");
  validHttpsUrl(errors, record.profileUrl, "profileUrl");
  validHttpsUrl(errors, record.appointmentUrl, "appointmentUrl");
  validHttpsUrl(errors, record.sourceUrl, "sourceUrl");

  const effectiveDate = parseDateOnly(record.effectiveDate);
  const lastReviewedDate = parseDateOnly(record.lastReviewedDate);
  const nextReviewDate = parseDateOnly(record.nextReviewDate);
  if (!effectiveDate) errors.push("effectiveDate must be a valid YYYY-MM-DD date.");
  if (!lastReviewedDate) errors.push("lastReviewedDate must be a valid YYYY-MM-DD date.");
  if (!nextReviewDate) errors.push("nextReviewDate must be a valid YYYY-MM-DD date.");
  if (effectiveDate && nextReviewDate && effectiveDate > nextReviewDate) {
    errors.push("effectiveDate must not be after nextReviewDate.");
  }
  if (lastReviewedDate && nextReviewDate && lastReviewedDate > nextReviewDate) {
    errors.push("lastReviewedDate must not be after nextReviewDate.");
  }

  if (record.kind === "person") {
    requiredString(errors, record.personName, "personName");
    if (record.genericFallback) errors.push("A person record cannot be the generic fallback.");
  } else if (record.personName != null) {
    errors.push("A service record must not claim a personName.");
  }
  if (typeof record.genericFallback !== "boolean") errors.push("genericFallback must be a boolean.");

  const reviewInstant = normalizedAsOf(asOf);
  const reviewDay = new Date(Date.UTC(
    reviewInstant.getUTCFullYear(),
    reviewInstant.getUTCMonth(),
    reviewInstant.getUTCDate()
  ));
  const withinDates = Boolean(effectiveDate && nextReviewDate && effectiveDate <= reviewDay && reviewDay <= nextReviewDate);
  const active = errors.length === 0
    && record.status === "active"
    && withinDates
    && ROUTABLE_REVIEW_STATUSES.has(record.reviewStatus);

  if (!withinDates && effectiveDate && nextReviewDate) warnings.push("Record is not within its effective review window.");
  if (!ROUTABLE_REVIEW_STATUSES.has(record.reviewStatus)) warnings.push("Record is not in a routable review state.");
  if (record.reviewStatus === "public-source-checked" && !record.librarianApproved) {
    warnings.push("Public directory data has not been marked as librarian-approved.");
  }

  return {
    valid: errors.length === 0,
    active,
    eligibleForNamedRouting: active && record.kind === "person" && !record.genericFallback,
    errors,
    warnings,
  };
}

export function validateLibrarianDirectory(records, options = {}) {
  const entries = Array.isArray(records) ? records : [];
  const results = entries.map((record) => ({
    id: record?.id || null,
    ...validateLibrarianRecord(record, options),
  }));
  const ids = new Set();
  const duplicateIds = [];
  for (const record of entries) {
    if (!record?.id) continue;
    if (ids.has(record.id)) duplicateIds.push(record.id);
    ids.add(record.id);
  }
  const fallbackCount = entries.filter((record) => record?.genericFallback).length;
  return {
    valid: results.every((result) => result.valid) && duplicateIds.length === 0 && fallbackCount === 1,
    results,
    duplicateIds,
    fallbackCount,
  };
}

export function getActiveLibrarianRecords({
  institutionId = "wfu-zsr-prototype",
  records = LIBRARIAN_DIRECTORIES[institutionId] || [],
  asOf = new Date(),
  includeServices = true,
} = {}) {
  return records.filter((record) => {
    if (record?.institutionId !== institutionId) return false;
    const validation = validateLibrarianRecord(record, { asOf });
    return validation.active && (includeServices || validation.eligibleForNamedRouting);
  });
}
