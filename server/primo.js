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
import { DEFAULT_MODE_ID, LIBRARY_LINKS, getSearchMode } from "../config/libraryLinks.js";
import { SOURCE_KINDS } from "../config/resourceCapabilities.js";

const ENABLED = (process.env.PRIMO_LIVE || "on").toLowerCase() !== "off";
const HOST = process.env.PRIMO_HOST || "https://wfu.primo.exlibrisgroup.com";
const CROSSREF_HOST = process.env.CROSSREF_HOST || "https://api.crossref.org";
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
const AI_CONCEPT_RE = /\b(ai|artificial intelligence|generative ai|chatgpt|large language models?|llms?)\b/i;
const OFFLOADING_CONCEPT_RE = /\b(cognitive offload(?:ing)?|offload(?:ing)?|cognitive load|external memory|distributed cognition|human-ai interaction)\b/i;
const BIODIVERSITY_CONCEPT_RE = /\b(biodiversity|biological diversity|species diversity|ecosystem diversity|species richness)\b/i;
const CLIMATE_CONCEPT_RE = /\b(climate change|climate resilience|climate adaptation|climate impacts?|climate mitigation|climate regulation|global warming|carbon sequestration)\b/i;

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
  const author = String(result.author || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const date = String(result.date || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return [title, author, date].join("|");
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

const NON_PERSON_AUTHOR_RE = /\b(?:agenc|associat|centre|center|cnrs|council|depart|ecosyst|facult|foundat|funding|hospital|inrae|institut|laborat|ministry|national|nerc|program|project|recherche|research|school|supported|survey|team|unit|universit)/iu;

function boundedText(value, maxLength = 110) {
  const text = clean(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

function decodeTextEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (named[key] != null) return named[key];
    const codePoint = key.startsWith("#x")
      ? Number.parseInt(key.slice(2), 16)
      : Number.parseInt(key.slice(1), 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
    return String.fromCodePoint(codePoint);
  });
}

function providerText(value) {
  let text = firstValue(value);
  if (!text) return "";
  const primoValues = [...text.matchAll(/\$\$V([^$]+)/g)].map((match) => match[1]);
  if (primoValues.length) text = primoValues.join(" ");
  return decodeTextEntities(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*(?:abstract|summary)\s*[:.\-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function abstractExcerpt(value, maxLength = 360) {
  const text = providerText(value);
  if (!text) return "";
  const sentences = typeof Intl?.Segmenter === "function"
    ? [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)]
        .map((segment) => segment.segment.trim())
        .filter(Boolean)
    : text.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [text];
  const selected = sentences.slice(0, 2).join(" ") || text;
  if (selected.length > maxLength) {
    const slice = selected.slice(0, maxLength - 3);
    const lastSpace = slice.lastIndexOf(" ");
    const clipped = lastSpace > maxLength * 0.65 ? slice.slice(0, lastSpace) : slice;
    return `${clipped.trimEnd()}...`;
  }
  return selected.length < text.length ? `${selected} ...` : selected;
}

function looksLikePersonName(value) {
  const author = clean(value);
  if (!author || author.length > 80 || /\d|https?:|[()[\]{}:]/i.test(author)) return false;
  if (NON_PERSON_AUTHOR_RE.test(author)) return false;
  const words = author
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;
  return words.every((word) => /^[\p{L}][\p{L}.'’\-]*$/u.test(word));
}

function authorMetadata(structured, display) {
  const candidates = values(structured, 30);
  const fallbackCandidates = values(display, 30);
  const structuredAuthors = candidates.filter(looksLikePersonName);
  const likelyAuthors = structuredAuthors.length
    ? structuredAuthors
    : fallbackCandidates.filter(looksLikePersonName);
  const seen = new Set();
  const authors = likelyAuthors.filter((author) => {
    const key = author.toLowerCase().replace(/[^\p{L}]+/gu, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!authors.length) {
    const fallback = boundedText(firstValue(structured) || fallbackCandidates[0] || firstValue(display), 80);
    return { summary: fallback, detail: "", authors: fallback ? [fallback] : [] };
  }

  const visible = authors.slice(0, 2).join("; ");
  const summary = boundedText(`${visible}${authors.length > 2 ? " et al." : ""}`, 110);
  const detailed = authors.slice(0, 6).join("; ");
  const detail = authors.length > 2
    ? `Authors: ${detailed}${authors.length > 6 ? "; et al." : ""}`
    : "";
  return { summary, detail, authors };
}

function resultDescription({ title, type, date, subjects }) {
  const topicText = subjects.length
    ? ` Metadata highlights ${subjects.slice(0, 3).join(", ")}.`
    : "";
  const dateText = date ? ` Published/created ${date}.` : "";
  return `Potential ZSR discovery lead for this search.${topicText}${dateText} Open the record to confirm relevance, access, peer-review status, and citation details.`;
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

const DISCOVERY_PROFILES = Object.freeze({
  scholarly: {
    tab: "Articles",
    scope: "CentralIndex",
    newspapers: false,
    sourceKind: SOURCE_KINDS.SCHOLARLY_ARTICLE,
    crossrefFallback: true,
  },
  books: {
    tab: "LibraryCatalog",
    scope: SCOPE,
    newspapers: false,
    sourceKind: SOURCE_KINDS.CATALOG_RECORD,
    crossrefFallback: false,
  },
  news: {
    tab: "Articles",
    scope: "CentralIndex",
    newspapers: true,
    sourceKind: SOURCE_KINDS.NEWS,
    crossrefFallback: false,
  },
  data: {
    tab: "Articles",
    scope: "CentralIndex",
    newspapers: false,
    sourceKind: SOURCE_KINDS.DATASET,
    crossrefFallback: false,
  },
  primary: {
    tab: "LibraryCatalog",
    scope: SCOPE,
    newspapers: false,
    sourceKind: SOURCE_KINDS.PRIMARY_SOURCE,
    crossrefFallback: false,
  },
  "legal-policy": {
    tab: "Articles",
    scope: "CentralIndex",
    newspapers: false,
    sourceKind: SOURCE_KINDS.LEGAL_SECONDARY,
    crossrefFallback: false,
  },
});

function discoveryProfile(modeId, query) {
  const selected = DISCOVERY_PROFILES[modeId];
  if (selected) return selected;
  return articleIntent(query, modeId)
    ? DISCOVERY_PROFILES.scholarly
    : DISCOVERY_PROFILES.books;
}

function resultModeText(result) {
  return [
    result.title,
    result.type,
    result.subjects?.join(" "),
    result.abstractExcerpt,
  ].filter(Boolean).join(" ");
}

function inferredSourceKind(result, modeId) {
  const text = resultModeText(result).toLowerCase();
  const type = String(result.type || "").toLowerCase();
  if (/newspaper|news article|newswire|magazine|trade publication|press release/.test(type)) return SOURCE_KINDS.NEWS;
  if (/dataset|data set|statistic|statistical|survey data|numeric data/.test(text)) return SOURCE_KINDS.DATASET;
  if (/case law|court decision|statute|legislation|regulation|legal document|law review/.test(text)) {
    return /case law|court decision|statute|legislation|regulation|legal document/.test(text)
      ? SOURCE_KINDS.LEGAL_PRIMARY
      : SOURCE_KINDS.LEGAL_SECONDARY;
  }
  if (/archiv|manuscript|correspondence|letters?\b|diar(?:y|ies)|oral histor|photograph|personal papers|primary source|government document|speech|interview/.test(text)) {
    return SOURCE_KINDS.PRIMARY_SOURCE;
  }
  if (/book chapter|chapter/.test(type)) return SOURCE_KINDS.BOOK_CHAPTER;
  if (/book|ebook|e-book|reference entry|encyclopedia/.test(type)) return SOURCE_KINDS.BOOK;
  if (/article|journal|review/.test(type)) return SOURCE_KINDS.SCHOLARLY_ARTICLE;
  if (modeId === "books") return SOURCE_KINDS.CATALOG_RECORD;
  return "unknown";
}

function resultMatchesMode(result, modeId) {
  const kind = result.sourceKind || inferredSourceKind(result, modeId);
  if (modeId === "scholarly") return [SOURCE_KINDS.SCHOLARLY_ARTICLE, SOURCE_KINDS.BOOK_CHAPTER].includes(kind);
  if (modeId === "books") return [SOURCE_KINDS.BOOK, SOURCE_KINDS.BOOK_CHAPTER, SOURCE_KINDS.CATALOG_RECORD].includes(kind);
  if (modeId === "news") return kind === SOURCE_KINDS.NEWS;
  if (modeId === "data") return [SOURCE_KINDS.DATASET, SOURCE_KINDS.STATISTICS].includes(kind);
  if (modeId === "primary") return [SOURCE_KINDS.PRIMARY_SOURCE, SOURCE_KINDS.ARCHIVAL, SOURCE_KINDS.LEGAL_PRIMARY].includes(kind);
  if (modeId === "legal-policy") return [SOURCE_KINDS.LEGAL_PRIMARY, SOURCE_KINDS.LEGAL_SECONDARY].includes(kind);
  return true;
}

function normalizeCatalogQuery(query) {
  return clean(query)
    .replace(/\b(can you|could you|please|find|provide|show|get|give me|list|recommend)\b/gi, " ")
    .replace(/\b(how|why|whether|ways?|affects?|influences?|impacts?)\b/gi, " ")
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
    .filter((token) => (token.length >= 4 || token === "ai") && !STOPWORDS.has(token));
}

function tokenAppears(text, token) {
  const haystack = String(text || "").toLowerCase();
  if (token === "ai") return AI_CONCEPT_RE.test(haystack);
  return haystack.includes(token);
}

function relevanceScore(text, tokens) {
  return tokens.reduce((score, token) => (tokenAppears(text, token) ? score + 1 : score), 0);
}

function matchedStrongTokens(text, tokens) {
  return tokens.filter((token) => !WEAK_TOPIC_TOKENS.has(token) && tokenAppears(text, token));
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

function passesConceptRequirements(text, requirements) {
  return requirements.every((requirement) => requirement.test(text));
}

function isRelevantResult(result, tokens) {
  if (result.requiredConceptMatch === false) return false;
  if (!tokens.length) return true;
  if (tokens.length === 1) return result.relevance > 0;
  if (tokens.length === 2) return result.relevance >= 2;
  if (tokens.length === 3) {
    return result.relevance >= 2 && (result.titleStrongRelevance >= 1 || result.strongRelevance >= 3);
  }
  const strongQueryTokenCount = tokens.filter((token) => !WEAK_TOPIC_TOKENS.has(token)).length;
  if (!strongQueryTokenCount) return result.relevance >= 2;
  return (
    result.relevance >= 2 &&
    (result.titleStrongRelevance >= Math.min(2, strongQueryTokenCount) || result.strongRelevance >= Math.min(3, strongQueryTokenCount))
  );
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

function identifierText(value) {
  if (Array.isArray(value)) return value.map(identifierText).filter(Boolean).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(identifierText).filter(Boolean).join(" ");
  return String(value || "");
}

function doiIdentifier(value) {
  const match = identifierText(value).match(/10\.\d{4,9}\/[-._;()/:a-z0-9]+/i);
  return match ? match[0].replace(/[.,;:)}\]]+$/, "") : "";
}

function pmidIdentifier(value) {
  const text = identifierText(value);
  const labeled = text.match(/(?:\$\$C)?(?:PMID|PUBMED(?:ID)?)\s*(?:\$\$V|[:#])?\s*(\d{4,9})/i);
  if (labeled) return labeled[1];
  const direct = clean(firstValue(value));
  return /^\d{4,9}$/.test(direct) ? direct : "";
}

function citationPages(addata = {}) {
  const direct = clean(firstValue(addata.pages));
  if (direct) return direct;
  const start = clean(firstValue(addata.spage));
  const end = clean(firstValue(addata.epage));
  return [start, end].filter(Boolean).join(start && end ? "-" : "");
}

function physicalFulfillment(doc, recordUrl, modeId) {
  if (modeId !== "books") return null;
  const best = doc?.delivery?.bestlocation || doc?.delivery?.holding?.[0] || null;
  const status = clean(best?.availabilityStatus).toLowerCase();
  const statusLabel = status === "available"
    ? "Available when checked"
    : status === "unavailable"
      ? "Unavailable when checked"
      : status === "check_holdings"
        ? "Check holdings"
        : "Check location and availability";
  const location = [clean(best?.mainLocation), clean(best?.subLocation)]
    .filter(Boolean)
    .filter((value, index, items) => items.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
    .join(" · ");
  const callNumber = clean(best?.callNumber);
  return {
    status: status || "unknown",
    statusLabel,
    location,
    callNumber,
    availabilityChecked: Boolean(status),
    checkedAt: status ? new Date().toISOString() : "",
    recordUrl,
    requestUrl: LIBRARY_LINKS.zsrDelivers,
    actionLabel: location || callNumber ? "Open record for current availability" : "Check location and availability",
    requestLabel: "Request through ZSR Delivers",
  };
}

export async function searchPrimo(query, limit = 10, modeId = DEFAULT_MODE_ID) {
  const mode = getSearchMode(modeId);
  const profile = discoveryProfile(mode.id, query);
  const q = normalizeCatalogQuery(query);
  if (!ENABLED || !q) return [];
  const wantsArticles = profile.tab === "Articles";
  const tokens = queryTokens(q);
  const requirements = conceptRequirements(q);
  const requestLimit = wantsArticles ? Math.max(limit * 4, 30) : Math.max(limit * 3, 24);
  const tab = profile.tab;
  const scope = profile.scope;
  const includeDelivery = mode.id === "books";

  const params = new URLSearchParams({
    acTriggered: "false",
    blendFacetsSeparately: "false",
    disableCache: "false",
    getMore: "0",
    inst: INST,
    lang: "en",
    limit: String(requestLimit),
    mode: "basic",
    newspapersActive: String(profile.newspapers),
    newspapersSearch: String(profile.newspapers),
    offset: "0",
    pcAvailability: String(includeDelivery),
    q: `any,contains,${q}`,
    qExclude: "",
    qInclude: "",
    rapido: "false",
    refEntryActive: "false",
    rtaLinks: "true",
    scope,
    skipDelivery: includeDelivery ? "N" : "Y",
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
      const subjects = values(disp.subject, 8);
      const displayedSubjects = subjects.slice(0, 6);
      const relevanceText = [
        disp.title?.[0],
        ...displayedSubjects,
      ].filter(Boolean).join(" ");
      const sourceAbstract = abstractExcerpt(addata.abstract || disp.abstract);
      const visibleConceptText = [
        relevanceText,
        sourceAbstract,
      ].filter(Boolean).join(" ");
      const titleText = disp.title?.[0] || "";
      const authors = authorMetadata(
        [addata.au, addata.addau],
        [disp.creator, disp.contributor]
      );
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
      const doi = doiIdentifier(addata.doi || disp.identifier);
      const pmid = pmidIdentifier(addata.pmid || addata.pubmedid || addata.pubmed || disp.identifier);
      const fulfillment = physicalFulfillment(d, record, mode.id);
      const issn = clean(firstValue(addata.issn)).replace(/[^0-9Xx-]/g, "");
      const publisher = clean(firstValue(addata.pub || disp.publisher));
      const containerTitle = clean(firstValue(addata.jtitle || addata.btitle));
      return {
        title: clean(disp.title?.[0]) || "(untitled)",
        author: authors.summary,
        authors: authors.authors,
        type: clean(disp.type?.[0] || ""),
        date: clean(disp.creationdate?.[0] || ""),
        url: record,
        cover,
        doi,
        pmid,
        isbn,
        issn,
        containerTitle,
        publisher,
        edition: clean(firstValue(addata.edition || disp.edition)),
        volume: clean(firstValue(addata.volume)),
        issue: clean(firstValue(addata.issue)),
        pages: citationPages(addata),
        fulfillment,
        description,
        abstractExcerpt: sourceAbstract,
        abstractSource: sourceAbstract ? "ZSR record metadata" : "",
        detailPoints: [
          authors.detail,
          displayedSubjects.length ? `Subject terms: ${displayedSubjects.join("; ")}` : "",
          fulfillment?.location ? `Location when checked: ${fulfillment.location}` : "",
          fulfillment?.callNumber ? `Call number: ${fulfillment.callNumber}` : "",
          mode.id === "books"
            ? "Availability can change. Open the ZSR record before visiting the shelf or placing a request."
            : "Access: use the ZSR record to check full text, PDF availability, and database login.",
        ].filter(Boolean),
        sourceProvider: "ZSR discovery",
        accessScope: "library",
        sourceKind: inferredSourceKind({
          title: clean(disp.title?.[0]),
          type: clean(disp.type?.[0] || ""),
          subjects: displayedSubjects,
          abstractExcerpt: sourceAbstract,
        }, mode.id),
        sourceMode: mode.id,
        provenance: {
          provider: "ZSR discovery",
          recordType: clean(disp.type?.[0] || "") || "unspecified",
          accessVerified: false,
          metadataOnly: true,
        },
        subjects: displayedSubjects,
        relevance: relevanceScore(relevanceText, tokens),
        titleRelevance: relevanceScore(titleText, tokens),
        strongRelevance: matchedStrongTokens(relevanceText, tokens).length,
        titleStrongRelevance: matchedStrongTokens(titleText, tokens).length,
        requiredConceptMatch: passesConceptRequirements(visibleConceptText, requirements),
      };
    });
    const relevantResults = tokens.length ? results.filter((result) => isRelevantResult(result, tokens)) : results;
    // Source mode is a retrieval contract. A result of the wrong type is not
    // allowed to leak in merely because its title happens to match the topic.
    const modeResults = relevantResults.filter((result) => resultMatchesMode(result, mode.id));
    const articleUsefulResults = mode.id === "scholarly"
      ? modeResults.filter((result) => !/newsletter|newspaper|magazine|trade/i.test(String(result.type || "")))
      : modeResults;
    const seen = new Set();
    const displayResults = mode.id === "scholarly" ? articleUsefulResults : modeResults;
    return displayResults
      .sort((a, b) => resultScore(b, wantsArticles) - resultScore(a, wantsArticles))
      .filter((result) => !looksLikeNewswireRecord(result))
      .filter((result) => {
        const key = resultKey(result);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit)
      .map(({ relevance, titleRelevance, strongRelevance, titleStrongRelevance, requiredConceptMatch, subjects: _subjects, ...result }) => result);
  } catch {
    return []; // network error / timeout / abort → degrade gracefully
  } finally {
    clearTimeout(timer);
  }
}

function crossrefQuery(query) {
  return clean(query)
    .replace(/\b(?:AND|OR|NOT)\b/gi, " ")
    .replace(/[()"“”]/g, " ")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function crossrefAuthors(authors = []) {
  const names = authors
    .map((author) => [author.given, author.family].filter(Boolean).join(" ").trim())
    .filter(Boolean);
  return authorMetadata(names, []);
}

function crossrefDate(item) {
  const parts = item?.published?.["date-parts"]?.[0] || item?.issued?.["date-parts"]?.[0] || [];
  return parts.filter(Boolean).join("-");
}

export async function searchCrossref(query, limit = 10, modeId = DEFAULT_MODE_ID) {
  const q = crossrefQuery(query);
  if (!q) return [];
  const mode = getSearchMode(modeId);
  if (mode.id !== "scholarly") return [];
  const params = new URLSearchParams({
    "query.title": q,
    rows: String(Math.min(30, Math.max(limit * 3, 15))),
    select: "DOI,title,author,published,issued,type,URL,container-title,abstract,volume,issue,page,publisher,ISBN,ISSN",
  });
  if (mode.id === "scholarly") params.set("filter", "type:journal-article");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${CROSSREF_HOST}/works?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ZSR-Research-Navigator/1.0 (mailto:askzsr@wfu.edu)",
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const tokens = queryTokens(q);
    const minimumMatches = tokens.length <= 1 ? 1 : 2;
    const rows = (data?.message?.items || [])
      .map((item) => {
        const title = clean(item?.title?.[0]);
        const container = clean(item?.["container-title"]?.[0]);
        const doi = doiIdentifier(item?.DOI);
        const authors = crossrefAuthors(item?.author);
        const sourceAbstract = abstractExcerpt(item?.abstract);
        const searchable = [title, container, sourceAbstract].filter(Boolean).join(" ");
        return {
          title,
          author: authors.summary,
          authors: authors.authors,
          type: clean(item?.type || "scholarly work").replace(/-/g, " "),
          date: crossrefDate(item),
          url: doi ? `https://doi.org/${doi}` : clean(item?.URL),
          cover: null,
          doi,
          pmid: "",
          isbn: clean(firstValue(item?.ISBN)),
          issn: clean(firstValue(item?.ISSN)),
          containerTitle: container,
          publisher: clean(item?.publisher),
          edition: "",
          volume: clean(item?.volume),
          issue: clean(item?.issue),
          pages: clean(item?.page),
          fulfillment: null,
          description: `Bibliographic metadata from Crossref${container ? ` for a work in ${container}` : ""}. Search the exact title in ZSR to confirm access and fit.`,
          abstractExcerpt: sourceAbstract,
          abstractSource: sourceAbstract ? "Crossref record metadata" : "",
          detailPoints: [
            authors.detail,
            container ? `Publication: ${container}` : "",
            "Availability is not verified. Use the DOI, exact title, or ZSR search link to check access.",
          ].filter(Boolean),
          sourceProvider: "Crossref scholarly metadata",
          accessScope: "library",
          sourceKind: SOURCE_KINDS.SCHOLARLY_ARTICLE,
          sourceMode: mode.id,
          provenance: {
            provider: "Crossref",
            recordType: clean(item?.type || "journal article").replace(/-/g, " "),
            accessVerified: false,
            metadataOnly: true,
          },
          relevance: relevanceScore(searchable, tokens),
          titleRelevance: relevanceScore(title, tokens),
        };
      })
      .filter((item) => item.title && item.url && item.relevance >= minimumMatches)
      .sort((a, b) => b.titleRelevance - a.titleRelevance || b.relevance - a.relevance);

    const seen = new Set();
    return rows
      .filter((item) => {
        const key = item.doi?.toLowerCase() || resultKey(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit)
      .map(({ relevance, titleRelevance, ...item }) => item);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function mergedSourceKey(result) {
  return String(result?.doi || "").toLowerCase() || resultKey(result);
}

function mergeSourceResults(groups, limit) {
  const seen = new Set();
  const merged = [];
  for (const group of groups) {
    for (const result of group || []) {
      const key = mergedSourceKey(result);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(result);
      if (merged.length >= limit) return merged;
    }
  }
  return merged;
}

export async function searchSourceCandidates(queries, limit = 10, modeId = DEFAULT_MODE_ID) {
  const queryList = [...new Set((queries || []).map((query) => clean(query)).filter(Boolean))].slice(0, 5);
  if (!queryList.length) return [];

  const target = Math.min(5, Math.max(1, limit));
  const primary = await searchPrimo(queryList[0], limit, modeId);
  if (primary.length >= target) return primary.slice(0, limit);

  const zsrFallbacks = await Promise.all(
    queryList.slice(1).map((query) => searchPrimo(query, limit, modeId))
  );
  const zsrResults = mergeSourceResults([primary, ...zsrFallbacks], limit);
  if (zsrResults.length >= target) return zsrResults;

  const profile = discoveryProfile(getSearchMode(modeId).id, queryList[0]);
  if (!profile.crossrefFallback) return zsrResults;

  const crossrefFallbacks = await Promise.all(
    queryList.slice(0, 2).map((query) => searchCrossref(query, limit, modeId))
  );
  return mergeSourceResults([zsrResults, ...crossrefFallbacks], limit);
}
