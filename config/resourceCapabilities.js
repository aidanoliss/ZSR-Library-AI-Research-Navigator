/**
 * Librarian-governed capability metadata for every substantive research route.
 *
 * Topic relevance and source type are intentionally separate. A database can be
 * excellent for a discipline while still being the wrong place for the source
 * type the student selected. These declarations are the authoritative source
 * for source-mode eligibility, query dialects, and provenance shown in the UI.
 */

export const RESOURCE_CONFIG_VERSION = "2026-08-10.2";

export const SOURCE_KINDS = Object.freeze({
  SCHOLARLY_ARTICLE: "scholarly-article",
  BOOK: "book",
  BOOK_CHAPTER: "book-chapter",
  NEWS: "news",
  DATASET: "dataset",
  STATISTICS: "statistics",
  PRIMARY_SOURCE: "primary-source",
  ARCHIVAL: "archival-material",
  LEGAL_PRIMARY: "legal-primary",
  LEGAL_SECONDARY: "legal-secondary",
  MARKET_REPORT: "market-report",
  CATALOG_RECORD: "catalog-record",
  BACKGROUND: "background",
});

export const SOURCE_MODE_CONTRACTS = Object.freeze({
  scholarly: {
    id: "scholarly",
    label: "Scholarly articles",
    requiredKinds: [SOURCE_KINDS.SCHOLARLY_ARTICLE],
    allowedKinds: [SOURCE_KINDS.SCHOLARLY_ARTICLE, SOURCE_KINDS.BOOK_CHAPTER],
    excludedKinds: [SOURCE_KINDS.NEWS, SOURCE_KINDS.MARKET_REPORT],
    preferredResourceIds: [
      "psycinfo", "pubmed-medline", "econlit", "eric", "communication-mass-media",
      "web-of-science", "socindex", "historical-abstracts", "proquest-political-science",
    ],
  },
  books: {
    id: "books",
    label: "Books and background",
    requiredKinds: [SOURCE_KINDS.BOOK, SOURCE_KINDS.CATALOG_RECORD],
    allowedKinds: [
      SOURCE_KINDS.BOOK,
      SOURCE_KINDS.BOOK_CHAPTER,
      SOURCE_KINDS.CATALOG_RECORD,
      SOURCE_KINDS.BACKGROUND,
    ],
    excludedKinds: [SOURCE_KINDS.NEWS, SOURCE_KINDS.DATASET],
    preferredResourceIds: ["primo", "project-muse", "jstor", "historical-abstracts", "econlit"],
    mustLeadWith: "primo",
  },
  news: {
    id: "news",
    label: "News and current events",
    requiredKinds: [SOURCE_KINDS.NEWS],
    allowedKinds: [SOURCE_KINDS.NEWS, SOURCE_KINDS.BACKGROUND],
    excludedKinds: [SOURCE_KINDS.SCHOLARLY_ARTICLE, SOURCE_KINDS.DATASET],
    preferredResourceIds: ["factiva", "proquest-news", "cq-researcher", "proquest-research-library"],
  },
  data: {
    id: "data",
    label: "Data and statistics",
    requiredKinds: [SOURCE_KINDS.DATASET, SOURCE_KINDS.STATISTICS],
    allowedKinds: [SOURCE_KINDS.DATASET, SOURCE_KINDS.STATISTICS, SOURCE_KINDS.MARKET_REPORT],
    excludedKinds: [SOURCE_KINDS.NEWS, SOURCE_KINDS.BOOK],
    preferredResourceIds: ["icpsr", "statista", "mergent", "mintel"],
  },
  primary: {
    id: "primary",
    label: "Primary sources",
    requiredKinds: [SOURCE_KINDS.PRIMARY_SOURCE, SOURCE_KINDS.ARCHIVAL, SOURCE_KINDS.LEGAL_PRIMARY],
    allowedKinds: [
      SOURCE_KINDS.PRIMARY_SOURCE,
      SOURCE_KINDS.ARCHIVAL,
      SOURCE_KINDS.LEGAL_PRIMARY,
      SOURCE_KINDS.NEWS,
      SOURCE_KINDS.CATALOG_RECORD,
    ],
    excludedKinds: [SOURCE_KINDS.SCHOLARLY_ARTICLE, SOURCE_KINDS.MARKET_REPORT],
    preferredResourceIds: ["special-collections", "digital-collections", "proquest-news", "heinonline", "primo"],
  },
  "legal-policy": {
    id: "legal-policy",
    label: "Legal and policy sources",
    requiredKinds: [SOURCE_KINDS.LEGAL_PRIMARY, SOURCE_KINDS.LEGAL_SECONDARY],
    allowedKinds: [
      SOURCE_KINDS.LEGAL_PRIMARY,
      SOURCE_KINDS.LEGAL_SECONDARY,
      SOURCE_KINDS.BACKGROUND,
      SOURCE_KINDS.SCHOLARLY_ARTICLE,
    ],
    excludedKinds: [SOURCE_KINDS.MARKET_REPORT],
    preferredResourceIds: ["heinonline", "cq-researcher", "proquest-political-science", "socindex"],
  },
});

const C = SOURCE_KINDS;

export const RESOURCE_CAPABILITIES = Object.freeze({
  "academic-search-premier": { sourceKinds: [C.SCHOLARLY_ARTICLE], queryDialect: "ebsco", filters: ["peer-reviewed", "subject", "date"] },
  "proquest-research-library": { sourceKinds: [C.SCHOLARLY_ARTICLE, C.NEWS], queryDialect: "proquest", filters: ["source-type", "subject", "date"] },
  econlit: { sourceKinds: [C.SCHOLARLY_ARTICLE, C.BOOK, C.BOOK_CHAPTER], queryDialect: "ebsco", filters: ["publication-type", "subject", "date"] },
  psycinfo: { sourceKinds: [C.SCHOLARLY_ARTICLE], queryDialect: "ebsco", filters: ["peer-reviewed", "population", "methodology", "date"] },
  "communication-mass-media": { sourceKinds: [C.SCHOLARLY_ARTICLE], queryDialect: "ebsco", filters: ["peer-reviewed", "subject", "date"] },
  "pubmed-medline": { sourceKinds: [C.SCHOLARLY_ARTICLE], queryDialect: "pubmed", filters: ["article-type", "mesh", "population", "date"] },
  "web-of-science": { sourceKinds: [C.SCHOLARLY_ARTICLE], queryDialect: "web-of-science", filters: ["document-type", "research-area", "date"] },
  "science-direct": { sourceKinds: [C.SCHOLARLY_ARTICLE, C.BOOK_CHAPTER], queryDialect: "science-direct", filters: ["content-type", "subject", "date"] },
  socindex: { sourceKinds: [C.SCHOLARLY_ARTICLE], queryDialect: "ebsco", filters: ["peer-reviewed", "population", "subject", "date"] },
  eric: { sourceKinds: [C.SCHOLARLY_ARTICLE, C.PRIMARY_SOURCE], queryDialect: "eric", filters: ["publication-type", "education-level", "peer-reviewed", "date"] },
  "education-source": { sourceKinds: [C.SCHOLARLY_ARTICLE], queryDialect: "ebsco", filters: ["peer-reviewed", "education-level", "subject", "date"] },
  mintel: { sourceKinds: [C.MARKET_REPORT, C.STATISTICS], queryDialect: "market-report", filters: ["sector", "geography", "date"] },
  "business-source": { sourceKinds: [C.SCHOLARLY_ARTICLE, C.NEWS, C.MARKET_REPORT], queryDialect: "ebsco", filters: ["source-type", "industry", "date"] },
  mergent: { sourceKinds: [C.DATASET, C.STATISTICS, C.MARKET_REPORT], queryDialect: "company-data", filters: ["company", "industry", "period"] },
  statista: { sourceKinds: [C.STATISTICS, C.MARKET_REPORT], queryDialect: "statistics", filters: ["geography", "industry", "date", "original-source"] },
  icpsr: { sourceKinds: [C.DATASET, C.STATISTICS], queryDialect: "dataset", filters: ["geography", "time-period", "unit-of-analysis", "study-type"] },
  factiva: { sourceKinds: [C.NEWS], queryDialect: "factiva", filters: ["source", "region", "date", "content-type"] },
  "proquest-news": { sourceKinds: [C.NEWS, C.PRIMARY_SOURCE], queryDialect: "proquest-news", filters: ["publication", "location", "date", "document-type"] },
  jstor: { sourceKinds: [C.SCHOLARLY_ARTICLE, C.BOOK, C.BOOK_CHAPTER], queryDialect: "jstor", filters: ["content-type", "discipline", "date", "language"] },
  "historical-abstracts": { sourceKinds: [C.SCHOLARLY_ARTICLE, C.BOOK], queryDialect: "ebsco", filters: ["document-type", "geography", "historical-period", "subject"] },
  "project-muse": { sourceKinds: [C.SCHOLARLY_ARTICLE, C.BOOK, C.BOOK_CHAPTER], queryDialect: "project-muse", filters: ["content-type", "research-area", "date"] },
  "proquest-political-science": { sourceKinds: [C.SCHOLARLY_ARTICLE, C.NEWS, C.LEGAL_SECONDARY], queryDialect: "proquest", filters: ["source-type", "location", "date"] },
  "cq-researcher": { sourceKinds: [C.BACKGROUND, C.LEGAL_SECONDARY, C.NEWS], queryDialect: "keyword", filters: ["topic", "issue-date", "section"] },
  heinonline: { sourceKinds: [C.LEGAL_PRIMARY, C.LEGAL_SECONDARY, C.SCHOLARLY_ARTICLE, C.PRIMARY_SOURCE], queryDialect: "heinonline", filters: ["collection", "jurisdiction", "document-type", "date"] },
  primo: { sourceKinds: [C.BOOK, C.CATALOG_RECORD, C.SCHOLARLY_ARTICLE, C.PRIMARY_SOURCE], queryDialect: "primo", filters: ["resource-type", "subject", "date", "availability"] },
  "special-collections": { sourceKinds: [C.PRIMARY_SOURCE, C.ARCHIVAL, C.BOOK], queryDialect: "finding-aid", filters: ["collection", "date", "creator", "format"] },
  "digital-collections": { sourceKinds: [C.PRIMARY_SOURCE, C.ARCHIVAL], queryDialect: "digital-collections", filters: ["collection", "date", "format", "subject"] },
  "databases-az": { sourceKinds: [], queryDialect: "navigation", filters: [] },
  "ask-a-librarian": { sourceKinds: [], queryDialect: "help", filters: [] },
  "research-guides": { sourceKinds: [], queryDialect: "navigation", filters: [] },
  "business-guide": { sourceKinds: [], queryDialect: "navigation", filters: [] },
});

export const RESOURCE_ID_ALIASES = Object.freeze({
  "communication-mass-media-complete": "communication-mass-media",
  "zsr-discovery": "primo",
  "ask-a-librarian": "ask-a-librarian",
});

export function canonicalResourceId(id) {
  const value = String(id || "").trim();
  return RESOURCE_ID_ALIASES[value] || value;
}

export function getSourceModeContract(modeId) {
  return SOURCE_MODE_CONTRACTS[modeId] || SOURCE_MODE_CONTRACTS.scholarly;
}

export function getResourceCapability(resourceOrId) {
  const id = canonicalResourceId(typeof resourceOrId === "string" ? resourceOrId : resourceOrId?.id);
  return RESOURCE_CAPABILITIES[id] || { sourceKinds: [], queryDialect: "keyword", filters: [] };
}

export function resourceSupportsMode(resourceOrId, modeId) {
  const capability = getResourceCapability(resourceOrId);
  const contract = getSourceModeContract(modeId);
  return capability.sourceKinds.some((kind) => contract.allowedKinds.includes(kind));
}

export function modeCompatibilityScore(resourceOrId, modeId) {
  const capability = getResourceCapability(resourceOrId);
  const contract = getSourceModeContract(modeId);
  const required = capability.sourceKinds.filter((kind) => contract.requiredKinds.includes(kind)).length;
  const allowed = capability.sourceKinds.filter((kind) => contract.allowedKinds.includes(kind)).length;
  const preferredIndex = contract.preferredResourceIds.indexOf(canonicalResourceId(
    typeof resourceOrId === "string" ? resourceOrId : resourceOrId?.id
  ));
  return required * 80 + allowed * 20 + (preferredIndex >= 0 ? Math.max(5, 35 - preferredIndex * 5) : 0);
}

export function withResourceCapabilities(resource) {
  const capability = getResourceCapability(resource);
  return {
    ...resource,
    sourceKinds: [...capability.sourceKinds],
    queryDialect: capability.queryDialect,
    capabilityFilters: [...capability.filters],
    configVersion: RESOURCE_CONFIG_VERSION,
  };
}
