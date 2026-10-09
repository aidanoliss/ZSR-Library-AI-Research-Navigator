import "dotenv/config";

import { buildPrimoRequest, getPrimoApiStatus, searchPrimoApi } from "../server/primoApi.js";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const query = argument("--query", "cloud computing");
const mode = argument("--mode", "books");
const limit = Math.min(10, Math.max(1, Number.parseInt(argument("--limit", "3"), 10) || 3));
const status = getPrimoApiStatus();
const request = buildPrimoRequest(query, mode, limit);

if (!status.configured) {
  console.error(JSON.stringify({
    ok: false,
    profile: status.profile,
    reason: status.reason,
    next: "Configure the server-only Primo variables documented in docs/primo-guest-sandbox-spike.md.",
  }, null, 2));
  process.exitCode = 1;
} else {
  try {
    const response = await searchPrimoApi(query, mode, limit, { fallbackToPublic: false });
    console.log(JSON.stringify({
      ok: true,
      profile: response.profile,
      demoData: response.demoData,
      sourceLabel: response.sourceLabel,
      eligibleForStudentResults: status.eligibleForStudentResults,
      request: {
        endpointConfigured: Boolean(request.endpoint),
        vid: request.vid,
        tab: request.tab,
        scope: request.scope,
        mode: request.mode,
      },
      totalReportedByProvider: response.total,
      normalizedResultCount: response.results.length,
      sample: response.results.slice(0, 3).map((result) => ({
        title: result.title,
        type: result.type,
        date: result.date,
        provider: result.sourceProvider,
        demoData: result.provenance?.demoData === true,
        hasRecordUrl: Boolean(result.url),
      })),
      interpretation: response.demoData
        ? "The adapter contract works against demo data. This does not validate Wake Forest holdings, access, scopes, or relevance."
        : "The institutional endpoint responded. Librarian relevance and access validation are still required before enabling student discovery.",
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      profile: status.profile,
      demoData: status.demoData,
      error: error?.name === "AbortError" ? "Primo API request timed out." : String(error?.message || error),
    }, null, 2));
    process.exitCode = 1;
  }
}
