/**
 * Live lookup against ZSR's Primo discovery (the same index behind
 * "Start your search @ ZSR"). Returns a small set of REAL results — titles,
 * authors, type, link to the ZSR record. No fabrication: every item comes
 * straight from the library's catalog. We never fetch or summarize full text;
 * this is bibliographic metadata + a link, exactly like the catalog shows.
 *
 * Fails safe: any error / timeout returns [] so the core plan still works.
 * Disable with PRIMO_LIVE=off.
 */
import { DEFAULT_MODE_ID, getSearchMode } from "../config/libraryLinks.js";

const ENABLED = (process.env.PRIMO_LIVE || "on").toLowerCase() !== "off";
const HOST = process.env.PRIMO_HOST || "https://wfu.primo.exlibrisgroup.com";
const INST = process.env.PRIMO_INST || "01WAKE_INST";
const VID = process.env.PRIMO_VID || "01WAKE_INST:ZSR";
const SCOPE = process.env.PRIMO_SCOPE || "ZSR";
const ARTICLE_RE = /\b(article|articles|journal article|peer[-\s]?reviewed|scholarly|evidence|studies|research studies|impact|effects?|relationship|association)\b/i;
const STOPWORDS = new Set([
  "and", "the", "for", "with", "from", "into", "that", "this", "your", "only",
  "when", "where", "what", "which", "using", "about", "related", "sources",
  "source", "results", "result",
]);
const WEAK_TOPIC_TOKENS = new Set(["impact", "effect", "effects", "ment", "health"]);

function clean(s) {
  return String(s || "")
    .replace(/\$\$.*$/s, "") // strip Primo control markup ($$Q…, $$D…)
    .replace(/\s*[:;/]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resultKey(result) {
  const title = String(result.title || "")
    .replace(/\([^)]*updated[^)]*\)/gi, "")
    .replace(/\([^)]*\d{4}[^)]*\)/g, "")
    .split(/\s:\s/)
    .shift()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return title;
}

function looksLikeNewswireRecord(result) {
  return /^data on .+ detailed by researchers/i.test(String(result.title || ""));
}

function values(value, limit = 6) {
  const out = [];
  const visit = (item) => {
    if (out.length >= limit || item == null) return;
    if (Array.isArray(item)) {
      for (const next of item) visit(next);
      return;
    }
    if (typeof item === "object") {
      for (const next of Object.values(item)) visit(next);
      return;
    }
    const parts = clean(item).split(/\s*;\s*/).filter(Boolean);
    for (const cleaned of parts) {
      if (out.length >= limit) return;
      if (cleaned && !out.includes(cleaned)) out.push(cleaned);
    }
  };
  visit(value);
  return out;
}

function resultDescription({ title, type, date, subjects }) {
  const topicText = subjects.length
    ? ` Metadata highlights ${subjects.slice(0, 3).join(", ")}.`
    : "";
  const dateText = date ? ` Published/created ${date}.` : "";
  return `Relevant ZSR catalog record for this search.${topicText}${dateText} Open the record to confirm access, peer-review status, and citation details.`;
}

function firstValue(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstValue(item);
      if (found) return found;
    }
    return "";
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = firstValue(item);
      if (found) return found;
    }
    return "";
  }
  return String(value || "").trim();
}

function imageUrl(raw) {
  const value = firstValue(raw);
  if (!value) return null;
  const primoUrl = value.match(/\$\$U([^$]+)/)?.[1] || value;
  if (/^https?:\/\//i.test(primoUrl)) return primoUrl;
  if (primoUrl.startsWith("//")) return `https:${primoUrl}`;
  if (primoUrl.startsWith("/")) return `${HOST}${primoUrl}`;
  return null;
}

function thumbnailFromDoc(d) {
  return (
    imageUrl(d.thumbnail) ||
    imageUrl(d.pnx?.links?.thumbnail) ||
    imageUrl(d.pnx?.display?.thumbnail) ||
    imageUrl(d.delivery?.thumbnail)
  );
}

function articleIntent(query, modeId = DEFAULT_MODE_ID) {
  if (modeId === "books" || modeId === "primary") return false;
  if (["scholarly", "news", "data", "legal-policy"].includes(modeId)) return true;
  const text = String(query || "");
  return ARTICLE_RE.test(text) && !/\b(books?|ebooks?|e-books?)\b/i.test(text);
}

function normalizeCatalogQuery(query) {
  return clean(query)
    .replace(/\b(can you|could you|please|find|provide|show|get|give me|list|recommend)\b/gi, " ")
    .replace(/\b(peer[-\s]?reviewed|scholarly|academic)\b/gi, " ")
    .replace(/\b(journal\s+)?articles?\b/gi, " ")
    .replace(/\b(sources?|results?|on|about|for|related to)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenRoot(token) {
  return token
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(ing|tion|sion|ment|ness|ity|ies|ed|al|s)$/i, "")
    .slice(0, 10);
}

function queryTokens(query) {
  return clean(query)
    .toLowerCase()
    .split(/\s+/)
    .map(tokenRoot)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

function relevanceScore(text, tokens) {
  const haystack = tokenRoot(text).length ? String(text || "").toLowerCase() : "";
  return tokens.reduce((score, token) => (haystack.includes(token) ? score + 1 : score), 0);
}

function matchedStrongTokens(text, tokens) {
  const haystack = String(text || "").toLowerCase();
  return tokens.filter((token) => !WEAK_TOPIC_TOKENS.has(token) && haystack.includes(token));
}

function isRelevantResult(result, tokens) {
  if (!tokens.length) return true;
  if (tokens.length < 4) return result.relevance > 0;
  const strongQueryTokenCount = tokens.filter((token) => !WEAK_TOPIC_TOKENS.has(token)).length;
  if (!strongQueryTokenCount) return result.relevance >= 2;
  return result.relevance >= 2 && result.titleStrongRelevance >= Math.min(2, strongQueryTokenCount);
}

function resultScore(result, wantsArticles) {
  const type = String(result.type || "").toLowerCase();
  let score = 0;
  score += result.relevance * 20;
  score += result.titleRelevance * 14;
  score += result.strongRelevance * 10;
  score += result.titleStrongRelevance * 20;
  if (wantsArticles && /article/.test(type)) score += 30;
  if (/journal article|article/.test(type)) score += 12;
  if (/book|ebook|e-book/.test(type)) score += 4;
  if (result.cover) score += 1;
  return score;
}

function identifier(value) {
  return clean(firstValue(value))
    .replace(/^doi:\s*/i, "")
    .replace(/^pmid:\s*/i, "");
}

export async function searchPrimo(query, limit = 10, modeId = DEFAULT_MODE_ID) {
  const mode = getSearchMode(modeId);
  const q = normalizeCatalogQuery(query);
  if (!ENABLED || !q) return [];
  const wantsArticles = articleIntent(query, mode.id);
  const tokens = queryTokens(q);
  const requestLimit = wantsArticles ? Math.max(limit * 4, 30) : Math.max(limit * 3, 24);
  const tab = wantsArticles ? "Articles" : "LibraryCatalog";
  const scope = wantsArticles ? "CentralIndex" : SCOPE;

  const params = new URLSearchParams({
    acTriggered: "false",
    blendFacetsSeparately: "false",
    disableCache: "false",
    getMore: "0",
    inst: INST,
    lang: "en",
    limit: String(requestLimit),
    mode: "basic",
    newspapersActive: "false",
    newspapersSearch: "false",
    offset: "0",
    pcAvailability: "false",
    q: `any,contains,${q}`,
    qExclude: "",
    qInclude: "",
    rapido: "false",
    refEntryActive: "false",
    rtaLinks: "true",
    scope,
    skipDelivery: "Y",
    sort: "rank",
    tab,
    vid: VID,
  });
  const url = `${HOST}/primaws/rest/pub/pnxs?${params}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results = (data.docs || []).map((d) => {
      const disp = d.pnx?.display || {};
      const addata = d.pnx?.addata || {};
      const relevanceText = [
        disp.title?.[0],
        disp.creator?.[0],
        disp.contributor?.[0],
        ...(disp.subject || []),
        disp.type?.[0],
      ].filter(Boolean).join(" ");
      const titleText = disp.title?.[0] || "";
      const subjects = values(disp.subject, 8);
      const description = resultDescription({
        title: titleText,
        type: disp.type?.[0],
        date: disp.creationdate?.[0],
        subjects,
      });
      const recordid = d.pnx?.control?.recordid?.[0];
      const context = d.context || "L";
      const record = recordid
        ? `${HOST}/discovery/fulldisplay?docid=${encodeURIComponent(recordid)}&context=${context}&vid=${VID}&tab=${tab}&search_scope=${scope}`
        : `${HOST}/discovery/search?query=any,contains,${encodeURIComponent(q)}&vid=${VID}&tab=${tab}&search_scope=${scope}`;
      // Prefer a real thumbnail supplied by Primo. Fall back to a real book cover
      // by ISBN via the free Open Library cover service.
      // ?default=false → 404 when no cover exists, so the UI can fall back cleanly.
      const isbn = (addata.isbn?.[0] || "").replace(/[^0-9Xx]/g, "");
      const cover = thumbnailFromDoc(d) || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false` : null);
      const doi = identifier(addata.doi || disp.identifier);
      const pmid = identifier(addata.pmid || addata.pubmedid || addata.pubmed);
      return {
        title: clean(disp.title?.[0]) || "(untitled)",
        author: clean(disp.creator?.[0] || disp.contributor?.[0] || ""),
        type: clean(disp.type?.[0] || ""),
        date: clean(disp.creationdate?.[0] || ""),
        url: record,
        cover,
        doi,
        pmid,
        description,
        detailPoints: [
          subjects.length ? `Subject terms: ${subjects.slice(0, 6).join("; ")}` : "",
          "Access: use the ZSR record to check full text, PDF availability, and database login.",
        ].filter(Boolean),
        relevance: relevanceScore(relevanceText, tokens),
        titleRelevance: relevanceScore(titleText, tokens),
        strongRelevance: matchedStrongTokens(relevanceText, tokens).length,
        titleStrongRelevance: matchedStrongTokens(titleText, tokens).length,
      };
    });
    const relevantResults = tokens.length ? results.filter((result) => isRelevantResult(result, tokens)) : results;
    const articleUsefulResults = wantsArticles
      ? relevantResults.filter((result) => !/newsletter|newspaper|magazine|trade/i.test(String(result.type || "")))
      : relevantResults;
    const seen = new Set();
    return (articleUsefulResults.length ? articleUsefulResults : relevantResults.length ? relevantResults : results)
      .sort((a, b) => resultScore(b, wantsArticles) - resultScore(a, wantsArticles))
      .filter((result) => !looksLikeNewswireRecord(result))
      .filter((result) => {
        const key = resultKey(result);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit)
      .map(({ relevance, titleRelevance, strongRelevance, titleStrongRelevance, ...result }) => result);
  } catch {
    return []; // network error / timeout / abort → degrade gracefully
  } finally {
    clearTimeout(timer);
  }
}
