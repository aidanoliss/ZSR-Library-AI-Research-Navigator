import {
  getAccessScope,
  includesLibraryResults,
  includesOpenAccessResults,
} from "../config/accessScope.js";
import { searchOpenAlex, getOpenAlexStatus } from "./openalex.js";
import { searchLibrarySourceCandidates } from "./primoApi.js";
import { assessKnownItemIdentity, rankSourceResults } from "./sourceRelevance.js";
import { buildSearchRecovery, emptySearchReason } from "../config/searchRecovery.js";

function uniqueQueries(queries) {
  return [...new Set((Array.isArray(queries) ? queries : [queries])
    .map((query) => String(query || "").trim())
    .filter(Boolean))]
    .slice(0, 5);
}

/**
 * Run institution-backed and open-access discovery as independent lanes.
 * Results retain their accessScope, so the client never has to infer access
 * from a title, DOI, or provider name.
 */
export async function discoverSourcesForScope(
  queries,
  limit = 10,
  modeId,
  accessScopeId,
  { signal, researchSpec, ...options } = {}
) {
  const scope = getAccessScope(accessScopeId).id;
  const queryList = uniqueQueries(queries);
  const outcomes = { library: [], openAccess: [] };
  if (!queryList.length) return { results: [], outcomes };
  const spec = researchSpec || { mode: modeId };

  const libraryPromise = includesLibraryResults(scope)
    ? searchLibrarySourceCandidates(queryList, limit, modeId, process.env, { ...options, signal, researchSpec: spec, onOutcome: (outcome) => outcomes.library.push(outcome) })
    : Promise.resolve([]);
  const openAccessPromise = includesOpenAccessResults(scope)
    ? Promise.all(queryList.slice(0, 3).map((query) => searchOpenAlex(query, limit, { ...options, signal, researchSpec: spec, modeId, onOutcome: (outcome) => outcomes.openAccess.push(outcome) })))
      .then((groups) => rankSourceResults(groups.flat(), spec, limit))
    : Promise.resolve([]);
  const [libraryResults, openAccessResults] = await Promise.all([
    libraryPromise,
    openAccessPromise,
  ]);

  const retrievedAt = new Date().toISOString();
  const results = rankSourceResults([
    ...libraryResults.map((result) => ({ ...result, accessScope: result.accessScope || "library" })),
    ...openAccessResults,
  ].map((result) => ({ ...result, retrievedAt: result.retrievedAt || retrievedAt })), spec, scope === "both" ? limit * 2 : limit);
  return { results, outcomes, identity: sourceIdentityStatus(results, spec, outcomes), recovery: buildSearchRecovery(spec, { outcomes, resultCount: results.length }) };
}

export function sourceIdentityStatus(results = [], researchSpec, outcomes = {}) {
  const requested = researchSpec?.knownItem;
  if (!requested?.title) return null;
  const checks = results.map((source) => assessKnownItemIdentity(source, researchSpec));
  const exactCount = checks.filter((check) => check?.status === "exact").length;
  const relatedCount = checks.filter((check) => check?.status === "related").length;
  const unverifiedCount = checks.filter((check) => check?.status === "unverified").length;
  const incomplete = Object.values(outcomes).flat().some((attempt) => ["error", "timeout", "rate_limited", "cancelled", "disabled"].includes(attempt?.status));
  const status = exactCount ? "matched" : incomplete ? "search-incomplete" : unverifiedCount ? "unverified" : "not-found";
  return {
    status, requestedTitle: requested.title, requestedAuthor: requested.author || "", exactCount, relatedCount, unverifiedCount,
    explanation: exactCount ? "A provider record matches the requested bibliographic identity. Confirm the edition or version in the record."
      : incomplete ? "The requested item has not been matched, and at least one provider could not complete the lookup. Related works do not establish that the item was found."
        : unverifiedCount ? "A title matches, but its author identity still needs verification. Related works are labeled separately."
          : "The requested item was not matched in this search. Any displayed related works are different sources, not the requested original.",
  };
}

/** Compatibility array API; servers receive per-request outcomes through onStatus. */
export async function searchSourceCandidatesForScope(queries, limit = 10, modeId, accessScopeId, options = {}) {
  const discovery = await discoverSourcesForScope(queries, limit, modeId, accessScopeId, options);
  options.onStatus?.(discovery.outcomes);
  return discovery.results;
}

function laneOutcome(requested, results, attempts = []) {
  const failures = attempts.filter((attempt) => ["error", "timeout", "rate_limited", "cancelled"].includes(attempt.status));
  const failure = failures.find((attempt) => attempt.status === "rate_limited") || failures.find((attempt) => attempt.status === "timeout") || failures[0];
  const status = !requested ? "not_requested" : results.length ? (failures.length ? "partial" : "success")
    : failure ? failure.status
      : attempts.some((attempt) => ["success", "empty"].includes(attempt.status)) ? "empty"
        : attempts.some((attempt) => attempt.status === "disabled") ? "disabled"
          : attempts.some((attempt) => attempt.status === "unsupported") ? "unsupported" : "not_requested";
  return {
    outcome: status, status, errorCode: failure?.errorCode || null, attempts,
    // Counts from repeated queries overlap; do not sum them into a unique total.
    ...(requested && !results.length ? { emptyReason: emptySearchReason(attempts) } : {}),
  };
}

export function sourceDiscoveryStatus(accessScopeId, liveResults = [], outcomes = {}, researchSpec = null) {
  const scope = getAccessScope(accessScopeId).id;
  const libraryRequested = includesLibraryResults(scope);
  const openAccessRequested = includesOpenAccessResults(scope);
  const openAlex = getOpenAlexStatus();
  const libraryResults = liveResults.filter((result) => result?.accessScope !== "open-access");
  const separateOpenResults = liveResults.filter((result) => result?.accessScope === "open-access");
  const mergedOpenResults = libraryResults.filter((result) => result?.openAccess?.isOpenAccess === true || result?.accessLinks?.some((link) => link.accessScope === "open-access"));
  const allOpenResults = [...separateOpenResults, ...mergedOpenResults];
  return {
    accessScope: scope,
    identity: sourceIdentityStatus(liveResults, researchSpec, outcomes),
    recovery: buildSearchRecovery(researchSpec, { outcomes, resultCount: liveResults.length }),
    lanes: {
      library: {
        requested: libraryRequested,
        resultCount: libraryResults.length,
        ...laneOutcome(libraryRequested, libraryResults, outcomes.library),
      },
      openAccess: {
        requested: openAccessRequested,
        resultCount: allOpenResults.length,
        separateResultCount: separateOpenResults.length,
        mergedResultCount: mergedOpenResults.length,
        provider: "OpenAlex",
        enabled: openAlex.enabled,
        configured: openAlex.configured,
        reason: openAlex.reason,
        retrievesFullText: false,
        ...laneOutcome(openAccessRequested, allOpenResults, outcomes.openAccess || (!openAlex.enabled ? [{ provider: "OpenAlex", status: "disabled" }] : [])),
      },
    },
  };
}
