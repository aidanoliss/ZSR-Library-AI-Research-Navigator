/**
 * Server-only OpenAlex metadata provider for the navigator's public open-access
 * lane. OpenAlex work metadata is CC0; linked articles and PDFs keep their
 * original rights. This module never downloads or summarizes full text.
 *
 * OpenAlex currently requires an API key. Keep OPENALEX_API_KEY on the server;
 * neither this module's status helper nor its result objects expose the key.
 */
import { SOURCE_KINDS } from "../config/resourceCapabilities.js";

const PROVIDER = "OpenAlex";
const API_ORIGIN = "https://api.openalex.org";
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_QUERY_LENGTH = 300;
const MAX_RESULTS = 10;
const MAX_CACHE_ENTRIES = 100;

const STOPWORDS = new Set([
  "about", "and", "article", "articles", "find", "for", "from", "how", "into",
  "journal", "of", "on", "or", "research", "scholarly", "show", "source", "sources",
  "studies", "study", "that", "the", "this", "to", "using", "what", "when", "where",
  "which", "with", "would", "your",
]);
const WEAK_TOKENS = new Set(["effect", "health", "impact", "research", "student"]);
const AI_CONCEPT_RE = /\b(ai|artificial intelligence|generative ai|chatgpt|large language models?|llms?)\b/i;
const OFFLOADING_CONCEPT_RE = /\b(cognitive offload(?:ing)?|offload(?:ing)?|cognitive load|external memory|distributed cognition|human-ai interaction)\b/i;
const BIODIVERSITY_CONCEPT_RE = /\b(biodiversity|biological diversity|species diversity|ecosystem diversity|species richness)\b/i;
const CLIMATE_CONCEPT_RE = /\b(climate change|climate resilience|climate adaptation|climate impacts?|climate mitigation|global warming|carbon sequestration)\b/i;

const cache = new Map();

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function cleanText(value, maxLength = 300) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanQuery(value) {
  return cleanText(value, MAX_QUERY_LENGTH)
    .replace(/\b(?:AND|OR|NOT)\b/gi, " ")
    .replace(/[()"“”*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function boundedLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(MAX_RESULTS, Math.max(1, parsed));
}

function boundedTimeout(value) {
  if (value == null) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.min(DEFAULT_TIMEOUT_MS, Math.max(1, Math.floor(parsed)));
}

function safeHttpsUrl(value) {
  const raw = cleanText(value, 2048);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function canonicalDoi(value) {
  const raw = cleanText(value, 320)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/[?#].*$/, "")
    .replace(/[.,;]+$/, "")
    .trim();
  return /^10\.\d{4,9}\/[a-z0-9._;()/:+-]+$/i.test(raw) ? raw : "";
}

function doiUrl(doi) {
  if (!doi) return "";
  const encoded = doi.split("/").map((part) => encodeURIComponent(part)).join("/");
  return safeHttpsUrl(`https://doi.org/${encoded}`);
}

function normalizedTitle(value) {
  return cleanText(value, 500)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b(?:a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenRoot(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(ing|tion|sion|ment|ness|ity|ies|ed|al|s)$/i, "")
    .slice(0, 12);
}

function queryTokens(query) {
  return cleanQuery(query)
    .split(/\s+/)
    .map(tokenRoot)
    .filter((token) => (token.length >= 4 || token === "ai") && !STOPWORDS.has(token));
}

function tokenAppears(text, token) {
  if (token === "ai") return AI_CONCEPT_RE.test(text);
  return String(text || "").toLowerCase().includes(token);
}

function conceptRequirements(query) {
  const requirements = [];
  if (AI_CONCEPT_RE.test(query)) requirements.push(AI_CONCEPT_RE);
  if (/\b(cognitive offload(?:ing)?|offload(?:ing)?)\b/i.test(query)) requirements.push(OFFLOADING_CONCEPT_RE);
  if (BIODIVERSITY_CONCEPT_RE.test(query) && CLIMATE_CONCEPT_RE.test(query)) {
    requirements.push(BIODIVERSITY_CONCEPT_RE, CLIMATE_CONCEPT_RE);
  }
  return requirements;
}

function relevanceFor(work, tokens, requirements) {
  const title = cleanText(work?.display_name || work?.title, 500);
  const concepts = [
    ...(Array.isArray(work?.concepts) ? work.concepts : []),
    ...(Array.isArray(work?.keywords) ? work.keywords : []),
    work?.primary_topic,
  ]
    .map((item) => cleanText(item?.display_name || item?.keyword || item?.name, 120))
    .filter(Boolean)
    .slice(0, 25);
  const text = [title, ...concepts].join(" ");
  if (!requirements.every((requirement) => requirement.test(text))) return null;
  if (!tokens.length) return { score: 1, titleScore: 0, concepts };

  const score = tokens.reduce((sum, token) => sum + (tokenAppears(text, token) ? 1 : 0), 0);
  const titleScore = tokens.reduce((sum, token) => sum + (tokenAppears(title, token) ? 1 : 0), 0);
  const strongMatches = tokens.filter((token) => !WEAK_TOKENS.has(token) && tokenAppears(text, token)).length;
  const strongTitleMatches = tokens.filter((token) => !WEAK_TOKENS.has(token) && tokenAppears(title, token)).length;
  const passes = tokens.length === 1
    ? score >= 1
    : tokens.length === 2
      ? score >= 2
      : score >= 2 && (strongTitleMatches >= 1 || strongMatches >= Math.min(3, tokens.length));
  return passes ? { score, titleScore, concepts } : null;
}

function locationIsOpen(location) {
  return location?.is_oa === true;
}

function safeLocation(location) {
  if (!location || typeof location !== "object" || !locationIsOpen(location)) return null;
  const landingPageUrl = safeHttpsUrl(location.landing_page_url);
  const pdfUrl = safeHttpsUrl(location.pdf_url);
  if (!landingPageUrl && !pdfUrl) return null;
  return {
    landingPageUrl,
    pdfUrl,
    license: cleanText(location.license, 120),
    licenseId: safeHttpsUrl(location.license_id),
    version: cleanText(location.version, 80),
    host: cleanText(location.source?.display_name, 180),
    hostOrganization: cleanText(location.source?.host_organization_name, 180),
    sourceType: cleanText(location.source?.type, 80),
  };
}

function selectedOpenLocation(work) {
  const candidates = [
    work?.best_oa_location,
    work?.primary_location,
    ...(Array.isArray(work?.locations) ? work.locations : []),
  ];
  for (const candidate of candidates) {
    const location = safeLocation(candidate);
    if (location) return location;
  }
  const oaUrl = safeHttpsUrl(work?.open_access?.oa_url);
  return oaUrl
    ? { landingPageUrl: oaUrl, pdfUrl: "", license: "", licenseId: "", version: "", host: "", hostOrganization: "", sourceType: "" }
    : null;
}

function normalizedLicenseKind(license, licenseId) {
  const value = `${cleanText(license, 120)} ${safeHttpsUrl(licenseId)}`.toLowerCase();
  if (/\bcc0\b/.test(value) || /creativecommons\.org\/publicdomain\/zero\//.test(value)) return "cc0";
  if (/\bpublic[- ]domain\b/.test(value) || /creativecommons\.org\/publicdomain\/mark\//.test(value)) return "public-domain";
  if (/^(?:\s*)cc-by(?:\s*)$/.test(cleanText(license, 120).toLowerCase())) return "cc-by";
  if (/creativecommons\.org\/licenses\/by\/[0-9.]+\/?(?:\s|$)/.test(value)) return "cc-by";
  return "";
}

function authorNames(authorships) {
  const seen = new Set();
  return (Array.isArray(authorships) ? authorships : [])
    .map((entry) => cleanText(entry?.author?.display_name, 120))
    .filter((name) => {
      const key = name.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

function authorSummary(authors) {
  if (!authors.length) return "";
  return `${authors.slice(0, 2).join("; ")}${authors.length > 2 ? " et al." : ""}`;
}

function sourceKindForType(type) {
  const value = cleanText(type, 80).toLowerCase();
  if (/book[- ]chapter|book section/.test(value)) return SOURCE_KINDS.BOOK_CHAPTER;
  if (/^book$|monograph/.test(value)) return SOURCE_KINDS.BOOK;
  if (/dataset/.test(value)) return SOURCE_KINDS.DATASET;
  return SOURCE_KINDS.SCHOLARLY_ARTICLE;
}

function mapWork(work, queryContext) {
  if (!work || typeof work !== "object" || work.is_retracted === true || work?.open_access?.is_oa !== true) return null;
  const title = cleanText(work.display_name || work.title, 500);
  if (!title) return null;
  const relevance = relevanceFor(work, queryContext.tokens, queryContext.requirements);
  if (!relevance) return null;

  const location = selectedOpenLocation(work);
  if (!location) return null;
  const doi = canonicalDoi(work.doi || work?.ids?.doi);
  const openAlexId = safeHttpsUrl(work.id || work?.ids?.openalex);
  const url = location.landingPageUrl || location.pdfUrl || doiUrl(doi) || openAlexId;
  if (!url) return null;

  const authors = authorNames(work.authorships);
  const rawType = cleanText(work.type_crossref || work.type, 80) || "work";
  const displayType = rawType.replace(/[-_]+/g, " ");
  const publicationDate = /^\d{4}-\d{2}-\d{2}$/.test(String(work.publication_date || ""))
    ? String(work.publication_date)
    : "";
  const year = Number.isInteger(work.publication_year) ? work.publication_year : null;
  const date = publicationDate || (year ? String(year) : "");
  const venue = cleanText(work?.primary_location?.source?.display_name, 180);
  const oaStatus = cleanText(work?.open_access?.oa_status, 80);
  const licenseKind = normalizedLicenseKind(location.license, location.licenseId);
  const summaryEligible = ["cc-by", "cc0", "public-domain"].includes(licenseKind);
  const exactLicense = location.license || location.licenseId;
  const subjects = relevance.concepts.slice(0, 6);

  return {
    title,
    author: authorSummary(authors),
    authors,
    type: displayType,
    date,
    url,
    cover: null,
    doi,
    pmid: "",
    isbn: "",
    issn: "",
    containerTitle: venue,
    publisher: location.hostOrganization,
    edition: "",
    volume: cleanText(work?.biblio?.volume, 40),
    issue: cleanText(work?.biblio?.issue, 40),
    pages: [
      cleanText(work?.biblio?.first_page, 40),
      cleanText(work?.biblio?.last_page, 40),
    ].filter(Boolean).join("-"),
    fulfillment: null,
    description: `Open-access discovery metadata from OpenAlex${venue ? ` for a work published by ${venue}` : ""}. Open the source page to confirm access, relevance, and reuse terms.`,
    abstractExcerpt: "",
    abstractSource: "",
    detailPoints: [
      oaStatus ? `Open-access status reported by OpenAlex: ${oaStatus}.` : "OpenAlex reports this work as open access.",
      exactLicense ? `License reported for this location: ${exactLicense}.` : "No reusable-content license was supplied for this location.",
      location.version ? `Version reported by OpenAlex: ${location.version}.` : "",
      location.host ? `Host reported by OpenAlex: ${location.host}.` : "",
      "OpenAlex metadata is CC0. The linked article or PDF retains its source license and copyright.",
    ].filter(Boolean),
    sourceProvider: "OpenAlex scholarly metadata",
    sourceKind: sourceKindForType(rawType),
    sourceMode: "scholarly",
    accessScope: "open-access",
    summaryEligible,
    citation: {
      title,
      authors,
      publicationDate,
      year,
      venue,
      volume: cleanText(work?.biblio?.volume, 40),
      issue: cleanText(work?.biblio?.issue, 40),
      firstPage: cleanText(work?.biblio?.first_page, 40),
      lastPage: cleanText(work?.biblio?.last_page, 40),
      doi,
      openAlexId,
      type: rawType,
    },
    openAccess: {
      status: oaStatus,
      isOpenAccess: true,
      license: location.license,
      licenseId: location.licenseId,
      licenseKind,
      version: location.version,
      host: location.host,
      hostOrganization: location.hostOrganization,
      sourceType: location.sourceType,
      landingPageUrl: location.landingPageUrl,
      pdfUrl: location.pdfUrl,
    },
    provenance: {
      provider: PROVIDER,
      recordType: rawType,
      metadataLicense: "CC0",
      metadataOnly: true,
      accessVerified: false,
      accessReportedByProvider: true,
      accessScope: "open-access",
      oaStatus,
      license: location.license,
      licenseId: location.licenseId,
      version: location.version,
      host: location.host,
      hostOrganization: location.hostOrganization,
      landingPageUrl: location.landingPageUrl,
      pdfUrl: location.pdfUrl,
    },
    subjects,
    _relevance: relevance.score,
    _titleRelevance: relevance.titleScore,
  };
}

function cloneResults(results) {
  return results.map((result) => ({
    ...result,
    detailPoints: [...result.detailPoints],
    citation: { ...result.citation, authors: [...result.citation.authors] },
    openAccess: { ...result.openAccess },
    provenance: { ...result.provenance },
    subjects: [...result.subjects],
  }));
}

function cacheGet(key, now) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return cloneResults(entry.results);
}

function cacheSet(key, results, now, ttlMs) {
  while (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { expiresAt: now + ttlMs, results: cloneResults(results) });
}

function configuredApiKey(options) {
  return cleanText(hasOwn(options, "apiKey") ? options.apiKey : process.env.OPENALEX_API_KEY, 500);
}

function providerEnabled(options) {
  if (hasOwn(options, "enabled")) return options.enabled === true;
  return String(process.env.OPENALEX_LIVE || "on").toLowerCase() !== "off";
}

/**
 * Returns public, key-safe configuration for health/readiness endpoints.
 */
export function getOpenAlexStatus(options = {}) {
  const configured = Boolean(configuredApiKey(options));
  const enabledByConfig = providerEnabled(options);
  return {
    provider: PROVIDER,
    enabled: configured && enabledByConfig,
    configured,
    reason: !enabledByConfig ? "disabled-by-config" : configured ? "ready" : "missing-api-key",
    endpoint: `${API_ORIGIN}/works`,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    cacheTtlMs: DEFAULT_CACHE_TTL_MS,
    maxResults: MAX_RESULTS,
    oaOnlyDefault: true,
    accessScope: "open-access",
    metadataLicense: "CC0",
    retrievesFullText: false,
  };
}

/**
 * Search OpenAlex works and return sanitized, provider-reported OA metadata.
 *
 * options:
 *   oaOnly (default true): add OpenAlex's is_oa:true API filter. Local OA
 *     enforcement remains active even when false, because this provider powers
 *     only the open-access lane.
 *   apiKey: server-side override (primarily tests); an explicit empty value
 *     disables the provider.
 *   fetchImpl: injectable fetch implementation.
 *   signal: optional caller cancellation signal.
 *   timeoutMs: testable timeout, capped at the production six-second budget.
 *   cache: false to bypass the short-lived process-local cache.
 */
export async function searchOpenAlex(query, limit = 10, options = {}) {
  const q = cleanQuery(query);
  const resultLimit = boundedLimit(limit);
  const apiKey = configuredApiKey(options);
  if (!q || !apiKey || !providerEnabled(options)) return [];

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") return [];
  const oaOnly = options.oaOnly !== false;
  const cacheEnabled = options.cache !== false && fetchImpl === globalThis.fetch;
  const now = Date.now();
  const cacheKey = `${q.toLowerCase()}|${resultLimit}|${oaOnly ? "oa" : "all"}`;
  if (cacheEnabled) {
    const cached = cacheGet(cacheKey, now);
    if (cached) return cached;
  }

  const requestLimit = Math.min(50, Math.max(20, resultLimit * 4));
  const params = new URLSearchParams({
    search: q,
    filter: oaOnly ? "is_oa:true,is_retracted:false" : "is_retracted:false",
    "per-page": String(requestLimit),
    sort: "relevance_score:desc",
    api_key: apiKey,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), boundedTimeout(options.timeoutMs));
  const callerSignal = options.signal;
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener?.("abort", abortFromCaller, { once: true });

  try {
    if (controller.signal.aborted) return [];
    const response = await fetchImpl(`${API_ORIGIN}/works?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ZSR-Research-Navigator/1.0 (mailto:askzsr@wfu.edu)",
      },
      signal: controller.signal,
    });
    if (!response?.ok) return [];
    const payload = await response.json();
    const works = Array.isArray(payload?.results) ? payload.results.slice(0, requestLimit) : [];
    const queryContext = { tokens: queryTokens(q), requirements: conceptRequirements(q) };
    const mapped = works
      .map((work) => mapWork(work, queryContext))
      .filter(Boolean)
      .sort((a, b) => b._titleRelevance - a._titleRelevance || b._relevance - a._relevance);

    const seenDois = new Set();
    const seenTitles = new Set();
    const results = mapped
      .filter((result) => {
        const doiKey = result.doi.toLowerCase();
        const titleKey = normalizedTitle(result.title);
        if ((doiKey && seenDois.has(doiKey)) || (titleKey && seenTitles.has(titleKey))) return false;
        if (doiKey) seenDois.add(doiKey);
        if (titleKey) seenTitles.add(titleKey);
        return true;
      })
      .slice(0, resultLimit)
      .map(({ _relevance, _titleRelevance, ...result }) => result);

    if (cacheEnabled) cacheSet(cacheKey, results, now, DEFAULT_CACHE_TTL_MS);
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener?.("abort", abortFromCaller);
  }
}
