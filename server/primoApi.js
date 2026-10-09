import { DEFAULT_MODE_ID, fillTemplate, getSearchMode, LIBRARY_LINKS } from "../config/libraryLinks.js";
import { normalizePrimoDocs, searchPrimo, searchCrossref, searchSourceCandidates } from "./primo.js";
import { discoveryAbort, discoveryResponseDetails, reportDiscoveryOutcome, reportDiscoveryHttpError, reportDiscoveryError } from "./discoveryOutcome.js";
import { hasExactKnownItem, rankSourceResults } from "./sourceRelevance.js";

const GUEST_DEFAULTS = Object.freeze({
  endpoint: "https://api-na.hosted.exlibrisgroup.com/primo/v1/search",
  recordHost: "https://na01.primo.exlibrisgroup.com",
  vid: "API_GUEST_INST:API_GUEST_INST",
  inst: "API_GUEST_INST",
  catalogTab: "LibraryCatalog",
  catalogScope: "MyInstitution",
  articlesTab: "LibraryCatalog",
  articlesScope: "MyInstitution",
});

const INSTITUTIONAL_DEFAULTS = Object.freeze({
  recordHost: "https://wfu.primo.exlibrisgroup.com",
  vid: "01WAKE_INST:ZSR",
  inst: "01WAKE_INST",
  catalogTab: "LibraryCatalog",
  catalogScope: "ZSR",
  articlesTab: "Articles",
  articlesScope: "CentralIndex",
});

function configured(value) {
  return Boolean(String(value || "").trim());
}

function enabled(value) {
  return ["1", "on", "true", "yes"].includes(String(value || "").trim().toLowerCase());
}

function safeHttpsUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "https:" ? parsed.toString().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
}

function requestedProfile(env = process.env) {
  const explicit = String(env.PRIMO_API_PROFILE || "").trim().toLowerCase();
  if (["guest", "institutional", "off"].includes(explicit)) return explicit;
  // Preserve compatibility for an existing server-only endpoint/key deployment,
  // but never infer guest mode from credentials alone.
  return configured(env.PRIMO_API_ENDPOINT) && configured(env.PRIMO_API_KEY)
    ? "institutional"
    : "off";
}

function modeFields(modeId, config) {
  const mode = getSearchMode(modeId);
  const catalogMode = mode.id === "books" || mode.id === "primary";
  return {
    mode: mode.id,
    tab: catalogMode ? config.catalogTab : config.articlesTab,
    scope: catalogMode ? config.catalogScope : config.articlesScope,
    includeDelivery: mode.id === "books",
  };
}

export function getPrimoApiConfig(env = process.env) {
  const profile = requestedProfile(env);
  const defaults = profile === "guest" ? GUEST_DEFAULTS : INSTITUTIONAL_DEFAULTS;
  const endpoint = safeHttpsUrl(env.PRIMO_API_ENDPOINT || (profile === "guest" ? defaults.endpoint : ""));
  const recordHost = safeHttpsUrl(env.PRIMO_API_RECORD_HOST || env.PRIMO_HOST || defaults.recordHost);
  const apiKey = String(env.PRIMO_API_KEY || "").trim();
  const config = {
    profile,
    endpoint,
    recordHost,
    vid: String(env.PRIMO_API_VID || env.PRIMO_VID || defaults.vid || "").trim(),
    inst: String(env.PRIMO_API_INST || env.PRIMO_INST || defaults.inst || "").trim(),
    catalogTab: String(env.PRIMO_API_CATALOG_TAB || defaults.catalogTab || "").trim(),
    catalogScope: String(env.PRIMO_API_CATALOG_SCOPE || env.PRIMO_SCOPE || defaults.catalogScope || "").trim(),
    articlesTab: String(env.PRIMO_API_ARTICLES_TAB || defaults.articlesTab || "").trim(),
    articlesScope: String(env.PRIMO_API_ARTICLES_SCOPE || defaults.articlesScope || "").trim(),
    keyConfigured: Boolean(apiKey),
    demoData: profile === "guest",
  };
  const required = [
    config.endpoint,
    config.vid,
    config.catalogTab,
    config.catalogScope,
    config.articlesTab,
    config.articlesScope,
    apiKey,
  ];
  config.configured = profile !== "off" && required.every(Boolean);
  config.discoveryEnabled = profile === "institutional"
    && config.configured
    && enabled(env.PRIMO_API_USE_FOR_DISCOVERY);
  config.sourceLabel = config.demoData
    ? "Ex Libris guest sandbox demo"
    : "ZSR Primo API";
  config.reason = config.configured
    ? config.discoveryEnabled
      ? "institutional-discovery-enabled"
      : config.demoData
        ? "guest-contract-test-only"
        : "institutional-adapter-ready"
    : profile === "off"
      ? "profile-off"
      : "missing-or-invalid-configuration";
  return { ...config, apiKey };
}

export function getPrimoApiStatus(env = process.env) {
  const { apiKey: _apiKey, ...config } = getPrimoApiConfig(env);
  return {
    profile: config.profile,
    configured: config.configured,
    endpointConfigured: Boolean(config.endpoint),
    keyConfigured: config.keyConfigured,
    demoData: config.demoData,
    discoveryEnabled: config.discoveryEnabled,
    eligibleForStudentResults: config.discoveryEnabled && !config.demoData,
    sourceLabel: config.sourceLabel,
    reason: config.reason,
  };
}

export function buildPrimoRequest(query, modeId = DEFAULT_MODE_ID, limit = 10, env = process.env) {
  const config = getPrimoApiConfig(env);
  const mode = modeFields(modeId, config);
  const boundedLimit = Math.min(50, Math.max(1, Number.parseInt(String(limit), 10) || 10));
  const params = new URLSearchParams({
    vid: config.vid,
    tab: mode.tab,
    scope: mode.scope,
    q: `any,contains,${String(query || "").trim()}`,
    lang: "en",
    offset: "0",
    limit: String(boundedLimit),
    sort: "rank",
    pcAvailability: String(mode.includeDelivery),
    getMore: "0",
    conVoc: "true",
  });
  if (config.inst) params.set("inst", config.inst);

  return {
    configured: config.configured,
    profile: config.profile,
    demoData: config.demoData,
    discoveryEnabled: config.discoveryEnabled,
    sourceLabel: config.sourceLabel,
    endpoint: config.endpoint,
    url: config.endpoint ? `${config.endpoint}?${params}` : "",
    recordHost: config.recordHost,
    vid: config.vid,
    tab: mode.tab,
    scope: mode.scope,
    mode: mode.mode,
  };
}

export async function searchPrimoApi(
  query,
  modeId = DEFAULT_MODE_ID,
  limit = 10,
  { fallbackToPublic = true, env = process.env, ...suppliedOptions } = {}
) {
  const options = { ...suppliedOptions, discoveryQuery: String(query || "").trim() };
  const config = getPrimoApiConfig(env);
  const request = buildPrimoRequest(query, modeId, limit, env);

  if (!request.configured) {
    reportDiscoveryOutcome(options, "Primo API", "disabled");
    return {
      configured: false,
      profile: request.profile,
      demoData: request.demoData,
      sourceLabel: request.sourceLabel,
      fallbackLinks: [
        { label: "Search ZSR", url: fillTemplate(LIBRARY_LINKS.zsrPrimoSearch, query) },
        { label: "Search Google Scholar", url: fillTemplate(LIBRARY_LINKS.googleScholarSearch, query) },
      ],
      results: fallbackToPublic ? await searchPrimo(query, limit, modeId, options) : [],
    };
  }

  const timeoutMs = Math.min(
    20_000,
    Math.max(1_000, Number.parseInt(String(env.PRIMO_API_TIMEOUT_MS || 8000), 10) || 8000)
  );
  const operation = discoveryAbort(options, options.timeoutMs || timeoutMs);
  try {
    const res = await fetch(request.url, {
      headers: {
        Accept: "application/json",
        Authorization: `apikey ${config.apiKey}`,
      },
      signal: operation.signal,
    });
    if (!res.ok) {
      reportDiscoveryHttpError(options, "Primo API", res.status);
      const error = new Error(`Primo API request failed (${res.status})`);
      error.outcomeReported = true;
      throw error;
    }
    const data = await res.json();
    const records = data?.docs || data?.results;
    if (!Array.isArray(records)) {
      reportDiscoveryOutcome(options, "Primo API", "error", { errorCode: "INVALID_PROVIDER_RESPONSE" });
      const error = new Error("Primo API returned an invalid response");
      error.outcomeReported = true;
      throw error;
    }
    const results = normalizePrimoDocs(data, {
      query,
      limit,
      modeId,
      recordHost: request.recordHost,
      vid: request.vid,
      tab: request.tab,
      scope: request.scope,
      providerLabel: request.sourceLabel,
      metadataLabel: request.demoData ? "Ex Libris guest-sandbox metadata" : "ZSR Primo API metadata",
      demoData: request.demoData,
      researchSpec: options.researchSpec,
    });
    reportDiscoveryOutcome(options, "Primo API", results.length ? "success" : "empty", discoveryResponseDetails(records.length, results.length));

    return {
      configured: true,
      profile: request.profile,
      demoData: request.demoData,
      sourceLabel: request.sourceLabel,
      results,
      total: Number(data?.info?.total || results.length),
    };
  } catch (error) {
    if (!error.outcomeReported) reportDiscoveryError(options, "Primo API", error, operation.timedOut);
    throw error;
  } finally {
    operation.cleanup();
  }
}

async function searchInstitutionalApiCandidates(queries, limit, modeId, env, options) {
  if (options.signal?.aborted) return [];
  const candidateLimit = Math.min(24, Math.max(12, limit * 2));
  const responses = await Promise.allSettled(queries.slice(0, 3).map((query) =>
    searchPrimoApi(query, modeId, candidateLimit, { ...options, timeoutMs: Math.min(options.timeoutMs || 6000, options.discoveryBudgetMs || 8000), fallbackToPublic: false, env })
  ));
  const pool = responses.flatMap((response) => response.status === "fulfilled" ? response.value.results || [] : []);
  return rankSourceResults(pool, options.researchSpec || { mode: modeId }, limit);
}

/**
 * Use the official API only after an institutional profile is configured and
 * explicitly enabled. Guest-sandbox records are never eligible for students.
 */
export async function searchLibrarySourceCandidates(
  queries,
  limit = 10,
  modeId = DEFAULT_MODE_ID,
  env = process.env,
  options = {}
) {
  const queryList = [...new Set((queries || [])
    .map((query) => String(query || "").trim())
    .filter(Boolean))]
    .slice(0, 5);
  if (!queryList.length) return [];

  const status = getPrimoApiStatus(env);
  if (!status.eligibleForStudentResults) {
    return searchSourceCandidates(queryList, limit, modeId, options);
  }

  const deadline = Date.now() + Math.min(12000, Math.max(500, Number(options.discoveryBudgetMs) || 8000));
  try {
    const apiResults = await searchInstitutionalApiCandidates(queryList, limit, modeId, env, options);
    if (apiResults.length) {
      const unresolvedArticle = options.researchSpec?.knownItem?.title && modeId === "scholarly" && !hasExactKnownItem(apiResults, options.researchSpec);
      if (!unresolvedArticle || options.signal?.aborted || Date.now() >= deadline) return apiResults;
      const metadataResults = await searchCrossref(queryList[0], Math.min(24, Math.max(12, limit * 2)), modeId, {
        ...options, timeoutMs: Math.min(options.timeoutMs || 6000, Math.max(1, deadline - Date.now())),
      });
      return rankSourceResults([...apiResults, ...metadataResults], options.researchSpec, limit);
    }
  } catch {
    // Preserve the current public-metadata path when the official API is unavailable.
  }
  if (options.signal?.aborted || Date.now() >= deadline) return [];
  return searchSourceCandidates(queryList, limit, modeId, { ...options, discoveryBudgetMs: deadline - Date.now() });
}
