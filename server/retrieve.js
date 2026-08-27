import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DEFAULT_MODE_ID } from "../config/libraryLinks.js";
import { DEFAULT_SUBJECT_FOCUS_ID } from "../config/subjectFocus.js";
import { ZSR_RESOURCE_CONFIG, buildResearchPlan, isZsrNavigationRequest } from "../config/researchAgent.js";
import { canonicalResourceId } from "../config/resourceCapabilities.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESOURCES_PATH = join(__dirname, "resources.json");

let cache = null;

/**
 * Load navigation utilities and search-tool links (cached after first read).
 * Topic database routes come from the shared research-agent config below.
 */
export async function loadResources() {
  if (cache) return cache;
  const raw = await readFile(RESOURCES_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  const supplemental = (parsed.resources ?? []).map((resource) => ({
    ...resource,
    id: canonicalResourceId(resource.id),
  }));
  const supplementalById = new Map(supplemental.map((resource) => [resource.id, resource]));
  const governed = ZSR_RESOURCE_CONFIG.map((resource) => {
    const extra = supplementalById.get(resource.id) || {};
    supplementalById.delete(resource.id);
    return {
      ...extra,
      id: resource.id,
      name: resource.name,
      type: resource.id === "primo" ? "catalog" : resource.subjectArea,
      url: resource.accessUrl,
      description: resource.description,
      best_for: [resource.bestFor].filter(Boolean),
      tags: resource.tags || [],
      keywords: resource.tags || [],
      access: resource.notes,
      sourceKinds: resource.sourceKinds || [],
      queryDialect: resource.queryDialect,
      maintenanceOwner: resource.maintenanceOwner,
      reviewStatus: resource.reviewStatus,
      configReviewedOn: resource.configReviewedOn,
      librarianReviewedOn: resource.librarianReviewedOn,
      configVersion: resource.configVersion,
    };
  });
  cache = [...governed, ...supplementalById.values()];
  return cache;
}

/** Curated resources that can run a query search ({q} template). Always available. */
export async function getSearchTools() {
  const all = await loadResources();
  return all
    .filter((r) => r.search_url_template)
    .map((r) => ({ id: r.id, name: r.name, search_url_template: r.search_url_template }));
}

const GENERIC_NAVIGATION_IDS = new Set([
  "zsr-homepage",
  "databases-az",
  "research-guides",
  "ask-a-librarian",
  "business-guide",
]);

function promptResource(resource) {
  return {
    id: resource.id,
    name: resource.name,
    type: resource.id === "primo" ? "catalog" : "database",
    url: resource.accessUrl,
    description: resource.description,
    best_for: [resource.bestFor].filter(Boolean),
    tags: resource.tags || [],
    keywords: resource.tags || [],
    access: resource.notes || "Confirm current access through ZSR.",
    paywalled: resource.id !== "pubmed-medline",
    recommended_query: resource.searchTerms?.[0] || "",
    recommended_filters: resource.filters || [],
    why: resource.whyFits || "",
    expect: resource.expect || "",
    sourceKinds: resource.sourceKinds || [],
    queryDialect: resource.queryDialect || "keyword",
    notBestFor: resource.notBestFor || "",
    maintenanceOwner: resource.maintenanceOwner,
    reviewStatus: resource.reviewStatus,
    configReviewedOn: resource.configReviewedOn,
    librarianReviewedOn: resource.librarianReviewedOn,
    configVersion: resource.configVersion,
    provenance: resource.provenance || null,
    queryValidation: resource.queryValidation || null,
  };
}

function isCitationUtilityRequest(query) {
  const value = String(query || "");
  return /\b(citat|cite|apa|mla|chicago|bibliograph|zotero)\b/i.test(value) &&
    !/\b(research|study|sources?|articles?|books?|topic)\b/i.test(value);
}

/**
 * Retrieve the named databases selected by the deterministic research router.
 * Generic navigation pages are reserved for explicit navigation/citation tasks;
 * they are never used to pad a substantive topic recommendation.
 */
export async function retrieveResources(
  query,
  limit = 6,
  modeId = DEFAULT_MODE_ID,
  subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID,
  requestContext = {}
) {
  const all = await loadResources();
  const resources = all.filter((r) => !r.search_tool_only);
  if (isZsrNavigationRequest(query)) {
    const navigationOrder = ["zsr-homepage", "databases-az", "research-guides", "ask-a-librarian"];
    return navigationOrder
      .map((id) => resources.find((resource) => resource.id === id))
      .filter(Boolean)
      .slice(0, Math.max(0, limit));
  }

  if (isCitationUtilityRequest(query)) {
    return ["citation-zotero", "research-guides"]
      .map((id) => resources.find((resource) => resource.id === id))
      .filter(Boolean)
      .slice(0, Math.max(0, limit));
  }

  const plan = buildResearchPlan(query, limit, subjectFocusId, modeId, requestContext);
  return plan.recommendations
    .filter((resource) => !GENERIC_NAVIGATION_IDS.has(resource.id))
    .map(promptResource)
    .slice(0, Math.max(0, limit));
}

export async function retrieveResearchContext(
  query,
  limit = 6,
  modeId = DEFAULT_MODE_ID,
  subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID,
  requestContext = {}
) {
  const plan = buildResearchPlan(query, limit, subjectFocusId, modeId, requestContext);
  if (plan.navigationOnly || isCitationUtilityRequest(query)) {
    return {
      plan,
      resources: await retrieveResources(query, limit, modeId, subjectFocusId, requestContext),
    };
  }
  const resources = plan.recommendations
    .filter((resource) => !GENERIC_NAVIGATION_IDS.has(resource.id))
    .map(promptResource)
    .slice(0, Math.max(0, limit));
  return { plan, resources };
}
