export const LIBRARY_LINKS = {
  googleScholarSearch: "https://scholar.google.com/scholar?q={q}",
  zsrPrimoSearch:
    "https://wfu.primo.exlibrisgroup.com/discovery/search?query=any,contains,{q}&tab=LibraryCatalog&search_scope=ZSR&vid=01WAKE_INST:ZSR&offset=0",
  zsrArticleSearch:
    "https://wfu.primo.exlibrisgroup.com/discovery/search?query=any,contains,{q}&tab=Articles&search_scope=CentralIndex&vid=01WAKE_INST:ZSR&offset=0",
  zsrCitationGuide: "https://zsr.wfu.edu/research/guides/citation/",
  zsrZoteroAssistant: "https://zsr.wfu.edu/research-instruction/zotero-research-assistant/",
  zsrResearchGuides: "https://guides.zsr.wfu.edu/",
  zsrLibKeyInfo: "https://zsr.wfu.edu/research/",
  zsrDelivers: "https://zsr.wfu.edu/delivers/ill/",
  zsrAsk: "https://zsr.wfu.edu/ask/",
  primoApiEndpoint: "__PRIMO_API_ENDPOINT__",
  primoApiKeyEnv: "PRIMO_API_KEY",
};

// LibKey Nomad browser extension (Chrome Web Store).
export const LIBKEY_NOMAD_URL =
  "https://chromewebstore.google.com/detail/libkey-nomad/lkoeejijapdihgbegpljiehpnlkadljb?hl=en-US";

// Wake Forest's LibKey / Third Iron library ID.
// When ZSR provides Wake Forest's LibKey/Third Iron library ID, set this (via the
// VITE_WFU_LIBKEY_LIBRARY_ID env var, or hardcode here) to enable direct
// Wake-specific LibKey links. Without it, the app uses LibKey's choose-library
// fallback, where the student selects Wake Forest University once.
export const WFU_LIBKEY_LIBRARY_ID =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_WFU_LIBKEY_LIBRARY_ID) || "";

/** Strip a leading doi:/https://doi.org/ prefix but keep the DOI's slashes intact. */
function cleanDoi(doi) {
  return String(doi || "")
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
}

/**
 * Build a LibKey lookup URL for a DOI or PMID.
 * - With WFU_LIBKEY_LIBRARY_ID: https://libkey.io/libraries/{id}/{doi}
 *   (PMIDs use the .../pmid/{pmid} form LibKey expects).
 * - Without it: https://libkey.io/choose-library/{doi} so the student can pick
 *   Wake Forest University.
 * Returns "" if neither a DOI nor PMID is supplied.
 */
export function libkeyUrl({ doi, pmid } = {}) {
  const base = WFU_LIBKEY_LIBRARY_ID
    ? `https://libkey.io/libraries/${WFU_LIBKEY_LIBRARY_ID}`
    : "https://libkey.io/choose-library";
  const cleaned = cleanDoi(doi);
  if (cleaned) return `${base}/${cleaned}`;
  const pid = String(pmid || "").replace(/\D/g, "");
  if (pid) return `${base}/pmid/${pid}`;
  return "";
}

/** Find a DOI (10.xxxx/xxxx) anywhere in free text. */
export function extractDoi(text) {
  const m = String(text || "").match(/10\.\d{4,9}\/[-._;()/:a-z0-9]+/i);
  if (!m) return "";
  return m[0].replace(/[.,;:)\]]+$/, ""); // trim trailing punctuation
}

/** Find a PMID only when it is explicitly labeled (avoid mistaking random numbers). */
export function extractPmid(text) {
  const m = String(text || "").match(/\b(?:pmid|pubmed\s*id|pubmed)\s*[:#]?\s*(\d{4,9})\b/i);
  return m ? m[1] : "";
}

export const CITATION_LINKS = [
  {
    label: "ZSR Citation Guide",
    url: LIBRARY_LINKS.zsrCitationGuide,
  },
];

export const SEARCH_MODES = [
  {
    id: "scholarly",
    label: "Scholarly Articles",
    shortLabel: "Articles",
    description: "Peer-reviewed terms, subject databases, Scholar, and ZSR article discovery.",
    termStrategies: ["peer-reviewed terms", "subject headings", "journal and author chasing"],
    evaluation: "Prioritize peer-reviewed status, method fit, recency, sample, and citation trail.",
    citation: "Capture DOI, journal title, volume, issue, pages, and database/source while you search.",
    recommended: [
      ["ZSR Article Search", LIBRARY_LINKS.zsrArticleSearch, "Broad ZSR article discovery."],
      ["Google Scholar", LIBRARY_LINKS.googleScholarSearch, "Cross-disciplinary citation chasing."],
      ["A-Z Databases", "https://guides.zsr.wfu.edu/az.php", "Choose discipline-specific databases."],
    ],
    termSuffixes: ["peer reviewed", "journal article", "systematic review", "literature review"],
  },
  {
    id: "books",
    label: "Books and Background Sources",
    shortLabel: "Books",
    description: "Catalog searches, handbooks, encyclopedias, and subject browsing.",
    termStrategies: ["book title keywords", "handbook/overview terms", "subject browsing"],
    evaluation: "Use background sources to define terms, scope debates, and identify major authors.",
    citation: "Record edition, publisher, chapter author, and page range for books or chapters.",
    recommended: [
      ["ZSR Library Search", LIBRARY_LINKS.zsrPrimoSearch, "Books, ebooks, handbooks, and chapters."],
      ["Research Guides", LIBRARY_LINKS.zsrResearchGuides, "Subject-specific background sources."],
      ["A-Z Databases", "https://guides.zsr.wfu.edu/az.php", "Find encyclopedias and reference tools."],
    ],
    termSuffixes: ["handbook", "overview", "encyclopedia", "introduction"],
  },
  {
    id: "news",
    label: "News and Current Events",
    shortLabel: "News",
    description: "Date filters, publication names, news databases, and current-event framing.",
    termStrategies: ["date ranges", "publication names", "event and location terms"],
    evaluation: "Compare reporting across outlets and distinguish news, opinion, and analysis.",
    citation: "Save publication name, author, date, section, URL/database, and access date if required.",
    recommended: [
      ["A-Z Databases", "https://guides.zsr.wfu.edu/az.php?q=Factiva", "Look for Factiva or news databases."],
      ["ProQuest Search", "https://guides.zsr.wfu.edu/az.php?q=ProQuest", "Search broad news/publication databases."],
      ["Google Scholar", LIBRARY_LINKS.googleScholarSearch, "Use only when looking for scholarly context."],
    ],
    termSuffixes: ["news", "coverage", "newspaper", "current events"],
  },
  {
    id: "data",
    label: "Data and Statistics",
    shortLabel: "Data",
    description: "Datasets, surveys, statistical sources, and government/think-tank terms.",
    termStrategies: ["dataset terms", "survey names", "statistics and trend words"],
    evaluation: "Check who collected the data, sample size, geography, dates, and methodology.",
    citation: "Capture dataset title, producer, version/date, table number, URL, and access date.",
    recommended: [
      ["Research Guides", LIBRARY_LINKS.zsrResearchGuides, "Find statistics and data by subject."],
      ["A-Z Databases", "https://guides.zsr.wfu.edu/az.php?q=statistics", "Search for statistical databases."],
      ["Google Scholar", LIBRARY_LINKS.googleScholarSearch, "Find studies that cite or use datasets."],
    ],
    termSuffixes: ["statistics", "dataset", "survey", "trend", "prevalence"],
  },
  {
    id: "primary",
    label: "Primary Sources",
    shortLabel: "Primary",
    description: "Archives, collections, date ranges, names, places, and document types.",
    termStrategies: ["date ranges", "proper names", "document types", "archive/collection terms"],
    evaluation: "Place sources in historical context and separate original evidence from interpretation.",
    citation: "Record collection name, box/folder/item, repository, date, and creator when available.",
    recommended: [
      ["Special Collections & Archives", "https://zsr.wfu.edu/special/", "Original archival materials."],
      ["Digital Collections", "https://zsr.wfu.edu/special/collections/digital/", "Digitized primary sources."],
      ["ZSR Library Search", LIBRARY_LINKS.zsrPrimoSearch, "Find published primary-source collections."],
    ],
    termSuffixes: ["archive", "primary source", "letters", "photographs", "oral history"],
  },
  {
    id: "legal-policy",
    label: "Legal or Policy Sources",
    shortLabel: "Legal/Policy",
    description: "Cases, statutes, regulations, policy reports, and government documents.",
    termStrategies: ["case names", "statutes", "regulations", "policy report terms"],
    evaluation: "Distinguish law, policy analysis, advocacy, and commentary; check jurisdiction and date.",
    citation: "Legal and policy sources may need Bluebook, APA, or course-specific citation rules.",
    recommended: [
      ["A-Z Databases", "https://guides.zsr.wfu.edu/az.php?q=legal", "Look for legal and policy databases."],
      ["Research Guides", LIBRARY_LINKS.zsrResearchGuides, "Find policy/government research guides."],
      ["Google Scholar", LIBRARY_LINKS.googleScholarSearch, "Useful for case law and policy scholarship."],
    ],
    termSuffixes: ["policy", "law", "court", "regulation", "case"],
  },
  {
    id: "general",
    label: "General Research",
    shortLabel: "General",
    description: "Broad starting points, keyword variants, background reading, and database selection.",
    termStrategies: ["broader terms", "narrower variants", "alternative phrasing"],
    evaluation: "Use source type, author expertise, evidence quality, date, and purpose to triage sources.",
    citation: "Capture citation details early, then confirm style requirements from the assignment.",
    recommended: [
      ["ZSR Library Search", LIBRARY_LINKS.zsrPrimoSearch, "Broad search across ZSR holdings."],
      ["Research Guides", LIBRARY_LINKS.zsrResearchGuides, "Subject orientation and database choices."],
      ["Ask a Librarian", LIBRARY_LINKS.zsrAsk, "Use when the topic is complex or stuck."],
    ],
    termSuffixes: ["overview", "research", "debate", "evidence"],
  },
];

export const DEFAULT_MODE_ID = "scholarly";

export const RESPONSE_STYLES = [
  {
    id: "hybrid",
    label: "Answer + sources",
    shortLabel: "Hybrid",
    description: "Answer directly and add ZSR results when the request calls for evidence.",
  },
  {
    id: "answer",
    label: "Answer first",
    shortLabel: "Answer",
    description: "Prioritize a concise AI answer; skip source-heavy sections unless asked.",
  },
  {
    id: "sources",
    label: "Find sources",
    shortLabel: "Sources",
    description: "Prioritize ZSR results, search terms, full-text access, and citation help.",
  },
];

export const DEFAULT_RESPONSE_STYLE_ID = "hybrid";

export function getSearchMode(modeId) {
  return SEARCH_MODES.find((mode) => mode.id === modeId) || SEARCH_MODES.find((mode) => mode.id === DEFAULT_MODE_ID);
}

export function getResponseStyle(styleId) {
  return RESPONSE_STYLES.find((style) => style.id === styleId) || RESPONSE_STYLES.find((style) => style.id === DEFAULT_RESPONSE_STYLE_ID);
}

export function fillTemplate(template, query) {
  return template.replace("{q}", encodeURIComponent(query || ""));
}

export function buildAccessLinks({ title, doi, pmid } = {}) {
  const links = [];
  // Route DOIs/PMIDs through LibKey (Wake-specific when the library ID is set,
  // else LibKey's choose-library flow). Never promises a PDF.
  if (doi || pmid) {
    links.push({ label: "Find full text through ZSR", url: libkeyUrl({ doi, pmid }) });
  }
  if (pmid) {
    links.push({
      label: "Open PubMed record",
      url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(String(pmid).replace(/\D/g, ""))}/`,
    });
  }
  if (title) {
    links.push({
      label: "Search Google Scholar",
      url: fillTemplate(LIBRARY_LINKS.googleScholarSearch, title),
    });
    links.push({
      label: "Search ZSR",
      url: fillTemplate(LIBRARY_LINKS.zsrPrimoSearch, title),
    });
  }
  links.push({ label: "Request help / ZSR Delivers", url: LIBRARY_LINKS.zsrDelivers });
  return links;
}
