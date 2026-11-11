import { includesLibraryResults, includesOpenAccessResults, getAccessScope } from '../config/accessScope.js';

/** A connection failure cannot tell us whether a provider search ran. */
export function unconfirmedSourceDiscovery(accessScope = "library", { rateLimited = false, retryAfterSeconds = null } = {}) {
  const outcome = rateLimited ? "rate_limited" : "not_confirmed";
  const lane = (requested) => ({
    requested,
    resultCount: 0,
    outcome: requested ? outcome : "not_requested",
    status: requested ? outcome : "not_requested",
    attempts: [],
    ...(requested && rateLimited ? { rateLimitedBeforeSearch: true, retryAfterSeconds } : {}),
  });
  return {
    accessScope: getAccessScope(accessScope).id,
    lanes: { library: lane(includesLibraryResults(accessScope)), openAccess: lane(includesOpenAccessResults(accessScope)) },
  };
}
