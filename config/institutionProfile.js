/**
 * Institution-specific values that may be swapped without changing the routing
 * engine. Profiles describe configuration and governance; they do not grant
 * access to any institutional system.
 */

export const INSTITUTION_PROFILE_SCHEMA_VERSION = "1.0.0";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

export const WFU_INSTITUTION_PROFILE = deepFreeze({
  schemaVersion: INSTITUTION_PROFILE_SCHEMA_VERSION,
  id: "wfu-zsr-prototype",
  profileVersion: "2026.08.10-pilot.1",
  institutionName: "Wake Forest University",
  libraryName: "Z. Smith Reynolds Library",
  approval: {
    status: "prototype",
    approvedForInstitutionalUse: false,
    reviewedBy: [],
    note: "Local prototype defaults. Resource records still require librarian and institutional review.",
  },
  branding: {
    productName: "ZSR Library AI Research Navigator",
    shortName: "Research Navigator",
    logoUrl: null,
    primaryColor: null,
    accessibilityOwner: null,
  },
  discovery: {
    provider: "primo-public-web",
    liveEnabledDefault: true,
    host: "https://wfu.primo.exlibrisgroup.com",
    institutionCode: "01WAKE_INST",
    viewId: "01WAKE_INST:ZSR",
    catalogScope: "ZSR",
    catalogTab: "LibraryCatalog",
    articleScope: "CentralIndex",
    articleTab: "Articles",
    officialApi: {
      configured: false,
      endpointEnv: "PRIMO_API_ENDPOINT",
      keyEnv: "PRIMO_API_KEY",
    },
  },
  resourceRegistry: {
    kind: "local-module",
    pointer: "config/researchAgent.js#ZSR_RESOURCE_CONFIG",
    approvalStatus: "pending-librarian-review",
    owner: null,
  },
  helpRoutes: {
    askUrl: "https://zsr.wfu.edu/ask/",
    interlibraryLoanUrl: "https://zsr.wfu.edu/delivers/ill/",
    generalEmail: "askzsr@wfu.edu",
    ticketingIntegration: null,
  },
  citationRoutes: {
    generalGuideUrl: "https://zsr.wfu.edu/research/guides/citation/",
    zoteroUrl: "https://zsr.wfu.edu/research-instruction/zotero-research-assistant/",
    styleGuideUrls: {},
  },
  fullText: {
    integration: "link-guidance-only",
    libKeyLibraryIdEnv: "VITE_WFU_LIBKEY_LIBRARY_ID",
    libKeyLibraryIdConfigured: false,
    deliversUrl: "https://zsr.wfu.edu/delivers/ill/",
  },
  privacy: {
    authentication: "none",
    workspaceStorage: "browser-localStorage",
    queryLoggingDefault: false,
    queryTextStorageDefault: false,
    feedbackLoggingDefault: true,
    feedbackTextStorageDefault: false,
    feedbackTopicStorageDefault: false,
    handoffLoggingDefault: true,
    handoffDetailStorageDefault: false,
    handoffContactRetentionDefault: false,
    queryLoggingEnv: "LOG_QUERIES",
    queryTextStorageEnv: "LOG_QUERY_TEXT",
    feedbackLoggingEnv: "LOG_FEEDBACK",
    feedbackTextStorageEnv: "FEEDBACK_STORE_TEXT",
    feedbackTopicStorageEnv: "FEEDBACK_STORE_TOPIC",
    handoffLoggingEnv: "LOG_HANDOFFS",
    handoffDetailStorageEnv: "HANDOFF_STORE_DETAIL",
    handoffContactRetentionEnv: "HANDOFF_STORE_CONTACT",
    retentionDaysDefault: 30,
    maxRecordsDefault: 1000,
    adminReadAuthorization: "deployment-bearer-token",
    rawQueryTelemetryAllowed: false,
    sensitiveDataNoticeRequired: true,
  },
});

/**
 * Deliberately blank integration template. The institution and library names
 * are labels for discussion only. No Duke resource, endpoint, credential,
 * contact, logo, color, or policy has been assumed or approved.
 */
export const DUKE_ILLUSTRATIVE_PROFILE = deepFreeze({
  schemaVersion: INSTITUTION_PROFILE_SCHEMA_VERSION,
  id: "duke-illustrative-unapproved",
  profileVersion: "unapproved-template-1",
  institutionName: "Duke University",
  libraryName: "Duke University Libraries",
  approval: {
    status: "unapproved-template",
    approvedForInstitutionalUse: false,
    reviewedBy: [],
    note: "Illustrative blank template. Duke staff must supply and approve every operational value before use.",
  },
  branding: {
    productName: null,
    shortName: null,
    logoUrl: null,
    primaryColor: null,
    accessibilityOwner: null,
  },
  discovery: {
    provider: null,
    liveEnabledDefault: false,
    host: null,
    institutionCode: null,
    viewId: null,
    catalogScope: null,
    catalogTab: null,
    articleScope: null,
    articleTab: null,
    officialApi: {
      configured: false,
      endpointEnv: null,
      keyEnv: null,
    },
  },
  resourceRegistry: {
    kind: null,
    pointer: null,
    approvalStatus: "unapproved",
    owner: null,
  },
  helpRoutes: {
    askUrl: null,
    interlibraryLoanUrl: null,
    generalEmail: null,
    ticketingIntegration: null,
  },
  citationRoutes: {
    generalGuideUrl: null,
    zoteroUrl: null,
    styleGuideUrls: {},
  },
  fullText: {
    integration: null,
    libKeyLibraryIdEnv: null,
    libKeyLibraryIdConfigured: false,
    deliversUrl: null,
  },
  privacy: {
    authentication: "none-specified",
    workspaceStorage: null,
    queryLoggingDefault: false,
    queryTextStorageDefault: false,
    feedbackLoggingDefault: false,
    feedbackTextStorageDefault: false,
    feedbackTopicStorageDefault: false,
    handoffLoggingDefault: false,
    handoffDetailStorageDefault: false,
    handoffContactRetentionDefault: false,
    queryLoggingEnv: null,
    queryTextStorageEnv: null,
    feedbackLoggingEnv: null,
    feedbackTextStorageEnv: null,
    feedbackTopicStorageEnv: null,
    handoffLoggingEnv: null,
    handoffDetailStorageEnv: null,
    handoffContactRetentionEnv: null,
    retentionDaysDefault: null,
    maxRecordsDefault: null,
    adminReadAuthorization: null,
    rawQueryTelemetryAllowed: false,
    sensitiveDataNoticeRequired: true,
  },
});

export const INSTITUTION_PROFILES = deepFreeze({
  [WFU_INSTITUTION_PROFILE.id]: WFU_INSTITUTION_PROFILE,
  [DUKE_ILLUSTRATIVE_PROFILE.id]: DUKE_ILLUSTRATIVE_PROFILE,
});

function requiredString(errors, value, path) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${path} must be a non-empty string.`);
}

function nullableUrl(errors, value, path) {
  if (value == null) return;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") errors.push(`${path} must use HTTPS.`);
  } catch {
    errors.push(`${path} must be null or a valid URL.`);
  }
}

export function validateInstitutionProfile(profile, { requireApproved = false } = {}) {
  const errors = [];
  const warnings = [];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return { valid: false, errors: ["Profile must be an object."], warnings };
  }

  requiredString(errors, profile.schemaVersion, "schemaVersion");
  if (profile.schemaVersion !== INSTITUTION_PROFILE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${INSTITUTION_PROFILE_SCHEMA_VERSION}.`);
  }
  requiredString(errors, profile.id, "id");
  requiredString(errors, profile.profileVersion, "profileVersion");
  requiredString(errors, profile.institutionName, "institutionName");
  requiredString(errors, profile.libraryName, "libraryName");

  if (!profile.approval || typeof profile.approval !== "object") {
    errors.push("approval must be an object.");
  } else {
    requiredString(errors, profile.approval.status, "approval.status");
    if (typeof profile.approval.approvedForInstitutionalUse !== "boolean") {
      errors.push("approval.approvedForInstitutionalUse must be boolean.");
    }
  }

  for (const section of [
    "branding",
    "discovery",
    "resourceRegistry",
    "helpRoutes",
    "citationRoutes",
    "fullText",
    "privacy",
  ]) {
    if (!profile[section] || typeof profile[section] !== "object" || Array.isArray(profile[section])) {
      errors.push(`${section} must be an object.`);
    }
  }

  for (const [path, value] of [
    ["discovery.host", profile.discovery?.host],
    ["helpRoutes.askUrl", profile.helpRoutes?.askUrl],
    ["helpRoutes.interlibraryLoanUrl", profile.helpRoutes?.interlibraryLoanUrl],
    ["citationRoutes.generalGuideUrl", profile.citationRoutes?.generalGuideUrl],
    ["citationRoutes.zoteroUrl", profile.citationRoutes?.zoteroUrl],
    ["fullText.deliversUrl", profile.fullText?.deliversUrl],
    ["branding.logoUrl", profile.branding?.logoUrl],
  ]) nullableUrl(errors, value, path);

  for (const [path, value] of [
    ["privacy.queryLoggingDefault", profile.privacy?.queryLoggingDefault],
    ["privacy.queryTextStorageDefault", profile.privacy?.queryTextStorageDefault],
    ["privacy.feedbackLoggingDefault", profile.privacy?.feedbackLoggingDefault],
    ["privacy.feedbackTextStorageDefault", profile.privacy?.feedbackTextStorageDefault],
    ["privacy.feedbackTopicStorageDefault", profile.privacy?.feedbackTopicStorageDefault],
    ["privacy.handoffLoggingDefault", profile.privacy?.handoffLoggingDefault],
    ["privacy.handoffDetailStorageDefault", profile.privacy?.handoffDetailStorageDefault],
    ["privacy.handoffContactRetentionDefault", profile.privacy?.handoffContactRetentionDefault],
    ["privacy.rawQueryTelemetryAllowed", profile.privacy?.rawQueryTelemetryAllowed],
  ]) {
    if (typeof value !== "boolean") errors.push(`${path} must be boolean.`);
  }

  if (!profile.approval?.approvedForInstitutionalUse) {
    warnings.push("Profile is not approved for institutional use.");
    if (requireApproved) errors.push("An approved institution profile is required.");
  } else if (!Array.isArray(profile.approval.reviewedBy) || profile.approval.reviewedBy.length === 0) {
    warnings.push("Approved profile has no named review owner.");
    if (requireApproved) errors.push("An approved profile must identify at least one review owner.");
  }
  if (!profile.resourceRegistry?.pointer) warnings.push("No approved resource registry is configured.");
  if (!profile.discovery?.host) warnings.push("No discovery host is configured.");

  return { valid: errors.length === 0, errors, warnings };
}

export function getInstitutionProfile(profileId = WFU_INSTITUTION_PROFILE.id) {
  return INSTITUTION_PROFILES[profileId] || null;
}
