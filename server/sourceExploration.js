import { extractDoiIdentifier } from "../config/sourceIdentifiers.js";
import { rankSourceResults } from "./sourceRelevance.js";
import { fetchDiscoveryJson } from "./discoveryOutcome.js";
import { getOpenAlexStatus } from "./openalex.js";
import { exploreCrossrefSources } from "./crossrefExploration.js";

const ORIGIN = "https://api.openalex.org";
const MAX_CANDIDATES = 30;
const clean = (value, max = 500) => String(value || "").replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const workId = (value) => clean(value).match(/^(?:https:\/\/openalex\.org\/)?(W\d+)$/i)?.[1]?.toUpperCase() || "";
const titleKey = (value) => clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const safeUrl = (value) => { try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.toString() : ""; } catch { return ""; } };

// Preserve ordered provider words without filling gaps in a quoted abstract.
function abstractText(work) {
  const index = work?.abstract_inverted_index;
  if (!index || typeof index !== "object" || Array.isArray(index)) return "";
  const words = [];
  for (const [word, positions] of Object.entries(index).slice(0, 2000)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions.slice(0, 2048)) {
      if (!Number.isInteger(position) || position < 0 || position >= 2048) continue;
      if (words[position] && words[position] !== clean(word, 100)) return "";
      words[position] = clean(word, 100);
    }
  }
  const contiguous = [];
  for (let i = 0; i < words.length && words[i]; i++) contiguous.push(words[i]);
  return clean(contiguous.join(" "), 20000);
}

function mapWork(work, relationship, seedId, retrievedAt) {
  const id = workId(work?.id);
  const title = clean(work?.display_name || work?.title);
  if (!id || !title || work.is_retracted === true || id === seedId) return null;
  const doi = extractDoiIdentifier(clean(work.doi, 350));
  const authors = (Array.isArray(work.authorships) ? work.authorships : []).slice(0, 20).map((entry) => clean(entry?.author?.display_name, 120)).filter(Boolean);
  const location = [work.best_oa_location, work.primary_location, ...(Array.isArray(work.locations) ? work.locations.slice(0, 10) : [])]
    .find((entry) => entry?.is_oa === true && (safeUrl(entry.landing_page_url) || safeUrl(entry.pdf_url)));
  const openAccess = work.open_access?.is_oa === true && Boolean(location);
  const url = openAccess ? safeUrl(location.landing_page_url) || safeUrl(location.pdf_url) : doi ? `https://doi.org/${encodeURIComponent(doi)}` : `https://openalex.org/${id}`;
  const abstract = abstractText(work);
  const type = clean(work.type_crossref || work.type, 80).replace(/[_-]/g, " ");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(work.publication_date || "") ? work.publication_date : Number.isInteger(work.publication_year) ? String(work.publication_year) : "";
  const relationLabel = relationship === "references" ? "Referenced by your selected source" : relationship === "citing" ? "Cites your selected source" : "Algorithmically related in OpenAlex";
  return {
    title, authors, author: authors.slice(0, 2).join("; "), type, date, doi, url,
    containerTitle: clean(work.primary_location?.source?.display_name, 180),
    sourceProvider: "OpenAlex citation exploration", peerReviewed: null, summaryEligible: false,
    accessScope: openAccess ? "open-access" : "library", abstractText: abstract,
    abstractExcerpt: abstract.length > 360 ? `${abstract.slice(0, 357)}…` : abstract,
    abstractSource: abstract ? "OpenAlex provider abstract metadata" : "",
    subjects: (Array.isArray(work.keywords) ? work.keywords : []).slice(0, 12).map((item) => clean(item?.display_name, 100)).filter(Boolean),
    description: `${relationLabel}. Relationship reported by OpenAlex; this does not establish agreement, quality, or support for a claim.`,
    detailPoints: [`${relationLabel} (${seedId}).`, "Citation coverage can be incomplete. Read the original source to confirm the relationship and findings."],
    citation: { title, authors, doi, openAlexId: `https://openalex.org/${id}`, type, year: work.publication_year || null, publicationDate: date },
    ...(openAccess ? { openAccess: { isOpenAccess: true, landingPageUrl: safeUrl(location.landing_page_url), pdfUrl: safeUrl(location.pdf_url), license: clean(location.license, 80), version: clean(location.version, 80) } } : {}),
    provenance: { provider: "OpenAlex", metadataOnly: true, accessVerified: false, metadataLicense: "CC0" },
    exploration: { relationship, label: relationLabel, seedId: `https://openalex.org/${seedId}`, provider: "OpenAlex", retrievedAt, citationRelationship: relationship !== "similar" },
  };
}

/** Two bounded registry requests, no model calls, arbitrary URLs, or full-text downloads.
 * The route must apply the app's existing authentication, body limit, and rate limit.
 * researchSpec must be the server-normalized reviewed spec, including assignment requirements.
 */
export async function exploreSources({ seed = {}, relationship = "similar", researchSpec = {}, limit = 5, accessScope = "both" } = {}, options = {}) {
  const retrievedAt = new Date().toISOString();
  const requestedRelationship = ["similar", "references", "citing"].includes(relationship) ? relationship : "similar";
  const coverage = { provider: "OpenAlex", relationship: requestedRelationship, retrievedAt, retrievedCount: 0, eligibleCount: 0, excludedCount: 0, candidateLimit: MAX_CANDIDATES, exhaustive: false, constraintsPreserved: true, knownItemIdentityReplacedBySeed: Boolean(researchSpec.knownItem), accessScope };
  const answer = (status, message, extra = {}) => ({ status, message, relationship: requestedRelationship, results: [], coverage, ...extra });
  if ([seed.identityCheck?.status, seed.identityCheck?.observedStatus].includes("title-difference")) return answer("identity_mismatch", "This source has a DOI/title discrepancy. Verify its identity before following its citation connections.");
  const doi = extractDoiIdentifier(clean(seed.doi, 350));
  const id = workId(seed.openAlexId || seed.citation?.openAlexId);
  coverage.queries = [];
  if (!getOpenAlexStatus(options).enabled && options.crossrefFallback !== false) return exploreCrossrefSources({ seed, relationship: requestedRelationship, researchSpec, limit, accessScope }, options);
  if (!doi && !id) return answer("unsupported", "No DOI or OpenAlex identifier is available for this source. Search its title in Google Scholar to explore related work.");
  if (!getOpenAlexStatus(options).enabled) return answer("unavailable", "Citation exploration is unavailable because OpenAlex is not configured. You can still search this title in Google Scholar.");
  const apiKey = clean(Object.hasOwn(options, "apiKey") ? options.apiKey : process.env.OPENALEX_API_KEY, 500);
  const deadline = Date.now() + Math.min(9000, Math.max(1, Number(options.timeoutMs) || 9000));
  const request = async (path, query = {}) => {
    const timeoutMs = deadline - Date.now();
    if (timeoutMs <= 0) throw new DOMException("Exploration deadline exceeded", "TimeoutError");
    const url = new URL(path, ORIGIN);
    url.search = new URLSearchParams({ ...query, api_key: apiKey }).toString();
    const result = await fetchDiscoveryJson(url.toString(), { headers: { Accept: "application/json" }, redirect: "error" }, { fetchImpl: options.fetchImpl, signal: options.signal, timeoutMs, retries: 0 });
    if (!result.response.ok) { const error = new Error("Registry request failed"); error.status = result.response.status; throw error; }
    return result.data;
  };
  try {
    // Use only a validated identifier on a constant host; never follow provider URLs.
    coverage.seedQuery = { query: doi ? `https://doi.org/${doi}` : id, provider: "OpenAlex", dialect: "identifier lookup" };
    const seedWork = await request(`/works/${doi ? encodeURIComponent(`https://doi.org/${doi}`) : id}`);
    const seedId = workId(seedWork?.id);
    if (!seedId) return answer("unavailable", "OpenAlex did not return an identifiable record for this source.");
    if ((doi && extractDoiIdentifier(seedWork.doi).toLowerCase() !== doi.toLowerCase()) || (id && !doi && id !== seedId)
      || (seed.title && titleKey(seed.title) !== titleKey(seedWork.display_name || seedWork.title))) {
      return answer("identity_mismatch", "The selected source and OpenAlex record do not have matching identifiers and title. Verify the original record before exploring connections.");
    }
    if (seedWork.is_retracted === true) return answer("retracted", "OpenAlex marks this source as retracted. Check the publisher record before using it.");
    const connections = requestedRelationship === "references" ? seedWork.referenced_works : seedWork.related_works;
    const relatedIds = [...new Set((Array.isArray(connections) ? connections : []).slice(0, 10000).map(workId).filter(Boolean))].filter((value) => value !== seedId);
    if (requestedRelationship !== "citing" && !relatedIds.length) return answer("empty", "OpenAlex supplied no indexed connections of this type. This does not mean no related research exists.");
    const sampledIds = relatedIds.slice(0, MAX_CANDIDATES);
    const filter = requestedRelationship === "citing" ? `cites:${seedId}` : `openalex:${sampledIds.join("|")}`;
    const executedFilter = `${filter},is_retracted:false${accessScope === "open-access" ? ",is_oa:true" : ""}`;
    coverage.query = executedFilter;
    coverage.queries.push({ query: executedFilter, provider: "OpenAlex", dialect: "OpenAlex filter", limit: MAX_CANDIDATES, ...(requestedRelationship === "citing" ? { sort: "publication_date:desc" } : {}) });
    const response = await request("/works", { filter: executedFilter, "per-page": String(MAX_CANDIDATES), ...(requestedRelationship === "citing" ? { sort: "publication_date:desc" } : {}) });
    const works = Array.isArray(response?.results) ? response.results.slice(0, MAX_CANDIDATES) : [];
    coverage.retrievedCount = works.length;
    coverage.indexedConnectionCount = requestedRelationship === "citing" ? Number.isInteger(response?.meta?.count) ? response.meta.count : null : relatedIds.length;
    coverage.sampled = requestedRelationship === "citing" ? "Most recent page of citing works" : "First indexed connections";
    // A response is not sufficient to invent a link: check the actual IDs or
    // reference list even when the remote endpoint was asked to apply a filter.
    const candidates = works.filter((work) => requestedRelationship === "citing"
      ? Array.isArray(work.referenced_works) && work.referenced_works.some((value) => workId(value) === seedId)
      : sampledIds.includes(workId(work.id)))
      .map((work) => mapWork(work, requestedRelationship, seedId, retrievedAt)).filter(Boolean)
      .filter((source) => accessScope !== "open-access" || source.accessScope === "open-access");
    const { knownItem, ...explorationSpec } = researchSpec;
    // A known-item title describes the seed, not a topic that related works must
    // repeat. Other requested concepts and every assignment facet stay intact.
    if (knownItem) explorationSpec.concepts = (explorationSpec.concepts || []).filter((concept) => titleKey(concept.preferredTerm) !== titleKey(knownItem.title) && titleKey(concept.preferredTerm) !== titleKey(knownItem.author));
    const ranked = rankSourceResults(candidates, explorationSpec, MAX_CANDIDATES);
    coverage.eligibleCount = ranked.length;
    coverage.excludedCount = works.length - ranked.length;
    const results = ranked.slice(0, Math.min(10, Math.max(1, Number.parseInt(limit, 10) || 5)));
    return answer(results.length ? "success" : "empty", results.length
      ? "Connections are reported by OpenAlex and screened against your current research requirements. A citation is not an endorsement; metadata fit still needs checking."
      : "No retrieved connections passed the current topic and assignment checks. Requirements were kept; the index and sampled connections are incomplete.", { results, seed: { title: clean(seedWork.display_name || seedWork.title), openAlexId: `https://openalex.org/${seedId}` } });
  } catch (error) {
    if (options.signal?.aborted) return answer("cancelled", "Citation exploration was cancelled.");
    if (error?.name === "TimeoutError") return answer("timeout", "OpenAlex did not respond in time. Try again; no conclusions can be drawn from this attempt.");
    if (error?.status === 404) return answer("not_found", "This identifier was not found in OpenAlex. This does not establish whether the source exists elsewhere.");
    if (error?.status === 429) return answer("rate_limited", "OpenAlex is temporarily limiting requests. Try again later.");
    return answer("unavailable", "Citation exploration could not complete. Try again or search the title directly.");
  }
}
