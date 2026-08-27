import {
  getAccessScope,
  includesLibraryResults,
  includesOpenAccessResults,
} from "../config/accessScope.js";
import { searchOpenAlex, getOpenAlexStatus } from "./openalex.js";
import { searchSourceCandidates } from "./primo.js";

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
export async function searchSourceCandidatesForScope(
  queries,
  limit = 10,
  modeId,
  accessScopeId,
  { signal } = {}
) {
  const scope = getAccessScope(accessScopeId).id;
  const queryList = uniqueQueries(queries);
  if (!queryList.length) return [];

  const libraryPromise = includesLibraryResults(scope)
    ? searchSourceCandidates(queryList, limit, modeId)
    : Promise.resolve([]);
  const openAccessPromise = includesOpenAccessResults(scope)
    ? searchOpenAlex(queryList[0], limit, { signal })
    : Promise.resolve([]);
  const [libraryResults, openAccessResults] = await Promise.all([
    libraryPromise,
    openAccessPromise,
  ]);

  return [
    ...libraryResults.map((result) => ({ ...result, accessScope: result.accessScope || "library" })),
    ...openAccessResults,
  ];
}

export function sourceDiscoveryStatus(accessScopeId, liveResults = []) {
  const scope = getAccessScope(accessScopeId).id;
  const libraryRequested = includesLibraryResults(scope);
  const openAccessRequested = includesOpenAccessResults(scope);
  const openAlex = getOpenAlexStatus();
  return {
    accessScope: scope,
    lanes: {
      library: {
        requested: libraryRequested,
        resultCount: liveResults.filter((result) => result?.accessScope !== "open-access").length,
      },
      openAccess: {
        requested: openAccessRequested,
        resultCount: liveResults.filter((result) => result?.accessScope === "open-access").length,
        provider: "OpenAlex",
        enabled: openAlex.enabled,
        configured: openAlex.configured,
        reason: openAlex.reason,
        retrievesFullText: false,
      },
    },
  };
}
