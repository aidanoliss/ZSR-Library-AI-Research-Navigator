import { extractDoiIdentifier } from "../config/sourceIdentifiers.js";
import { fetchDiscoveryJson } from "./discoveryOutcome.js";
import { rankSourceResults } from "./sourceRelevance.js";

const ORIGIN = "https://api.crossref.org";
const clean = (value, max = 500) => String(value || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const titleKey = (value) => clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const first = (value) => Array.isArray(value) ? value[0] : value;
const doiOf = (value) => extractDoiIdentifier(clean(value, 350)).toLowerCase();
const retracted = (record) => record?.is_retracted === true || /^(?:retraction|withdrawal)$/i.test(record?.subtype || "") || (Array.isArray(record?.["update-to"]) && record["update-to"].some((update) => /retract|withdraw/i.test(update?.type || "")));

function mapRecord(record, relationship, seed, retrievedAt) {
  const doi = doiOf(record?.DOI);
  const title = clean(first(record?.title));
  if (!doi || !title || doi === doiOf(seed.doi) || titleKey(title) === titleKey(seed.title) || retracted(record)) return null;
  const authors = (Array.isArray(record.author) ? record.author : []).slice(0, 20).map((author) => clean(author.name || [author.given, author.family].filter(Boolean).join(" "), 120)).filter(Boolean);
  const dateParts = record.published?.["date-parts"]?.[0] || record.issued?.["date-parts"]?.[0] || [];
  const date = dateParts.slice(0, 3).filter(Number.isInteger).map((part, index) => index ? String(part).padStart(2, "0") : String(part)).join("-");
  const abstract = clean(record.abstract, 20000);
  const url = `https://doi.org/${encodeURIComponent(doi)}`;
  const type = clean(record.type, 80).replace(/-/g, " ");
  const label = relationship === "references" ? "Referenced by your selected source · Crossref metadata" : "Related search result · no citation relationship established";
  return {
    title, doi, url, authors, author: authors.slice(0, 2).join("; "), type, date,
    containerTitle: clean(first(record["container-title"]), 180), publisher: clean(record.publisher, 180),
    isbn: clean(first(record.ISBN), 80), issn: clean(first(record.ISSN), 80), volume: clean(record.volume, 40), issue: clean(record.issue, 40), pages: clean(record.page, 80),
    sourceProvider: "Crossref source exploration", accessScope: "library", peerReviewed: null, summaryEligible: false,
    abstractText: abstract, abstractExcerpt: abstract.length > 360 ? `${abstract.slice(0, 357)}…` : abstract, abstractSource: abstract ? "Crossref provider abstract metadata" : "",
    subjects: (Array.isArray(record.subject) ? record.subject : []).slice(0, 12).map((term) => clean(term, 100)).filter(Boolean),
    description: `${label}. Open the source to confirm relevance and access. A reference is not an endorsement or evidence for a claim.`,
    detailPoints: [label, "Crossref metadata does not establish full-text access or complete citation coverage."],
    citation: { title, authors, doi, type, year: Number.isInteger(dateParts[0]) ? dateParts[0] : null, publicationDate: date },
    provenance: { provider: "Crossref", metadataOnly: true, accessVerified: false },
    exploration: { relationship, label, seedId: doiOf(seed.doi) ? `https://doi.org/${doiOf(seed.doi)}` : "", provider: "Crossref", retrievedAt, citationRelationship: relationship === "references" },
  };
}

/** Public Crossref metadata only. References come from actual DOI links in the
 * seed's deposited reference array. Bibliographic search never implies citation.
 * https://www.crossref.org/documentation/retrieve-metadata/rest-api/
 */
export async function exploreCrossrefSources({ seed = {}, relationship = "similar", researchSpec = {}, limit = 5, accessScope = "both" } = {}, options = {}) {
  const retrievedAt = new Date().toISOString();
  const candidateLimit = relationship === "references" ? 8 : 30;
  const coverage = { provider: "Crossref", relationship, retrievedAt, retrievedCount: 0, eligibleCount: 0, excludedCount: 0, candidateLimit, exhaustive: false, constraintsPreserved: true, knownItemIdentityReplacedBySeed: Boolean(researchSpec.knownItem), accessScope, queries: [] };
  const answer = (status, message, extra = {}) => ({ status, message, relationship, results: [], coverage, ...extra });
  if ([seed.identityCheck?.status, seed.identityCheck?.observedStatus].includes("title-difference")) return answer("identity_mismatch", "This source has a DOI/title discrepancy. Verify its identity before exploring connections.");
  if (relationship === "citing") return answer("unavailable", "Incoming citation lookup needs an indexed citation provider, which is not configured. Crossref's public metadata does not provide a complete citing-works list. Use Google Scholar's Cited by link after locating this title.");
  if (accessScope === "open-access") return answer("unsupported", "Crossref cannot establish open-access locations for these connections. Your open-access requirement was kept. Choose Library + open access in search settings to include leads whose access needs checking.");
  const seedDoi = doiOf(seed.doi);
  if (!seedDoi && relationship === "references") return answer("unsupported", "A DOI is needed to read this source's deposited references. Try Related works or search the title in Google Scholar.");
  if (!seedDoi && !clean(seed.title)) return answer("unsupported", "A source title or DOI is needed to explore related work.");
  const deadline = Date.now() + Math.min(9000, Math.max(1, Number(options.timeoutMs) || 9000));
  const request = async (path, params) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new DOMException("Crossref deadline exceeded", "TimeoutError");
    const url = new URL(path, ORIGIN);
    if (params) url.search = new URLSearchParams(params).toString();
    const { response, data } = await fetchDiscoveryJson(url.toString(), { headers: { Accept: "application/json", "User-Agent": "ZSR-Research-Navigator/1.1 (public metadata exploration)" }, redirect: "error" }, { fetchImpl: options.fetchImpl, signal: options.signal, timeoutMs: Math.min(remaining, relationship === "references" ? 4500 : remaining), retries: 0 });
    if (!response.ok) { const error = new Error("Crossref request failed"); error.status = response.status; throw error; }
    if (!data?.message || typeof data.message !== "object") throw new Error("Invalid registry response");
    return data.message;
  };
  try {
    let seedRecord = null;
    if (seedDoi) {
      coverage.seedQuery = { query: seedDoi, provider: "Crossref", dialect: "DOI lookup" };
      try {
        seedRecord = await request(`/works/${encodeURIComponent(seedDoi)}`);
        coverage.seedLookupStatus = "found";
      } catch (error) {
        // Another DOI agency may hold this work. A title search is still a
        // useful discovery action, but never evidence of a resolved seed or
        // citation relationship. Only a definitive 404 permits this fallback.
        if (error?.status !== 404 || relationship !== "similar" || !clean(seed.title)) throw error;
        coverage.seedLookupStatus = "not_found";
      }
      if (seedRecord && (doiOf(seedRecord.DOI) !== seedDoi || (seed.title && titleKey(first(seedRecord.title)) !== titleKey(seed.title)))) return answer("identity_mismatch", "The source title or DOI differs from Crossref's registry record. Verify the original source before exploring its connections.");
      if (seedRecord && retracted(seedRecord)) return answer("retracted", "Crossref reports a retraction or withdrawal notice for this record. Check the publisher before using it.");
    }
    const resolvedSeed = { ...seed, title: clean(first(seedRecord?.title) || seed.title), doi: seedDoi };
    let records = [];
    let failedLookups = 0;
    let lookupError;
    if (relationship === "references") {
      const references = [...new Set((Array.isArray(seedRecord?.reference) ? seedRecord.reference : []).slice(0, 10000).map((reference) => doiOf(reference?.DOI)).filter((doi) => doi && doi !== seedDoi))];
      coverage.indexedConnectionCount = references.length;
      coverage.sampled = "First deposited references with DOIs; references without identifiers were not resolved";
      if (!references.length) return answer("empty", "Crossref supplied no DOI-linked references for this source. Deposits can omit references; this does not mean the source has no references.");
      let next = 0;
      const selected = references.slice(0, candidateLimit);
      const worker = async () => {
        while (next < selected.length && !options.signal?.aborted && Date.now() < deadline) {
          const doi = selected[next++];
          coverage.queries.push({ query: doi, provider: "Crossref", dialect: "Referenced DOI lookup", limit: 1 });
          try { const record = await request(`/works/${encodeURIComponent(doi)}`); if (doiOf(record.DOI) === doi) records.push(record); else failedLookups++; }
          catch (error) { failedLookups++; lookupError = error; }
        }
      };
      await Promise.all([worker(), worker()]);
      failedLookups += selected.length - next;
      coverage.query = coverage.queries.map((entry) => entry.query).join(" | ");
      coverage.failedLookupCount = failedLookups;
      if (options.signal?.aborted) return answer("cancelled", "Citation exploration was cancelled.");
      if (!records.length && failedLookups) throw lookupError || new DOMException("Crossref deadline exceeded", "TimeoutError");
    } else {
      const params = { "query.bibliographic": resolvedSeed.title, rows: String(candidateLimit) };
      const sourceReqs = researchSpec.sourceRequirements || {};
      const filters = [];
      if (Number.isInteger(sourceReqs.publicationYearFrom)) filters.push(`from-pub-date:${sourceReqs.publicationYearFrom}-01-01`);
      if (Number.isInteger(sourceReqs.publicationYearTo)) filters.push(`until-pub-date:${sourceReqs.publicationYearTo}-12-31`);
      if (filters.length) params.filter = filters.join(",");
      coverage.query = new URLSearchParams(params).toString();
      coverage.queries.push({ query: coverage.query, provider: "Crossref", dialect: "Crossref bibliographic search", limit: candidateLimit });
      coverage.sampled = "First bibliographic search page; not a citation relationship";
      const found = await request("/works", params);
      if (!Array.isArray(found.items)) throw new Error("Invalid registry search response");
      records = found.items.slice(0, candidateLimit);
    }
    coverage.retrievedCount = records.length;
    const candidates = records.map((record) => mapRecord(record, relationship, resolvedSeed, retrievedAt)).filter(Boolean);
    const { knownItem, ...explorationSpec } = researchSpec;
    if (knownItem) explorationSpec.concepts = (explorationSpec.concepts || []).filter((concept) => titleKey(concept.preferredTerm) !== titleKey(knownItem.title) && titleKey(concept.preferredTerm) !== titleKey(knownItem.author));
    const ranked = rankSourceResults(candidates, explorationSpec, candidateLimit);
    coverage.eligibleCount = ranked.length;
    coverage.excludedCount = records.length - ranked.length;
    const results = ranked.slice(0, Math.min(10, Math.max(1, Number.parseInt(limit, 10) || 5)));
    const basis = relationship === "references" ? "Crossref's deposited reference list" : "a Crossref bibliographic search for your selected title, not a citation relationship";
    return answer(results.length ? "success" : "empty", `${coverage.seedLookupStatus === "not_found" ? "The selected DOI was not found in Crossref, so its identity remains unverified. A title search was used instead. " : ""}${results.length ? "These leads come from" : "No retrieved leads passed your current topic and assignment checks using"} ${basis}.${failedLookups ? ` ${failedLookups} reference lookups did not complete; results are partial.` : ""} Metadata and citation coverage are incomplete. Verify relevance and access in the source.`, { results, seed: { title: resolvedSeed.title, ...(seedDoi ? { doi: seedDoi, url: `https://doi.org/${seedDoi}` } : {}) } });
  } catch (error) {
    if (options.signal?.aborted) return answer("cancelled", "Citation exploration was cancelled.");
    if (error?.name === "TimeoutError") return answer("timeout", "Crossref did not respond in time. Try again; this attempt does not establish whether related sources exist.");
    if (error?.status === 404) return answer("not_found", "This DOI was not found in Crossref. It may be registered elsewhere; search the title directly.");
    if (error?.status === 429) return answer("rate_limited", "Crossref is temporarily limiting requests. Try again later.");
    return answer("unavailable", "Crossref exploration could not complete. Try again or search the title directly.");
  }
}
