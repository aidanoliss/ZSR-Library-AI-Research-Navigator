import { DEFAULT_SUBJECT_FOCUS_ID, resolveSubjectFocus } from "./subjectFocus.js";

const AZ = "https://guides.zsr.wfu.edu/az.php";
const azSearch = (name) => `${AZ}?q=${encodeURIComponent(name)}`;

export const LIBRARY_LINKS = {
  googleScholarSearch: "https://scholar.google.com/scholar?q={q}",
  zsrPrimoSearch:
    "https://wfu.primo.exlibrisgroup.com/discovery/search?query=any,contains,{q}&tab=LibraryCatalog&search_scope=ZSR&vid=01WAKE_INST:ZSR&offset=0",
  zsrArticleSearch:
    "https://wfu.primo.exlibrisgroup.com/discovery/search?query=any,contains,{q}&tab=Articles&search_scope=CentralIndex&vid=01WAKE_INST:ZSR&offset=0",
  zsrCitationGuide: "https://zsr.wfu.edu/research/guides/citation/",
  zsrZoteroAssistant: "https://zsr.wfu.edu/research-instruction/zotero-research-assistant/",
  zsrResearchGuides: "https://guides.zsr.wfu.edu/",
  zsrDelivers: "https://zsr.wfu.edu/delivers/ill/",
  zsrAsk: "https://zsr.wfu.edu/ask/",
};

export const LIBKEY_NOMAD_URL =
  "https://chromewebstore.google.com/detail/libkey-nomad/lkoeejijapdihgbegpljiehpnlkadljb?hl=en-US";

function fillTemplate(template, query) {
  return template.replace("{q}", encodeURIComponent(query || ""));
}

function cleanDoi(doi) {
  return String(doi || "")
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
}

export function libkeyUrl({ doi, pmid } = {}) {
  const base = "https://libkey.io/choose-library";
  const cleaned = cleanDoi(doi);
  if (cleaned) return `${base}/${cleaned}`;
  const pid = String(pmid || "").replace(/\D/g, "");
  if (pid) return `${base}/pmid/${pid}`;
  return "";
}

export function extractDoi(text) {
  const m = String(text || "").match(/10\.\d{4,9}\/[-._;()/:a-z0-9]+/i);
  return m ? m[0].replace(/[.,;:)\]]+$/, "") : "";
}

export function extractPmid(text) {
  const m = String(text || "").match(/\b(?:pmid|pubmed\s*id|pubmed)\s*[:#]?\s*(\d{4,9})\b/i);
  return m ? m[1] : "";
}

export const CITATION_GUIDES = [
  {
    id: "general-citation",
    label: "ZSR Citation Guide",
    style: "General",
    url: LIBRARY_LINKS.zsrCitationGuide,
    status: "verified-in-project",
    bestFor: "Choosing a citation style and checking common source formats.",
  },
  {
    id: "zotero",
    label: "Zotero Research Assistant",
    style: "Citation management",
    url: LIBRARY_LINKS.zsrZoteroAssistant,
    status: "verified-in-project",
    bestFor: "Saving sources and building bibliographies from library databases.",
  },
  {
    id: "apa",
    label: "APA guide",
    style: "APA",
    url: null,
    status: "TODO: confirm exact ZSR APA guide URL",
    bestFor: "Psychology, education, health, and social-science assignments.",
  },
  {
    id: "mla",
    label: "MLA guide",
    style: "MLA",
    url: null,
    status: "TODO: confirm exact ZSR MLA guide URL",
    bestFor: "Literature, language, arts, and humanities assignments.",
  },
  {
    id: "chicago",
    label: "Chicago guide",
    style: "Chicago",
    url: null,
    status: "TODO: confirm exact ZSR Chicago guide URL",
    bestFor: "History, religion, and some humanities assignments.",
  },
];

export const ZSR_RESOURCE_CONFIG = [
  {
    id: "databases-az",
    name: "A-Z Databases",
    description: "ZSR's filterable database list for choosing a subject-specific place to search for articles, data, news, and primary sources.",
    subjectArea: "Database directory",
    bestFor: "choosing a database by subject or source type before running a topic search",
    notBestFor: "typing a full research question and expecting one ranked answer list",
    accessUrl: AZ,
    tags: ["navigation", "databases", "articles", "subject", "source type", "general"],
    priority: 96,
    notes: "Filter the list by subject, then search topic keywords inside the selected database.",
  },
  {
    id: "ask-a-librarian",
    name: "Ask ZSR",
    description: "Personalized research help from ZSR when the right database, search vocabulary, or access route is unclear.",
    subjectArea: "Research support",
    bestFor: "complex or niche topics, database selection, search troubleshooting, and access questions",
    notBestFor: "an automated search result list",
    accessUrl: LIBRARY_LINKS.zsrAsk,
    tags: ["navigation", "librarian", "help", "consultation", "general"],
    priority: 74,
    notes: "Share the assignment, topic, searches already tried, and the type of source you need.",
  },
  {
    id: "academic-search-premier",
    name: "Academic Search Premier",
    description: "General-purpose scholarly database covering the social sciences, humanities, education, health, and related disciplines.",
    subjectArea: "Multidisciplinary Articles",
    bestFor: "a specific cross-disciplinary article search when no single specialist database clearly owns the topic",
    notBestFor: "specialized legal documents, company financials, or comprehensive biomedical indexing",
    accessUrl: azSearch("Academic Search Premier"),
    tags: ["scholarly", "articles", "multidisciplinary", "social science", "humanities", "education", "health"],
    priority: 80,
    notes: "Use a focused Boolean query, then limit to peer-reviewed journals and the assignment's date range.",
  },
  {
    id: "proquest-research-library",
    name: "ProQuest Research Library",
    description: "Multidisciplinary database with journal, magazine, and newspaper coverage across business, health, education, psychology, science, and literature.",
    subjectArea: "Multidisciplinary Research",
    bestFor: "cross-disciplinary topics that need both scholarly and contextual coverage in one searchable database",
    notBestFor: "a peer-reviewed-only search unless the scholarly-journal filter is applied",
    accessUrl: azSearch("ProQuest Research Library"),
    tags: ["articles", "multidisciplinary", "business", "health", "education", "psychology", "science", "literature"],
    priority: 78,
    notes: "Choose Scholarly Journals before treating results as academic evidence; exclude newspapers and magazines when the assignment requires peer review.",
  },
  {
    id: "econlit",
    name: "EconLit",
    description: "The American Economic Association's index for economics journals, books, dissertations, working papers, and review literature.",
    subjectArea: "Economics",
    bestFor: "economic theory, macroeconomics, microeconomics, policy analysis, political economy, and economics literature reviews",
    notBestFor: "company profiles, consumer-market reports, or general news coverage",
    accessUrl: azSearch("EconLit"),
    tags: ["economics", "economic theory", "macroeconomics", "microeconomics", "keynesian", "neoclassical", "fiscal policy", "monetary policy", "political economy", "scholarly", "articles"],
    priority: 94,
    notes: "Open the specific EconLit entry through ZSR, then use subject terms and publication-type filters to distinguish theory, empirical studies, reviews, and working papers.",
  },
  {
    id: "psycinfo",
    name: "PsycINFO",
    description: "Psychology index for peer-reviewed work on behavior, development, mental health, and cognition.",
    subjectArea: "Psychology",
    bestFor: "scholarly psychology articles, adolescent development, depression, anxiety, autism, and well-being",
    notBestFor: "market share data, legal documents, or newspaper coverage",
    accessUrl: azSearch("PsycINFO"),
    tags: ["scholarly", "articles", "psychology", "mental health", "autism", "adolescents", "loneliness"],
    priority: 95,
    notes: "Use subject terms and age/population filters when available.",
    previewImage: "/preview-psycinfo.png",
  },
  {
    id: "communication-mass-media",
    name: "Communication & Mass Media Complete",
    description: "Communication and media-studies database for media effects, digital culture, and platform behavior.",
    subjectArea: "Communication / Media Studies",
    bestFor: "social media, news media, communication theory, platform use, and audience studies",
    notBestFor: "clinical treatment studies or company financial statements",
    accessUrl: azSearch("Communication & Mass Media Complete"),
    tags: ["scholarly", "articles", "communication", "media", "social media", "news"],
    priority: 90,
    notes: "Search platform terms alongside broader media-effects concepts.",
    previewImage: "/preview-communication-media.png",
  },
  {
    id: "pubmed-medline",
    name: "PubMed / MEDLINE",
    description: "Biomedical and public-health literature, including clinical and population-health studies.",
    subjectArea: "Health Sciences / Medicine",
    bestFor: "biomedical mechanisms, medicine, genetics, disease pathways, public health, and DOI/PMID follow-up",
    notBestFor: "humanities background sources or market research reports",
    accessUrl: "https://pubmed.ncbi.nlm.nih.gov/",
    tags: [
      "scholarly",
      "articles",
      "health",
      "medicine",
      "biology",
      "biochemistry",
      "protein",
      "protein folding",
      "disease",
      "genetics",
      "alzheimer",
      "dementia",
      "maternal health",
      "mortality",
      "statistics",
      "mental health",
      "autism",
      "doi",
      "pmid",
    ],
    priority: 88,
    notes: "PubMed is open; full text may require Wake Forest access through ZSR or LibKey Nomad.",
    previewImage: "/preview-pubmed.png",
  },
  {
    id: "web-of-science",
    name: "Web of Science",
    description: "Multidisciplinary citation index for science, biomedical, and research-impact discovery.",
    subjectArea: "Science Citation Index",
    bestFor: "citation chaining, highly cited biology or biomedical articles, and cross-disciplinary science searches",
    notBestFor: "consumer market reports, company financials, or quick news coverage",
    accessUrl: azSearch("Web of Science"),
    tags: ["scholarly", "articles", "science", "biology", "biochemistry", "protein", "protein folding", "disease", "genetics", "citation"],
    priority: 86,
    notes: "Confirm access through A-Z Databases; use cited-by and references to move from one strong article to related studies.",
  },
  {
    id: "science-direct",
    name: "ScienceDirect",
    description: "Science and health journal platform with biology, chemistry, and biomedical article coverage.",
    subjectArea: "Biology / Life Sciences",
    bestFor: "molecular biology, protein folding, biochemistry, disease mechanisms, and review articles",
    notBestFor: "business intelligence, news coverage, or general library navigation",
    accessUrl: azSearch("ScienceDirect"),
    tags: ["scholarly", "articles", "science", "biology", "biochemistry", "protein", "protein folding", "molecular biology", "disease", "genetics"],
    priority: 84,
    notes: "Confirm available full text through ZSR; use abstracts and references when the full article is not available.",
  },
  {
    id: "socindex",
    name: "SocINDEX",
    description: "Sociology and social-science database for social context, inequality, youth culture, and institutions.",
    subjectArea: "Sociology / Social Sciences",
    bestFor: "social factors, youth studies, family, peer networks, cyberbullying, and inequality",
    notBestFor: "medical treatment protocols or company financials",
    accessUrl: azSearch("SocINDEX"),
    tags: ["scholarly", "articles", "sociology", "social science", "adolescents", "mental health"],
    priority: 82,
    notes: "Good second path when the topic is social context rather than clinical treatment.",
    previewImage: "/preview-socindex.png",
  },
  {
    id: "eric",
    name: "ERIC",
    description: "Education research database for teaching, learning, disability services, and school policy.",
    subjectArea: "Education",
    bestFor: "AI and education, special education, disability support, classroom research, and learning outcomes",
    notBestFor: "consumer market data or clinical-only medical studies",
    accessUrl: azSearch("ERIC"),
    tags: ["education", "scholarly", "articles", "ai education", "autism", "special education", "background"],
    priority: 84,
    notes: "Use ERIC descriptors when possible; broaden to Education Source if ERIC is too narrow.",
  },
  {
    id: "education-source",
    name: "Education Source",
    description: "Broad education database for journals, reports, and education-policy research.",
    subjectArea: "Education",
    bestFor: "education technology, policy, curriculum, school systems, and special education",
    notBestFor: "company reports or legal case law",
    accessUrl: azSearch("Education Source"),
    tags: ["education", "scholarly", "ai education", "autism", "special education", "policy"],
    priority: 78,
    notes: "Pair with ERIC for education-heavy topics.",
  },
  {
    id: "business-guide",
    name: "Business Information Commons",
    description: "ZSR business guide for company, industry, market, and financial research paths.",
    subjectArea: "Business",
    bestFor: "choosing the right business database before searching for reports or financials",
    notBestFor: "peer-reviewed psychology literature",
    accessUrl: "https://guides.zsr.wfu.edu/zsr-bic",
    tags: ["business", "market", "company financials", "industry", "consumer behavior", "rolex", "energy drinks"],
    priority: 92,
    notes: "Use this first when the user needs the right business database category rather than one article.",
  },
  {
    id: "mintel",
    name: "Mintel Academic",
    description: "Consumer market reports and industry insights, when available through ZSR.",
    subjectArea: "Business / Market Research",
    bestFor: "consumer behavior, retail categories, brand positioning, and market trends",
    notBestFor: "peer-reviewed medical studies or legal primary sources",
    accessUrl: azSearch("Mintel"),
    tags: ["business", "market", "consumer behavior", "retail", "brand", "energy drinks", "rolex"],
    priority: 88,
    notes: "Confirm current access in A-Z Databases; use report terminology rather than brand-only searches.",
  },
  {
    id: "business-source",
    name: "Business Source Complete",
    description: "Business journals, trade publications, company/industry context, and management research.",
    subjectArea: "Business",
    bestFor: "industry articles, consumer behavior, marketing, management, and company context",
    notBestFor: "official SEC filings or narrow clinical research",
    accessUrl: azSearch("Business Source Complete"),
    tags: ["business", "market", "company financials", "industry", "consumer behavior", "retail", "articles"],
    priority: 80,
    notes: "Use alongside a market-report database for business topics.",
  },
  {
    id: "mergent",
    name: "Mergent Online",
    description: "Company financials and profiles, if available through ZSR's business database list.",
    subjectArea: "Business / Company Financials",
    bestFor: "public company financial statements, ratios, company profiles, and industry codes",
    notBestFor: "private-company details that are not publicly reported",
    accessUrl: azSearch("Mergent"),
    tags: ["business", "company financials", "finance", "financial statements"],
    priority: 85,
    notes: "Confirm access in A-Z Databases and compare against company filings when available.",
  },
  {
    id: "statista",
    name: "Statista",
    description: "Charts and market/statistical summaries, when available through ZSR.",
    subjectArea: "Data / Statistics",
    bestFor: "quick statistics, market-size context, trend charts, and presentation-friendly figures",
    notBestFor: "deep methodology or peer-reviewed evidence by itself",
    accessUrl: azSearch("Statista"),
    tags: ["statistics", "data", "market", "business", "energy drinks", "cost of living"],
    priority: 78,
    notes: "Use as a lead, then verify methodology and original source.",
  },
  {
    id: "icpsr",
    name: "ICPSR",
    description: "Social-science datasets and survey data, when available through ZSR.",
    subjectArea: "Data / Social Science",
    bestFor: "datasets, surveys, methods sections, and variables for social-science research",
    notBestFor: "short news summaries or market reports",
    accessUrl: azSearch("ICPSR"),
    tags: ["statistics", "datasets", "data", "mental health", "college students", "social science"],
    priority: 82,
    notes: "Check geography, dates, sample, and documentation before using data.",
  },
  {
    id: "factiva",
    name: "Factiva",
    description: "Business and news coverage from many publications, if available through ZSR.",
    subjectArea: "News / Business News",
    bestFor: "current events, business news, international coverage, and publication-specific searching",
    notBestFor: "peer-reviewed scholarship or books",
    accessUrl: azSearch("Factiva"),
    tags: ["news", "current events", "business", "ukraine", "coverage"],
    priority: 86,
    notes: "Use date, location, and publication filters; distinguish news from opinion.",
  },
  {
    id: "proquest-news",
    name: "ProQuest News & Newspapers",
    description: "Newspaper and magazine coverage, if available through ZSR's ProQuest listings.",
    subjectArea: "News",
    bestFor: "news coverage, historical newspaper searching, and source comparison across outlets",
    notBestFor: "peer-reviewed medical or psychology studies",
    accessUrl: azSearch("ProQuest News"),
    tags: ["news", "current events", "ukraine", "newspapers"],
    priority: 78,
    notes: "If the exact database title differs, use A-Z Databases to search ProQuest and News.",
  },
  {
    id: "jstor",
    name: "JSTOR",
    description: "Scholarly archive for humanities and social-science journals, books, and historical scholarship.",
    subjectArea: "Humanities / Social Sciences",
    bestFor: "history, international relations, culture, literature, politics, and older scholarly context",
    notBestFor: "breaking news, current market data, or clinical medical literature",
    accessUrl: azSearch("JSTOR"),
    tags: ["scholarly", "articles", "history", "humanities", "social science", "russia", "poland", "eastern europe", "international relations"],
    priority: 83,
    notes: "Use for scholarly context and citation trails; pair with news databases for recent events.",
  },
  {
    id: "historical-abstracts",
    name: "Historical Abstracts",
    description: "Index of journal articles, books, and dissertations on world history from 1450 onward, excluding the United States and Canada.",
    subjectArea: "World History",
    bestFor: "historical scholarship, print culture, material culture, European history, and historiography outside the U.S. and Canada",
    notBestFor: "U.S. or Canadian history, breaking news, or current social-science data",
    accessUrl: azSearch("Historical Abstracts"),
    tags: ["scholarly", "history", "world history", "europe", "print culture", "book history", "material culture", "manuscript", "almanac"],
    priority: 84,
    notes: "Use subject headings and chronological/geographic filters; for U.S. and Canadian history, use America: History & Life instead.",
  },
  {
    id: "project-muse",
    name: "Project MUSE",
    description: "Full-text scholarly journals and books in the humanities and social sciences.",
    subjectArea: "Humanities / Social Sciences",
    bestFor: "literature, history, cultural studies, book history, and interdisciplinary humanities scholarship",
    notBestFor: "breaking news, market data, or clinical biomedical studies",
    accessUrl: azSearch("Project MUSE"),
    tags: ["scholarly", "articles", "books", "humanities", "history", "literature", "culture", "book history", "print culture"],
    priority: 82,
    notes: "Search two or three core concepts, then use discipline and content-type filters to separate articles from books.",
  },
  {
    id: "proquest-political-science",
    name: "ProQuest Political Science Database",
    description: "Political-science and international-relations database with journals, dissertations, working papers, conference proceedings, country profiles, and political news.",
    subjectArea: "Political Science / International Relations",
    bestFor: "political trust, governance, international relations, public policy, and cross-national political research",
    notBestFor: "case law, statutes, or company market research",
    accessUrl: azSearch("ProQuest Political Science Database"),
    tags: ["scholarly", "articles", "politics", "political science", "international relations", "government", "public trust", "policy", "surveillance"],
    priority: 85,
    notes: "Limit to scholarly journals for academic evidence and use location, date, and document-type filters when relevant.",
  },
  {
    id: "cq-researcher",
    name: "CQ Researcher",
    description: "Issue reports with background, timelines, and policy context, when available through ZSR.",
    subjectArea: "Policy / Current Issues",
    bestFor: "policy memo background, issue framing, timelines, and pro/con context",
    notBestFor: "legal case text or company financials",
    accessUrl: azSearch("CQ Researcher"),
    tags: ["policy", "government", "legal", "background", "current events"],
    priority: 82,
    notes: "Good starting point for policy memos before moving to statutes, reports, and scholarship.",
  },
  {
    id: "heinonline",
    name: "HeinOnline",
    description: "Legal journals and government/legal document collections, if available through ZSR.",
    subjectArea: "Legal / Government",
    bestFor: "law reviews, legal history, government documents, and legal context",
    notBestFor: "breaking news or market share",
    accessUrl: azSearch("HeinOnline"),
    tags: ["legal", "government", "policy", "law"],
    priority: 78,
    notes: "For case-law databases, ask a librarian or check A-Z for the exact Wake Forest access path.",
  },
  {
    id: "primo",
    name: "ZSR Library Search",
    description: "ZSR's catalog/discovery search for books, ebooks, journal records, and catalog leads.",
    subjectArea: "Catalog / Books",
    bestFor: "books, ebooks, background sources, known-item lookup, and citation chaining",
    notBestFor: "specialized database filters or direct full-text guarantees",
    accessUrl: LIBRARY_LINKS.zsrPrimoSearch,
    tags: ["books", "background", "catalog", "general", "full text"],
    priority: 75,
    notes: "Open records to confirm format, availability, and access.",
  },
  {
    id: "research-guides",
    name: "Subject & Course Research Guides",
    description: "Librarian-built guides by subject, course, and discipline.",
    subjectArea: "Guides",
    bestFor: "choosing databases, learning disciplinary search terms, and finding librarian-recommended tools",
    notBestFor: "retrieving one specific article by DOI",
    accessUrl: LIBRARY_LINKS.zsrResearchGuides,
    tags: ["background", "general", "guides", "citation", "education", "business", "statistics"],
    priority: 72,
    notes: "Use when the topic crosses disciplines or the right database is unclear.",
  },
];

const INTENT_RULES = [
  { id: "navigation", label: "ZSR navigation help", pattern: /\b(?:navigate|use|start (?:in|with))\b.{0,24}\bzsr\b|\bwhere (?:do|should|can) i start\b.{0,24}\b(?:zsr|library)\b/i },
  { id: "citation", label: "citation help", pattern: /\b(citat|cite|apa|mla|chicago|bibliograph|zotero)\b/i },
  { id: "fulltext", label: "full-text access help", pattern: /\b(full[-\s]?text|pdf|doi|pmid|pubmed id|access this|find this article)\b/i },
  { id: "market", label: "market or business data", pattern: /\b(market|industry|consumer|brand|retail|company financial|financials|revenue|share|rolex|energy drinks?)\b/i },
  { id: "statistics", label: "statistics or datasets", pattern: /\b(statistics?|dataset|data|prevalence|rates?|survey|cpi|inflation|cost of living|economic indicators?)\b/i },
  { id: "legal", label: "legal or government sources", pattern: /\b(policy|policy memo|legal|law|court|case law|statute|regulation|government|legislation|public policy)\b/i },
  { id: "news", label: "news or current events", pattern: /\b(news|newspaper|coverage|current events?|war in ukraine|ukraine)\b/i },
  { id: "evaluation", label: "source evaluation", pattern: /\b(evaluat|credible|peer[-\s]?reviewed|scholarly source|quality)\b/i },
  { id: "books", label: "books or background sources", pattern: /\b(background|overview|book|ebook|handbook|history of|introduction to)\b/i },
  { id: "scholarly", label: "scholarly articles", pattern: /\b(scholarly|peer[-\s]?reviewed|articles?|journal|literature review|studies|research on)\b/i },
];

const TOPIC_PROFILES = [
  {
    id: "keynesian-neoclassical-economics",
    pattern: /\bkeynesian\b.*\bneoclassical\b|\bneoclassical\b.*\bkeynesian\b/i,
    better: [
      '"Keynesian economics" AND "neoclassical economics"',
      '(Keynesian OR "New Keynesian") AND neoclassical AND macroeconomic*',
      'Keynesian AND neoclassical AND (assumptions OR methodology)',
    ],
    broader: ["history of economic thought", "macroeconomic schools", "economic methodology"],
    narrower: [
      'Keynesian AND neoclassical AND "fiscal policy"',
      'Keynesian AND neoclassical AND unemployment',
      '"New Keynesian" AND neoclassical AND price rigidity',
      'Keynesian AND neoclassical AND "economic crisis"',
    ],
    alternate: ["New Keynesian economics", "general equilibrium", "price rigidity", "aggregate demand", "market clearing"],
    resourceIds: ["econlit", "jstor", "web-of-science", "proquest-research-library"],
  },
  {
    id: "authoritarian-political-leadership-psychology",
    pattern: /\b(?:psycholog|personality|narciss|psychopath|machiavell|dark triad)\w*\b.*\b(?:authoritarian|autocrat|dictator|despot|cruel|powerful|dominant|dominate)\w*\b.*\bleaders?\b|\b(?:authoritarian|autocrat|dictator|despot|cruel|powerful|dominant|dominate)\w*\b.*\bleaders?\b.*\b(?:psycholog|personality|traits?|countries?|regimes?)\w*\b/i,
    better: [
      '"authoritarian leaders" AND (narcissism OR psychopathy OR Machiavellianism)',
      '"political leaders" AND (narcissism OR psychopathy OR Machiavellianism)',
      '"political leadership" AND "dark triad"',
    ],
    broader: ["political psychology", "authoritarian leadership", "political personality"],
    narrower: [
      '"authoritarian leaders" AND psychopathy',
      '"political leaders" AND narcissism',
      'dictator* AND "political personality"',
      'autocrat* AND leadership AND psychology',
    ],
    alternate: ["authoritarian leadership", "political personality", "dark triad", "destructive leadership"],
    resourceIds: ["psycinfo", "proquest-political-science", "socindex", "jstor", "academic-search-premier"],
  },
  {
    id: "surveillance-public-trust",
    pattern: /\b(?:surveillance|survelliance|monitoring)\b.*\b(?:citizens?|public|trust|government|privacy|legitimacy)\b|\b(?:citizens?|public|trust|government|privacy|legitimacy)\b.*\b(?:surveillance|survelliance|monitoring)\b/i,
    better: [
      '"government surveillance" AND "public trust"',
      '(surveillance OR monitoring) AND "trust in government"',
      '"digital surveillance" AND legitimacy',
    ],
    broader: ["government monitoring", "political trust", "privacy and civil liberties"],
    narrower: ["mass surveillance AND institutional trust", "police surveillance AND community trust", "online monitoring AND government legitimacy"],
    alternate: ["state surveillance", "public confidence", "institutional legitimacy", "privacy attitudes"],
    resourceIds: ["socindex", "proquest-political-science", "cq-researcher", "heinonline", "jstor"],
  },
  {
    id: "misinformation-public-trust",
    pattern: /\b(misinformation|disinformation|false information|fake news)\b.*\b(trust|credibility|confidence)\b|\b(trust|credibility|confidence)\b.*\b(misinformation|disinformation|false information|fake news)\b/i,
    better: [
      "misinformation AND \"public trust\"",
      "(misinformation OR disinformation) AND \"institutional trust\"",
      "\"false information\" AND \"trust in media\"",
    ],
    broader: ["disinformation", "media credibility"],
    narrower: [
      "misinformation AND \"trust in government\"",
      "disinformation AND \"news credibility\"",
      "\"social media misinformation\" AND \"public confidence\"",
    ],
    alternate: ["information disorder", "news credibility", "media trust", "institutional confidence"],
    resourceIds: ["communication-mass-media", "socindex", "proquest-political-science", "psycinfo"],
  },
  {
    id: "rolex",
    pattern: /\b(rolex|luxury watch|watches)\b/i,
    better: ["\"luxury watches\" AND \"consumer behavior\"", "\"watch industry\" AND \"market share\"", "Rolex AND \"brand positioning\""],
    broader: ["luxury goods", "consumer behavior", "retail market research", "brand equity"],
    narrower: ["Rolex brand positioning", "Swiss watch market", "luxury resale market", "high-income consumer segments"],
    alternate: ["premium watches", "luxury retail", "brand prestige", "conspicuous consumption"],
    resourceIds: ["mintel", "business-source", "statista", "proquest-research-library"],
  },
  {
    id: "autism",
    pattern: /\b(autism|autistic|asd)\b/i,
    better: ["\"autism spectrum disorder\" AND intervention", "autism AND \"special education\"", "autism AND \"intervention outcomes\""],
    broader: ["neurodevelopmental disorders", "disability studies", "special education", "developmental psychology"],
    narrower: ["early intervention", "inclusive classrooms", "adolescent autism", "autism diagnosis"],
    alternate: ["ASD", "developmental disabilities", "neurodiversity", "educational accommodations"],
    resourceIds: ["psycinfo", "pubmed-medline", "eric", "education-source"],
  },
  {
    id: "cost-living",
    pattern: /\b(cost of living|inflation|consumer prices|cpi)\b/i,
    better: ["\"consumer price index\" AND households", "\"household expenditure\" AND inflation", "\"cost of living\" AND wages"],
    broader: ["inflation", "economic indicators", "household spending", "wage growth"],
    narrower: ["regional CPI", "housing affordability", "food prices", "real wages"],
    alternate: ["consumer prices", "living costs", "personal consumption expenditures", "purchasing power"],
    resourceIds: ["statista", "business-source", "proquest-research-library", "academic-search-premier"],
  },
  {
    id: "biodiversity-climate",
    pattern: /\b(biodiversity|biological diversity|species diversity|ecosystem diversity)\b.*\b(climate change|climate resilience|climate adaptation|climate impacts?|climate mitigation|climate regulation|global warming|climate variability)\b|\b(climate change|climate resilience|climate adaptation|climate impacts?|climate mitigation|climate regulation|global warming|climate variability)\b.*\b(biodiversity|biological diversity|species diversity|ecosystem diversity)\b/i,
    supersedes: ["ecology-environment"],
    better: [
      "biodiversity AND \"climate change\"",
      "(\"biological diversity\" OR \"species diversity\") AND \"climate change\"",
      "biodiversity AND (\"climate regulation\" OR \"carbon sequestration\")",
    ],
    broader: ["biological diversity", "species diversity", "ecosystem diversity"],
    narrower: [
      "biodiversity AND \"climate change\" AND \"carbon sequestration\"",
      "biodiversity AND \"climate change\" AND \"ecosystem resilience\"",
      "\"species diversity\" AND \"climate change\" AND adaptation",
      "biodiversity AND \"climate mitigation\" AND ecosystems",
    ],
    alternate: ["biological diversity", "species diversity", "ecosystem diversity"],
    recovery: {
      narrow: "biodiversity AND \"climate change\" AND \"carbon sequestration\"",
      broaden: "(\"species richness\" OR \"ecosystem diversity\") AND \"climate change\"",
      switchDatabase: "\"ecosystem biodiversity\" AND \"climate regulation\"",
      scholar: "biodiversity AND \"climate mitigation\"",
    },
    resourceQueries: {
      "web-of-science": ["biodiversity AND \"climate change\""],
      "science-direct": ["biodiversity AND (\"climate regulation\" OR \"carbon sequestration\")"],
      "academic-search-premier": ["(\"biological diversity\" OR \"species diversity\") AND \"climate change\""],
      "proquest-research-library": ["biodiversity AND \"climate change\" AND \"ecosystem services\""],
    },
    resourceIds: ["web-of-science", "science-direct", "academic-search-premier"],
  },
  {
    id: "pollinator-conservation",
    pattern: /\b(pollinator|pollination|bee diversity|native bees?)\b/i,
    supersedes: ["ecology-environment"],
    better: ["pollinator* AND biodiversity", "pollinator* AND \"habitat loss\"", "\"urban pollinator\" AND conservation"],
    broader: ["pollinator ecology", "insect biodiversity", "ecosystem services"],
    narrower: ["urban pollinator diversity", "native pollinator conservation", "pollinator habitat restoration"],
    alternate: ["native bees", "pollination ecology", "insect conservation"],
    resourceIds: ["web-of-science", "science-direct", "academic-search-premier"],
  },
  {
    id: "ecology-environment",
    pattern: /\b(ecology|ecological|biodiversity|conservation biology|environmental science)\b/i,
    better: ["ecology AND biodiversity", "biodiversity AND conservation", "\"ecosystem services\" AND biodiversity"],
    broader: ["conservation biology", "environmental science", "ecosystem services"],
    narrower: ["biodiversity AND \"habitat loss\"", "biodiversity AND \"ecosystem resilience\"", "\"species diversity\" AND conservation"],
    alternate: ["species diversity", "ecosystem services", "conservation ecology"],
    resourceIds: ["web-of-science", "science-direct", "academic-search-premier"],
  },
  {
    id: "social-media-mental-health",
    pattern: /\b(social media|instagram|tiktok|snapchat)\b.*\b(mental health|depression|anxiety|well-being|wellbeing|loneliness|body image|sleep|adolescent|teen|youth)\b|\b(mental health|depression|anxiety|well-being|wellbeing|loneliness|body image|sleep|adolescent|teen|youth)\b.*\b(social media|instagram|tiktok|snapchat)\b/i,
    better: ["\"social media\" AND adolescent* AND \"mental health\"", "(Instagram OR TikTok) AND (depression OR anxiety)", "\"social comparison\" AND adolescent* AND well-being"],
    broader: ["media effects", "adolescent development", "digital culture", "public health"],
    narrower: ["\"social media\" AND cyberbullying AND adolescent*", "\"screen time\" AND adolescent* AND sleep", "\"social media\" AND \"body image\" AND teen*", "\"platform use\" AND \"sleep disruption\""],
    alternate: ["online social networking", "platform use", "digital media", "well-being"],
    resourceIds: ["psycinfo", "communication-mass-media", "pubmed-medline", "socindex"],
  },
  {
    id: "protein-disease",
    pattern: /\b(protein folding|protein misfolding|amyloid|prion|neurodegenerative|alzheimer'?s?|biochemistry|molecular biology|genetic mutations?|genetics|biomedical|disease mechanism|pathogenesis)\b|\bprotein\b.*\b(folding|misfolding|disease|genetic|mutation)\b/i,
    better: ["\"protein folding\" AND disease", "\"protein misfolding\" AND pathogenesis", "\"protein folding\" AND (genetics OR mutation*)"],
    broader: ["molecular biology", "biochemistry", "disease mechanisms", "biomedical research"],
    narrower: ["\"amyloid beta\" AND \"protein folding\"", "\"protein aggregation\" AND neurodegenerative disease", "\"familial Alzheimer's disease\" AND mutation*"],
    alternate: ["protein misfolding", "pathogenesis", "molecular mechanisms", "genetic variants"],
    resourceIds: ["pubmed-medline", "web-of-science", "science-direct"],
  },
  {
    id: "ai-cognitive-offloading",
    pattern: /\b(ai|artificial intelligence|generative ai|chatgpt|large language models?|llms?)\b.*\b(cognitive offloading|offloading|memory|metacognition|critical thinking|learning|cognition)\b|\b(cognitive offloading|offloading)\b.*\b(ai|artificial intelligence|generative ai|chatgpt|large language models?|llms?)\b/i,
    better: [
      '"cognitive offloading" AND artificial intelligence',
      '"cognitive offloading" AND generative AI',
      "(ChatGPT OR \"generative AI\") AND cognition AND learning",
    ],
    broader: ["cognitive offloading", "human-computer interaction", "educational technology", "metacognition"],
    narrower: ["\"generative AI\" AND \"student learning\"", "\"AI writing tools\" AND \"cognitive load\"", "ChatGPT AND \"critical thinking\""],
    alternate: ["cognitive load", "metacognition", "human-AI interaction", "distributed cognition"],
    resourceIds: ["psycinfo", "eric", "education-source", "web-of-science"],
  },
  {
    id: "algorithmic-bias",
    pattern: /\b(algorithmic bias|ai bias|facial recognition|automated decision)\b|\b(racial|gender|demographic)\b.*\b(algorithm|artificial intelligence|facial recognition)\b/i,
    better: [
      '"algorithmic bias" AND discrimination',
      '"facial recognition" AND racial bias',
      '("artificial intelligence" OR algorithm*) AND fairness AND discrimination',
    ],
    broader: ["technology ethics", "automated decision making", "AI governance"],
    narrower: [
      '"facial recognition" AND racial discrimination',
      '"algorithmic fairness" AND demographic bias',
      '"automated decision making" AND civil rights',
    ],
    alternate: ["algorithmic fairness", "AI ethics", "automated discrimination", "technology bias"],
    resourceIds: ["socindex", "web-of-science", "proquest-political-science", "psycinfo"],
  },
  {
    id: "sleep-academic-performance",
    pattern: /\b(sleep deprivation|sleep quality|sleep duration)\b.*\b(student|college|university|academic|learning|performance)\b|\b(student|college|university|academic|learning|performance)\b.*\b(sleep deprivation|sleep quality|sleep duration)\b/i,
    better: [
      '"sleep deprivation" AND "academic performance"',
      '"sleep quality" AND "college students" AND learning',
      '"sleep duration" AND students AND achievement',
    ],
    broader: ["student health", "sleep quality", "learning outcomes"],
    narrower: [
      '"sleep deprivation" AND undergraduates AND grades',
      '"sleep quality" AND college students AND cognition',
      'sleep AND academic achievement AND longitudinal',
    ],
    alternate: ["sleep loss", "sleep duration", "academic achievement", "learning outcomes"],
    resourceIds: ["psycinfo", "eric", "education-source", "pubmed-medline", "web-of-science"],
  },
  {
    id: "ai-education",
    pattern: /\b(ai|artificial intelligence|generative ai|chatgpt)\b.*\b(education|school|teaching|learning)\b|\b(education|school|teaching|learning)\b.*\b(ai|artificial intelligence|generative ai|chatgpt)\b/i,
    better: ["\"generative AI\" AND education", "\"artificial intelligence\" AND \"learning outcomes\"", "AI AND \"academic integrity\" AND teaching"],
    broader: ["education technology", "digital learning", "instructional technology", "academic integrity"],
    narrower: ["ChatGPT AND classroom*", "\"AI writing tools\" AND student*", "\"generative AI\" AND \"student learning outcomes\"", "\"artificial intelligence\" AND \"teacher adoption\""],
    alternate: ["edtech", "large language models", "AI literacy", "automated feedback"],
    resourceIds: ["eric", "education-source", "academic-search-premier", "proquest-research-library"],
  },
  {
    id: "college-mental-health-stats",
    pattern: /\b(college|university|student)\b.*\b(mental health|depression|anxiety|well-being|wellbeing|statistics|data)\b/i,
    better: ["\"college students\" AND \"mental health\" AND prevalence", "\"college students\" AND (anxiety OR depression) AND survey", "\"campus mental health\" AND utilization"],
    broader: ["young adult mental health", "higher education health", "public health statistics"],
    narrower: ["undergraduate depression prevalence", "campus counseling utilization", "student anxiety trends"],
    alternate: ["college health survey", "student well-being", "mental health prevalence", "survey data"],
    resourceIds: ["pubmed-medline", "psycinfo", "icpsr", "statista"],
  },
  {
    id: "ukraine-news",
    pattern: /\b(ukraine|war in ukraine|russia ukraine)\b/i,
    better: ["Ukraine AND war AND \"news coverage\"", "Russia AND Ukraine AND \"conflict reporting\"", "Ukraine AND invasion AND newspaper*"],
    broader: ["international news", "foreign policy", "war reporting", "conflict coverage"],
    narrower: ["humanitarian aid Ukraine", "NATO Ukraine", "Ukraine refugees", "energy sanctions"],
    alternate: ["Russia-Ukraine war", "invasion of Ukraine", "Eastern Europe conflict"],
    resourceIds: ["factiva", "proquest-news", "cq-researcher", "proquest-political-science"],
  },
  {
    id: "russia-poland-history",
    pattern: /\b(russia|russian|poland|polish|soviet|eastern europe|central europe|cold war|warsaw pact)\b/i,
    better: ["Russia AND Poland AND relations", "\"Eastern Europe\" AND history", "Soviet AND Polish AND relations"],
    broader: ["European history", "international relations", "borderlands", "nationalism"],
    narrower: ["Cold War Eastern Europe", "Polish Soviet War", "Solidarity movement Poland", "Russia Poland diplomacy"],
    alternate: ["Polish-Russian relations", "Central Europe", "post-Soviet Europe", "Soviet Union"],
    resourceIds: ["historical-abstracts", "jstor", "project-muse", "proquest-political-science"],
  },
  {
    id: "print-culture",
    pattern: /\b(book history|print culture|printing|typograph|watermark|almanac|private(?:ly)? printed|printed ephemera|material culture)\b/i,
    better: [
      "watermark* AND almanac*",
      "(typograph* OR print*) AND almanac*",
      "\"book history\" AND watermark*",
    ],
    broader: ["\"print culture\" AND almanac*", "\"material culture\" AND print*"],
    narrower: [
      "\"paper watermark\" AND almanac*",
      "\"private press\" AND almanac*",
      "bibliograph* AND \"printed ephemera\"",
    ],
    alternate: ["book history", "print culture", "material bibliography", "history of printing"],
    resourceIds: ["historical-abstracts", "jstor", "project-muse", "academic-search-premier"],
  },
  {
    id: "icelandic-saga-transmission",
    pattern: /\b(iceland|icelandic|saga|old norse)\b/i,
    better: [
      "\"Icelandic sagas\" AND manuscript* AND transmission",
      "(saga* OR \"Old Norse\") AND manuscript*",
      "\"textual transmission\" AND Iceland*",
    ],
    broader: ["medieval literature AND manuscript*", "book history AND manuscript*"],
    narrower: [
      "\"medieval Iceland\" AND saga* AND manuscript*",
      "\"Old Norse literature\" AND \"textual transmission\"",
      "codicology AND Iceland* AND saga*",
    ],
    alternate: ["codicology", "textual history", "scribal culture", "manuscript tradition"],
    resourceIds: ["historical-abstracts", "jstor", "project-muse", "academic-search-premier"],
  },
  {
    id: "manuscript-transmission",
    pattern: /\b(manuscript|textual transmission|medieval text|codicology|scribal culture)\b/i,
    better: [
      "\"medieval manuscripts\" AND \"textual transmission\"",
      "codicology AND manuscript* AND transmission",
      "manuscript* AND provenance AND medieval",
    ],
    broader: ["medieval literature AND manuscript*", "book history AND manuscript*"],
    narrower: [
      "scribal culture AND manuscript*",
      "manuscript tradition AND codicology",
      "medieval manuscript* AND provenance",
    ],
    alternate: ["codicology", "textual history", "scribal culture", "manuscript tradition"],
    resourceIds: ["historical-abstracts", "jstor", "project-muse", "academic-search-premier"],
  },
  {
    id: "energy-drinks",
    pattern: /\b(energy drinks?|red bull|monster beverage|beverage market)\b/i,
    better: ["\"energy drinks\" AND \"market share\"", "\"functional beverages\" AND \"consumer trends\"", "\"energy drink\" AND brand AND sales"],
    broader: ["beverage industry", "consumer packaged goods", "functional beverages", "retail sales"],
    narrower: ["\"energy drinks\" AND \"college students\"", "\"caffeinated beverages\" AND market", "\"Red Bull\" AND \"market share\""],
    alternate: ["sports drinks", "ready-to-drink beverages", "caffeinated beverages"],
    resourceIds: ["mintel", "statista", "business-source", "proquest-research-library"],
  },
  {
    id: "company-financials",
    pattern: /\b(company financials?|financial statements?|annual report|10-k|revenue|balance sheet)\b/i,
    better: ["\"financial statements\" AND company", "\"annual report\" AND \"10-K\"", "\"financial ratios\" AND \"company profile\""],
    broader: ["corporate finance", "industry analysis", "public company filings"],
    narrower: ["income statement", "balance sheet", "segment revenue", "SEC filings"],
    alternate: ["company accounts", "financial ratios", "public filings"],
    resourceIds: ["mergent", "business-source", "proquest-research-library"],
  },
  {
    id: "policy-memo",
    pattern: /\b(policy memo|policy brief|public policy|government sources?)\b/i,
    better: ["\"policy brief\" AND evidence", "\"government report\" AND \"policy analysis\"", "policy AND evaluation AND outcomes"],
    broader: ["public policy", "government documents", "issue reports", "legal context"],
    narrower: ["stakeholder impacts", "implementation evidence", "state policy", "federal regulation"],
    alternate: ["policy analysis", "legislative context", "public affairs", "regulatory impact"],
    resourceIds: ["proquest-political-science", "cq-researcher", "heinonline", "jstor"],
  },
];

function cleanQuery(query) {
  return String(query || "").trim().replace(/\s+/g, " ");
}

function uniq(items) {
  return [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
}

const QUERY_STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "among",
  "analyze",
  "around",
  "across",
  "because",
  "between",
  "could",
  "does",
  "find",
  "for",
  "give",
  "have",
  "help",
  "impact",
  "into",
  "in",
  "of",
  "on",
  "looking",
  "navigate",
  "lead",
  "leads",
  "focused",
  "more",
  "need",
  "please",
  "provide",
  "question",
  "research",
  "results",
  "search",
  "show",
  "some",
  "source",
  "sources",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "to",
  "topic",
  "zsr",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
]);

function keywordSearchBase(query) {
  const q = cleanQuery(query);
  if (articleTitleLike(q)) return `"${q.replace(/^"|"$/g, "")}"`;
  const quoted = [...q.matchAll(/"([^"]{3,80})"/g)].map((match) => match[1].trim());
  const words = q
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !QUERY_STOPWORDS.has(word))
    .map((word) => (word === "ai" ? "AI" : word));
  return uniq([...quoted, ...words]).slice(0, 6).join(" ") || q;
}

function researchTopicBody(query) {
  return cleanQuery(query)
    .replace(/^(?:can|could|would|please|help|find|show|give|provide|tell|i need|i want)\b[\s,:-]*/i, "")
    .replace(/^(?:me\s+)?(?:explore|compare|contrast|understand|research|analy[sz]e|investigate|examine)\b[\s,:-]*/i, "")
    .replace(/^(?:the\s+)?(?:differences?|similarities?|comparison|contrast)\s+between\s+/i, "")
    .replace(/^(?:me\s+)?(?:more\s+)?(?:(?:sources?|articles?|research|results?|leads?)\b[\s,:-]*)+/i, "")
    .replace(/^(?:focused on|about|regarding)\s+/i, "")
    .replace(/^(?:the\s+)?relationship\s+between\s+/i, "")
    .replace(/^(?:the\s+)?(?:effects?|impacts?|influence|role)\s+of\s+/i, "")
    .replace(/^(?:how|why|whether)\s+(?:does|do|did|can|could|might|may|is|are)\s+/i, "")
    .replace(/\b(?:affect(?:s|ed|ing)?|influenc(?:e|es|ed|ing)|shape(?:s|d|ing))\b/gi, " and ")
    .replace(/\s+for\s+(?:this|the)\s+(?:research\s+)?topic\b/gi, " ")
    .replace(/\s+(?:and\s+)?(?:suggest|provide|give|show|include)\b[^?.!]*$/i, "")
    .replace(/[?.!]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function genericTopicConcepts(query) {
  const topic = researchTopicBody(query);
  const segments = topic
    .split(/\s+\b(?:and|versus|vs\.?|on|among|across|within|between|for|in)\b\s+/i)
    .map((segment) => keywordSearchBase(segment).split(/\s+/).slice(0, 4).join(" "))
    .filter((segment) => segment && !/^(?:effect|effects|impact|influence|relationship)$/i.test(segment));
  const concepts = uniq(segments).slice(0, 4);
  if (concepts.length >= 2) return concepts;

  const words = keywordSearchBase(topic).split(/\s+/).filter(Boolean);
  if (words.length >= 4) {
    const midpoint = Math.ceil(words.length / 2);
    return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")].filter(Boolean);
  }
  return concepts.length ? concepts : [words.join(" ")].filter(Boolean);
}

function controlledTopicReduction(term) {
  const words = cleanQuery(term).split(/\s+/).filter(Boolean);
  return words.length > 3 ? words.slice(0, Math.max(2, words.length - 2)).join(" ") : cleanQuery(term);
}

function genericBooleanQuery(query) {
  const concepts = genericTopicConcepts(query);
  if (concepts.length >= 2) {
    return concepts.map(booleanConcept).join(" AND ");
  }
  const words = keywordSearchBase(researchTopicBody(query)).split(/\s+/).filter(Boolean);
  return uniq(words).slice(0, 6).map(booleanConcept).join(" AND ");
}

function articleTitleLike(query) {
  const q = cleanQuery(query);
  if (extractDoi(q) || extractPmid(q)) return true;
  if (/^".+"$/.test(q)) return true;
  if (/\b(?:article|paper|book)\s+(?:called|titled|named)\b/i.test(q)) return true;
  if (/\b(?:19|20)\d{2}\b/.test(q) && /\b[A-Z][a-z'’-]+\s+[A-Z]{1,3}\b/.test(q)) return true;
  return false;
}

function activeProfiles(query) {
  const q = cleanQuery(query);
  const matches = TOPIC_PROFILES.filter((profile) => profile.pattern.test(q));
  const supersededIds = new Set(matches.flatMap((profile) => profile.supersedes || []));
  return matches.filter((profile) => !supersededIds.has(profile.id));
}

function queryContainsTerm(query, term) {
  const value = String(query || "").toLowerCase();
  const normalizedTerm = String(term || "").toLowerCase().trim();
  if (!value || !normalizedTerm) return false;
  const pattern = normalizedTerm
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${pattern}(?:$|[^a-z0-9])`, "i").test(value);
}

export function isZsrNavigationRequest(query) {
  const q = cleanQuery(query);
  if (!q) return false;
  return /^(?:please\s+)?(?:help me\s+)?(?:navigate|use)\s+(?:the\s+)?zsr(?:\s+(?:library|website|site))?[?.!]*$/i.test(q) ||
    /^(?:please\s+)?(?:show|tell) me (?:how|where) to (?:start|search) (?:in|with|on) (?:the )?zsr(?: library)?[?.!]*$/i.test(q);
}

export function isSubstantiveResearchRequest(query) {
  const q = cleanQuery(query);
  if (!q || isZsrNavigationRequest(q)) return false;
  if (/^(?:help me research a topic|help me with citations?)[?.!]*$/i.test(q)) return false;
  return keywordSearchBase(q).split(/\s+/).filter(Boolean).length >= 2;
}

export function classifyResearchIntent(query) {
  const q = cleanQuery(query);
  const intents = [];
  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(q)) intents.push({ id: rule.id, label: rule.label });
  }
  if (extractDoi(q) || extractPmid(q) || articleTitleLike(q)) {
    intents.push({ id: "known-item", label: "known article or citation lookup" });
    intents.push({ id: "fulltext", label: "full-text access help" });
  }
  if (!intents.some((intent) => intent.id === "scholarly") && /\b(research|study|impact|effect|relationship|sources?)\b/i.test(q)) {
    intents.push({ id: "scholarly", label: "scholarly articles" });
  }
  if (!intents.length) intents.push({ id: "general", label: "general topic exploration" });
  const seen = new Set();
  return intents.filter((intent) => {
    if (seen.has(intent.id)) return false;
    seen.add(intent.id);
    return true;
  }).slice(0, 4);
}

function resourceScore(resource, intents, profiles, query, subjectFocus) {
  const q = query.toLowerCase();
  let score = resource.priority || 0;
  const profileOrder = uniq(profiles.flatMap((profile) => profile.resourceIds || []));
  const profileIndex = profileOrder.indexOf(resource.id);
  const focusIds = new Set(subjectFocus?.resourceIds || []);
  if (profileIndex >= 0) score += 110 - Math.min(40, profileIndex * 8);
  if (!profiles.length && focusIds.has(resource.id)) {
    score += subjectFocus?.id === "interdisciplinary" ? 18 : 50;
  }
  const intentIds = new Set(intents.map((intent) => intent.id));
  const resourceText = [
    resource.name,
    resource.description,
    resource.subjectArea,
    resource.bestFor,
    ...(resource.tags || []),
  ].join(" ").toLowerCase();
  for (const keyword of subjectFocus?.keywords || []) {
    const term = String(keyword || "").toLowerCase();
    if (term && resourceText.includes(term)) score += 8;
  }
  const directTags = (resource.tags || []).filter((tag) => {
    const term = String(tag || "").toLowerCase();
    return term.length >= 3 &&
      !/^(scholarly|articles|general|background|books|guides)$/.test(term) &&
      queryContainsTerm(q, term);
  });
  if (directTags.length) score += 55 + Math.min(20, (directTags.length - 1) * 10);
  if (intentIds.has("market") && /business|market|company|consumer/.test(resource.tags.join(" "))) score += 35;
  if (intentIds.has("statistics") && /statistics|data|datasets/.test(resource.tags.join(" "))) score += 35;
  if (intentIds.has("news") && /news|current events/.test(resource.tags.join(" "))) score += 35;
  if (intentIds.has("legal") && /legal|government|policy/.test(resource.tags.join(" "))) score += 35;
  if (intentIds.has("books") && /books|background|guides|catalog/.test(resource.tags.join(" "))) score += 30;
  if (intentIds.has("scholarly") && /scholarly|articles/.test(resource.tags.join(" "))) score += 25;
  if (intentIds.has("fulltext") && /full text|doi|pmid|catalog/.test(resource.tags.join(" "))) score += 20;
  if (intentIds.has("citation") && /citation|guides|general/.test(resource.tags.join(" "))) score += 60;
  return score;
}

function resourceIntentMatch(resource, intents) {
  const intentIds = new Set(intents.map((intent) => intent.id));
  const idsByIntent = {
    navigation: ["databases-az", "primo", "research-guides", "ask-a-librarian"],
    market: ["mintel", "business-source", "mergent", "statista", "proquest-research-library"],
    statistics: ["icpsr", "statista", "academic-search-premier"],
    news: ["factiva", "proquest-news", "cq-researcher", "proquest-political-science"],
    legal: ["proquest-political-science", "cq-researcher", "heinonline", "jstor"],
    books: ["primo", "project-muse", "jstor"],
    fulltext: ["pubmed-medline", "primo"],
    citation: ["research-guides"],
  };
  return (
    Object.entries(idsByIntent).some(
      ([intentId, resourceIds]) => intentIds.has(intentId) && resourceIds.includes(resource.id)
    )
  );
}

function resourceQueryMatch(resource, query) {
  return (resource.tags || []).some((tag) => {
    const term = String(tag || "").toLowerCase();
    return term.length >= 4 &&
      !/^(scholarly|articles|general|background|books|guides)$/.test(term) &&
      queryContainsTerm(query, term);
  });
}

const GENERIC_NAVIGATION_RESOURCE_IDS = new Set([
  "databases-az",
  "ask-a-librarian",
  "research-guides",
  "business-guide",
]);

const OTHER_DATABASE_IDS_BY_FOCUS = {
  "biology-health": ["web-of-science", "science-direct", "academic-search-premier", "proquest-research-library"],
  "science-engineering": ["web-of-science", "science-direct", "academic-search-premier", "proquest-research-library"],
  psychology: ["socindex", "academic-search-premier", "proquest-research-library"],
  "communication-media": ["socindex", "academic-search-premier", "proquest-research-library"],
  business: ["business-source", "statista", "proquest-research-library", "academic-search-premier"],
  "history-humanities": ["historical-abstracts", "project-muse", "jstor", "academic-search-premier"],
  education: ["education-source", "academic-search-premier", "proquest-research-library"],
  "policy-law": ["proquest-political-science", "jstor", "academic-search-premier"],
  "data-statistics": ["icpsr", "statista", "academic-search-premier", "proquest-research-library"],
  interdisciplinary: ["academic-search-premier", "proquest-research-library", "jstor"],
};

export function buildGeneralStartingPoints(
  recommendations = [],
  limit = 3,
  subjectFocusId = "interdisciplinary",
  query = ""
) {
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
  if (!safeLimit) return [];
  const recommendedIds = new Set((recommendations || []).map((resource) => resource?.id).filter(Boolean));
  const focus = resolveSubjectFocus(subjectFocusId, query);
  const ids = OTHER_DATABASE_IDS_BY_FOCUS[focus.id] || OTHER_DATABASE_IDS_BY_FOCUS.interdisciplinary;

  return ids
    .filter((id) => !recommendedIds.has(id))
    .map((id) => ZSR_RESOURCE_CONFIG.find((resource) => resource.id === id))
    .filter(Boolean)
    .map((resource) => ({
      ...resource,
      generalStartingPoint: true,
      searchTerms: [],
      filters: [],
      expect: expectForResource(resource),
      caution: resource.notes,
      whyFits: `This is a named secondary database for the ${focus.shortLabel || focus.label} subject focus. It is shown separately because it was not strong enough for the primary shortlist.`,
      nextStep: `Open the exact A-Z entry for ${resource.name}, run the assigned query, and apply the suggested filters.`,
    }))
    .slice(0, safeLimit);
}

export function recommendResources(query, limit = 5, subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID) {
  const q = cleanQuery(query);
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
  if (!safeLimit) return [];
  const subjectFocus = resolveSubjectFocus(subjectFocusId, q);
  const intents = classifyResearchIntent(q);
  const profiles = activeProfiles(q);
  const rankingFocus = subjectFocus.id === "interdisciplinary" && profiles.length
    ? { ...subjectFocus, resourceIds: [], keywords: [] }
    : subjectFocus;
  const profileResourceIds = new Set(profiles.flatMap((profile) => profile.resourceIds || []));
  const focusResourceIds = new Set(rankingFocus.resourceIds || []);
  const ranked = ZSR_RESOURCE_CONFIG
    .map((resource) => ({
      ...resource,
      score: resourceScore(resource, intents, profiles, q, rankingFocus),
      profileMatch: profileResourceIds.has(resource.id),
      focusMatch: focusResourceIds.has(resource.id),
      intentMatch: resourceIntentMatch(resource, intents),
      queryMatch: resourceQueryMatch(resource, q),
      whyFits: whyResourceFits(resource, intents, profiles, rankingFocus),
      searchTerms: [],
      filters: [],
      expect: expectForResource(resource),
      caution: resource.notes,
      nextStep: nextStepForResource(resource, q),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  if (isZsrNavigationRequest(q)) {
    const navigationOrder = ["databases-az", "primo", "research-guides", "ask-a-librarian"];
    return navigationOrder
      .map((id) => ranked.find((resource) => resource.id === id))
      .filter(Boolean)
      .slice(0, safeLimit);
  }

  if (/\b(citat|cite|apa|mla|chicago|bibliograph|zotero)\b/i.test(q) &&
      !/\b(research|study|sources?|articles?|books?|topic)\b/i.test(q)) {
    return ranked.filter((resource) => resource.id === "research-guides").slice(0, safeLimit);
  }

  const intentIds = new Set(intents.map((intent) => intent.id));
  const topicEligible = ranked.filter((resource) => {
    if (GENERIC_NAVIGATION_RESOURCE_IDS.has(resource.id)) return false;
    if (resource.id === "primo") {
      return intentIds.has("books") || intentIds.has("known-item") || intentIds.has("fulltext");
    }
    return true;
  });

  const profileResources = topicEligible.filter((resource) => resource.profileMatch);
  const uncoveredIntents = profiles.length
    ? intents.filter((intent) => !profileResources.some((resource) => resourceIntentMatch(resource, [intent])))
    : [];
  const useful = topicEligible.filter((resource) =>
    profiles.length
      ? resource.profileMatch || resourceIntentMatch(resource, uncoveredIntents)
      : resource.focusMatch || resource.intentMatch || resource.queryMatch
  );

  if (useful.length) return useful.slice(0, safeLimit);

  const fallbackIds = uniq([
    ...(rankingFocus.resourceIds || []),
    "academic-search-premier",
    "proquest-research-library",
    "jstor",
  ]);
  return topicEligible.filter((resource) => fallbackIds.includes(resource.id)).slice(0, Math.min(safeLimit, 3));
}

function whyResourceFits(resource, intents, profiles, subjectFocus) {
  const profileMatch = profiles.find((profile) => profile.resourceIds?.includes(resource.id));
  if (profileMatch) return `This fits because the topic maps to ${resource.subjectArea.toLowerCase()} research rather than only a literal keyword search.`;
  if (subjectFocus?.resourceIds?.includes(resource.id)) {
    return `This fits the ${subjectFocus.shortLabel || subjectFocus.label} subject focus and is grounded in the local ZSR resource config.`;
  }
  const intentLabel = intents[0]?.label || "this research need";
  return `This fits the ${intentLabel} path and is grounded in the local ZSR resource config.`;
}

function expectForResource(resource) {
  if (/Market|Business|Company/.test(resource.subjectArea)) return "Reports, trade articles, company context, or market indicators rather than a single perfect article.";
  if (/News/.test(resource.subjectArea)) return "News stories and publication-level coverage that should be compared across outlets.";
  if (/Data|Statistics/.test(resource.subjectArea)) return "Summary statistics or datasets that need methodology checks before citing.";
  if (/Legal|Policy/.test(resource.subjectArea)) return "Policy reports, legal commentary, government context, or issue overviews.";
  if (/Catalog|Books|Guides/.test(resource.subjectArea)) return "Background sources, book records, guides, and citation trails.";
  return "Scholarly articles and subject-specific leads that still need source evaluation.";
}

function nextStepForResource(resource, query) {
  if (resource.id === "primo") return "Search ZSR Library Search, then open records to confirm format, availability, and related subjects.";
  if (resource.accessUrl?.includes("az.php")) return `Open the exact A-Z result for ${resource.name}, then run the assigned query inside that database.`;
  return `Open ${resource.name} and test one focused search before broadening.`;
}

export function buildSearchStrategy(query, subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID) {
  const q = cleanQuery(query);
  if (isZsrNavigationRequest(q)) {
    return {
      isKnownItem: false,
      betterTerms: [],
      broaderTerms: [],
      narrowerTerms: [],
      alternateTerms: [],
      likelyDatabaseCategories: ["Database directory", "Catalog / Books", "Guides", "Research support"],
      links: {
        googleScholar: LIBRARY_LINKS.googleScholarSearch,
        zsrCatalog: LIBRARY_LINKS.zsrPrimoSearch,
        zsrArticles: LIBRARY_LINKS.zsrArticleSearch,
      },
    };
  }
  const subjectFocus = resolveSubjectFocus(subjectFocusId, q);
  const profiles = activeProfiles(q);
  const keywordBase = keywordSearchBase(q);
  const profileTerms = profiles.length
    ? profiles
    : [{
        better: [genericBooleanQuery(q) || keywordBase],
        broader: [],
        narrower: [],
        alternate: [],
        resourceIds: ["academic-search-premier", "proquest-research-library", "jstor"],
      }];
  const betterTerms = uniq(profileTerms.flatMap((profile) => profile.better)).slice(0, 5);
  const focusTerms = subjectFocus.id === "interdisciplinary" ? [] : (subjectFocus.keywords || []).slice(0, 3);
  const broaderTerms = uniq([...profileTerms.flatMap((profile) => profile.broader), ...focusTerms]).slice(0, 5);
  const narrowerTerms = uniq(profileTerms.flatMap((profile) => profile.narrower)).slice(0, 5);
  const alternateTerms = uniq(profileTerms.flatMap((profile) => profile.alternate)).slice(0, 5);
  const exactQuery = articleTitleLike(q) ? `"${q.replace(/^"|"$/g, "")}"` : q;
  return {
    isKnownItem: articleTitleLike(q),
    betterTerms,
    broaderTerms,
    narrowerTerms,
    alternateTerms,
    likelyDatabaseCategories: uniq(recommendResources(q, 5, subjectFocus.selectedId || subjectFocus.id).map((resource) => resource.subjectArea)).slice(0, 5),
    links: {
      googleScholar: fillTemplate(LIBRARY_LINKS.googleScholarSearch, exactQuery),
      zsrCatalog: fillTemplate(LIBRARY_LINKS.zsrPrimoSearch, exactQuery),
      zsrArticles: fillTemplate(LIBRARY_LINKS.zsrArticleSearch, exactQuery),
    },
  };
}

function normalizeSearchCandidate(term) {
  let value = cleanQuery(term)
    .replace(/^[\s\-*\d.)]+/, "")
    .replace(/^(?:try|search(?:\s+for)?|look(?:\s+for)?|use|keywords?|search terms?)\s*:\s*/i, "");
  if (!value) return "";
  const words = value.split(/\s+/);
  const sentenceLike =
    /\?$/i.test(value) ||
    /^(?:can|could|would|should|how|why|what|where|when|who|help|find|show|give|provide|tell)\b/i.test(value) ||
    /\b(?:i am|i'm|i need|we need|you should|can you|could you)\b/i.test(value);
  if (sentenceLike || words.length > 14) value = keywordSearchBase(value);
  return cleanQuery(value).replace(/[?.!]+$/, "");
}

function booleanParts(term) {
  return cleanQuery(term)
    .split(/\s+(?:AND|OR)\s+/i)
    .map((part) => part.replace(/^[()\s]+|[()\s]+$/g, "").trim())
    .filter(Boolean);
}

function comparableTerm(term) {
  return String(term || "")
    .toLowerCase()
    .replace(/["'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSearchOptionKey(term) {
  const normalized = String(term || "")
    .toLowerCase()
    .replace(/[“”"'`()\[\]{}]/g, " ")
    .replace(/\b(?:and|or|not)\b/g, (operator) => ` ${operator} `)
    .replace(/[^a-z0-9*\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";

  return normalized
    .split(/\s+and\s+/)
    .map((andPart) =>
      andPart
        .split(/\s+or\s+/)
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .sort()
        .join(" or ")
    )
    .filter(Boolean)
    .sort()
    .join(" and ");
}

function uniqueSearchOptions(items, excludedKeys = new Set()) {
  const seen = new Set(excludedKeys);
  const seenOptions = [...excludedKeys]
    .map((key) => {
      const normalized = normalizeSearchOptionKey(key);
      return {
        key: normalized,
        tokens: new Set(
          normalized
            .split(/\s+/)
            .filter((token) => token && !/^(?:and|or|not)$/.test(token))
        ),
      };
    })
    .filter(({ tokens }) => tokens.size > 0);
  const result = [];
  for (const item of items || []) {
    const value = normalizeSearchCandidate(item);
    const key = normalizeSearchOptionKey(value);
    const tokens = new Set(
      key.split(/\s+/).filter((token) => token && !/^(?:and|or|not)$/.test(token))
    );
    const nearDuplicate = seenOptions.some((existing) => {
      const smaller = existing.tokens.size <= tokens.size ? existing.tokens : tokens;
      const larger = existing.tokens.size <= tokens.size ? tokens : existing.tokens;
      if (!smaller.size) return false;
      const isSubset = [...smaller].every((token) => larger.has(token));
      return isSubset && (existing.key.includes(" or ") || key.includes(" or "));
    });
    if (!value || !key || seen.has(key) || nearDuplicate) continue;
    seen.add(key);
    seenOptions.push({ key, tokens });
    result.push(value);
  }
  return result;
}

function booleanConcept(term) {
  const value = cleanQuery(term);
  if (!value) return "";
  if (/^["(].*[\")]/.test(value) || /\s+(?:AND|OR)\s+/i.test(value)) return value;
  return value.split(/\s+/).length > 1 ? `"${value}"` : value;
}

function controlledBroaden(strategy, hasProfile) {
  const base = strategy.betterTerms[0] || "";
  if (!base) return "";
  if (!hasProfile) {
    return controlledTopicReduction(base);
  }

  const baseParts = booleanParts(base);
  const broad =
    strategy.broaderTerms.find((candidate) =>
      !baseParts.some((part) => comparableTerm(part) === comparableTerm(candidate))
    ) || strategy.broaderTerms[0];
  if (!broad) return base;
  const anchor = [...baseParts]
    .filter((part) => comparableTerm(part) !== comparableTerm(broad))
    .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length)[0];
  if (!anchor) return base;
  return `${booleanConcept(broad)} AND ${booleanConcept(anchor)}`;
}

function anchoredSynonymSearch(strategy, suppliedAlternates = null) {
  const base = strategy.betterTerms[0] || "";
  const alternates = uniqueSearchOptions(suppliedAlternates || strategy.alternateTerms).slice(0, 2);
  const baseParts = booleanParts(base);
  if (!baseParts.length || !alternates.length) return "";

  const alternateWords = new Set(
    normalizeSearchOptionKey(alternates.join(" "))
      .split(/\s+/)
      .filter((word) => word.length > 3)
  );
  const anchor = [...baseParts]
    .map((part) => ({
      part,
      overlap: normalizeSearchOptionKey(part)
        .split(/\s+/)
        .filter((word) => alternateWords.has(word)).length,
    }))
    .sort((a, b) => a.overlap - b.overlap || b.part.length - a.part.length)[0]?.part;
  if (!anchor) return "";
  return `${booleanConcept(anchor)} AND (${alternates.map(booleanConcept).join(" OR ")})`;
}

function queryLimiters(query, base) {
  const value = cleanQuery(query);
  const baseComparable = comparableTerm(base);
  const patterns = [
    /\bolder adults?\b/i,
    /\bcollege students?\b/i,
    /\buniversity students?\b/i,
    /\badolescents?\b/i,
    /\bteenagers?\b/i,
    /\bchildren\b/i,
    /\bwomen\b/i,
    /\bmen\b/i,
    /\bdementia\b/i,
    /\bNorth Carolina\b/i,
    /\bUnited States\b/i,
  ];
  return uniq(
    patterns
      .map((pattern) => value.match(pattern)?.[0] || "")
      .filter((term) => term && !baseComparable.includes(comparableTerm(term)))
  ).slice(0, 2);
}

const FOCUS_QUERY_QUALIFIERS = {
  "biology-health": ["systematic review", "disease mechanism", "health outcomes", "population study", "longitudinal study", "case study"],
  "science-engineering": ["experimental study", "performance", "application", "systematic review", "comparative study", "case study"],
  psychology: ["empirical study", "behavior", "cognition", "longitudinal study", "qualitative study", "systematic review"],
  "communication-media": ["media effects", "audience", "content analysis", "discourse analysis", "comparative study", "case study"],
  economics: ["economic theory", "empirical evidence", "policy analysis", "comparative analysis", "economic history", "literature review"],
  business: ["consumer behavior", "market trends", "industry analysis", "case study", "comparative study", "forecast"],
  "history-humanities": ["historical context", "primary sources", "cultural analysis", "historiography", "comparative study", "case study"],
  education: ["students", "learning outcomes", "higher education", "empirical study", "longitudinal study", "systematic review"],
  "policy-law": ["policy analysis", "regulation", "stakeholders", "implementation", "comparative policy", "case study"],
  "data-statistics": ["dataset", "prevalence", "trend", "survey", "longitudinal study", "comparative study"],
  interdisciplinary: ["systematic review", "empirical study", "comparative study", "case study", "longitudinal study", "qualitative study"],
};

const RESOURCE_QUERY_QUALIFIERS = {
  "academic-search-premier": ["empirical study", "systematic review"],
  "proquest-research-library": ["literature review", "case study"],
  econlit: ["economic theory", "empirical evidence"],
  psycinfo: ["cognition", "behavior"],
  "communication-mass-media": ["media effects", "audience"],
  "pubmed-medline": ["systematic review", "health outcomes"],
  "web-of-science": ["systematic review", "comparative study"],
  "science-direct": ["experimental study", "mechanism"],
  socindex: ["social context", "inequality"],
  eric: ["students", "learning outcomes"],
  "education-source": ["higher education", "pedagogy"],
  mintel: ["consumer trends", "market forecast"],
  "business-source": ["industry analysis", "consumer behavior"],
  mergent: ["company profile", "financial performance"],
  statista: ["statistics", "trend"],
  icpsr: ["dataset", "survey"],
  factiva: ["news coverage", "current events"],
  "proquest-news": ["newspaper coverage", "news reporting"],
  jstor: ["historical context", "theory"],
  "historical-abstracts": ["historiography", "historical context"],
  "project-muse": ["cultural analysis", "humanities"],
  "proquest-political-science": ["policy analysis", "governance"],
  "cq-researcher": ["policy debate", "current issues"],
  heinonline: ["legal analysis", "regulation"],
  primo: ["books", "background"],
};

function appendSearchQualifier(base, qualifier) {
  const baseKey = normalizeSearchOptionKey(base);
  const qualifierKey = normalizeSearchOptionKey(qualifier);
  if (!baseKey || !qualifierKey) return "";
  const baseTokens = new Set(baseKey.split(/\s+/));
  const qualifierTokens = qualifierKey.split(/\s+/).filter((token) => !/^(?:and|or|not)$/.test(token));
  if (qualifierTokens.length && qualifierTokens.every((token) => baseTokens.has(token))) return "";
  return `${base} AND ${booleanConcept(qualifier)}`;
}

function genericSearchVariants(query, subjectFocusId) {
  const base = genericBooleanQuery(query);
  if (!base) return [];
  const focus = resolveSubjectFocus(subjectFocusId, query);
  const qualifiers = uniq([
    ...(FOCUS_QUERY_QUALIFIERS[focus.id] || []),
    ...FOCUS_QUERY_QUALIFIERS.interdisciplinary,
  ]);
  const concepts = genericTopicConcepts(query);
  const boundedConceptPairs = concepts.length >= 3
    ? [
        concepts.slice(0, 2).map(booleanConcept).join(" AND "),
        [concepts[0], concepts[concepts.length - 1]].map(booleanConcept).join(" AND "),
      ]
    : [];
  return uniqueSearchOptions([
    base,
    ...qualifiers.map((qualifier) => appendSearchQualifier(base, qualifier)),
    ...boundedConceptPairs,
  ]);
}

function resourceSpecificSearches(resource, query, subjectFocusId) {
  const profiles = activeProfiles(query);
  if (profiles.length) {
    return uniqueSearchOptions(
      profiles.flatMap((profile) => profile.resourceQueries?.[resource.id] || [])
    );
  }
  const base = genericBooleanQuery(query);
  const focus = resolveSubjectFocus(subjectFocusId, query);
  const qualifiers = RESOURCE_QUERY_QUALIFIERS[resource.id] ||
    FOCUS_QUERY_QUALIFIERS[focus.id] ||
    FOCUS_QUERY_QUALIFIERS.interdisciplinary;
  return uniqueSearchOptions(qualifiers.map((qualifier) => appendSearchQualifier(base, qualifier)));
}

export function buildSearchTermSuggestions(
  query,
  candidates = [],
  subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID,
  limit = 8
) {
  const q = cleanQuery(query);
  if (!q || isZsrNavigationRequest(q)) return [];
  const strategy = buildSearchStrategy(q, subjectFocusId);
  const profiles = activeProfiles(q);
  const hasProfile = profiles.length > 0;
  const genericVariants = !hasProfile && !strategy.isKnownItem
    ? genericSearchVariants(q, subjectFocusId)
    : [];
  const focus = resolveSubjectFocus(subjectFocusId, q);
  const profileVariants = hasProfile && !strategy.isKnownItem
    ? uniq([
        ...(FOCUS_QUERY_QUALIFIERS[focus.id] || []),
        ...FOCUS_QUERY_QUALIFIERS.interdisciplinary,
      ]).map((qualifier) => appendSearchQualifier(strategy.betterTerms[0], qualifier))
    : [];
  const synonymSwap = hasProfile ? anchoredSynonymSearch(strategy) : "";
  const base = strategy.betterTerms[0] || keywordSearchBase(q);
  const limiterSearches = queryLimiters(q, base).map(
    (limiter) => `${base} AND ${booleanConcept(limiter)}`
  );
  const anchoredAlternates = strategy.alternateTerms
    .slice(0, 4)
    .map((alternate) => anchoredSynonymSearch(strategy, [alternate]));
  return uniqueSearchOptions([
    ...strategy.betterTerms,
    ...genericVariants,
    ...limiterSearches,
    ...strategy.narrowerTerms,
    synonymSwap,
    ...anchoredAlternates,
    hasProfile ? controlledBroaden(strategy, true) : "",
    ...profileVariants,
    ...candidates,
  ])
    .filter((term) => term.split(/\s+/).length >= 2 || /\b(?:doi|pmid)\b/i.test(term))
    .slice(0, limit);
}

const RESOURCE_FILTERS = {
  "academic-search-premier": ["Peer reviewed", "Subject terms", "Publication date"],
  "proquest-research-library": ["Scholarly journals", "Subject", "Publication date"],
  econlit: ["Subject descriptors", "Publication type", "Classification code", "Publication date"],
  psycinfo: ["APA Thesaurus subject", "Population or age group", "Methodology", "Peer reviewed"],
  "communication-mass-media": ["Communication subject", "Peer reviewed", "Publication date"],
  "pubmed-medline": ["MeSH terms", "Article type", "Age", "Publication date"],
  "web-of-science": ["Research area", "Document type", "Publication year", "Cited by"],
  "science-direct": ["Review or research article", "Subject area", "Publication year"],
  socindex: ["Subject terms", "Peer reviewed", "Population", "Publication date"],
  eric: ["ERIC descriptors", "Education level", "Publication type", "Peer reviewed"],
  "education-source": ["Subject terms", "Education level", "Peer reviewed", "Publication date"],
  mintel: ["Market sector", "Geography", "Report date"],
  "business-source": ["Industry", "Geography", "Source type", "Publication date"],
  mergent: ["Company", "Industry code", "Financial period"],
  statista: ["Geography", "Industry", "Date", "Original source"],
  icpsr: ["Geography", "Time period", "Unit of analysis", "Study type"],
  factiva: ["Source", "Region", "Date", "Content type"],
  "proquest-news": ["Publication", "Location", "Date", "Document type"],
  jstor: ["Discipline", "Content type", "Publication date", "Language"],
  "historical-abstracts": ["Subject heading", "Geography", "Historical period", "Document type"],
  "project-muse": ["Research area", "Journal article or book", "Publication date"],
  "proquest-political-science": ["Scholarly journals", "Location", "Document type", "Publication date"],
  "cq-researcher": ["Issue date", "Topic", "Pro/con or chronology section"],
  heinonline: ["Collection", "Jurisdiction", "Date", "Document type"],
  primo: ["Resource type", "Subject", "Publication date", "Availability"],
};

const RESOURCE_QUERY_HINTS = {
  econlit: /econom|keynes|neoclass|macroeconom|microeconom|fiscal|monetary|political economy/i,
  psycinfo: /cognit|psycholog|mental|behavio|attitude|well-being|depress|anxiety|trust/i,
  "communication-mass-media": /media|platform|communication|digital|news|audience/i,
  "pubmed-medline": /health|disease|clinical|pathogenesis|protein|prevalence|mortality|genetic/i,
  "web-of-science": /science|citation|protein|ecolog|cognit|biodiversity/i,
  "science-direct": /protein|molecular|biochem|disease|ecolog|biodiversity/i,
  socindex: /social|trust|institution|community|inequal|adolescent|public/i,
  eric: /student|education|learning|classroom|teacher|school/i,
  "education-source": /student|education|learning|classroom|teacher|school|policy/i,
  mintel: /consumer|market|brand|retail|sales|trend/i,
  "business-source": /industry|company|consumer|market|brand|financial/i,
  mergent: /company|financial|revenue|ratio|annual report|10-k/i,
  statista: /statistic|market|rate|trend|prevalence|share/i,
  icpsr: /survey|dataset|prevalence|population|student|social/i,
  factiva: /news|coverage|reporting|war|company/i,
  "proquest-news": /news|newspaper|coverage|reporting|invasion/i,
  jstor: /history|culture|humanities|politic|social|print|book/i,
  "historical-abstracts": /history|historical|print|book|almanac|watermark|soviet/i,
  "project-muse": /culture|humanities|history|literature|print|book/i,
  "proquest-political-science": /policy|politic|government|trust|surveillance|international/i,
  "cq-researcher": /policy|issue|government|current|regulation/i,
  heinonline: /law|legal|government|policy|regulation|surveillance/i,
};

function filtersForResource(resource) {
  return RESOURCE_FILTERS[resource.id] || ["Subject", "Source type", "Publication date"];
}

function resourceQueryScore(resource, term, position) {
  let score = Math.max(0, 30 - position);
  const hint = RESOURCE_QUERY_HINTS[resource.id];
  if (hint?.test(term)) score += 35;
  const value = normalizeSearchOptionKey(term);
  for (const tag of resource.tags || []) {
    const tagKey = normalizeSearchOptionKey(tag);
    if (tagKey.length >= 4 && value.includes(tagKey)) score += 8;
  }
  return score;
}

function assignResourceSearchInstructions(
  resources,
  query,
  subjectFocusId,
  usedKeys = new Set()
) {
  if (isZsrNavigationRequest(query)) return resources;
  const candidates = buildSearchTermSuggestions(query, [], subjectFocusId, 20);
  const used = new Set(usedKeys);

  return resources.map((resource) => {
    const preferred = uniqueSearchOptions(
      resourceSpecificSearches(resource, query, subjectFocusId),
      used
    );
    const source = preferred.length ? preferred : uniqueSearchOptions(candidates, used);
    const available = source
      .map((term, position) => ({ term, position, score: resourceQueryScore(resource, term, position) }))
      .sort((a, b) => b.score - a.score || a.position - b.position);
    const selected = available[0]?.term || "";
    if (selected) used.add(normalizeSearchOptionKey(selected));
    return {
      ...resource,
      searchTerms: selected ? [selected] : [],
      filters: filtersForResource(resource),
    };
  });
}

export function buildCatalogKeywordQuery(query, subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID) {
  return buildCatalogSearchQueries(query, subjectFocusId, 1)[0] || keywordSearchBase(query);
}

export function buildCatalogSearchQueries(
  query,
  subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID,
  limit = 6
) {
  const q = cleanQuery(query);
  if (!q || isZsrNavigationRequest(q)) return [];
  const strategy = buildSearchStrategy(q, subjectFocusId);
  const profiles = activeProfiles(q);
  const hasProfile = profiles.length > 0;
  const concepts = genericTopicConcepts(q);
  const broadConcepts = (hasProfile ? [] : concepts)
    .map(booleanConcept)
    .filter(Boolean);
  const boundedPairs = !hasProfile && concepts.length >= 2
    ? [
        concepts.slice(0, 2).map(booleanConcept).join(" AND "),
        [concepts[0], concepts[concepts.length - 1]].map(booleanConcept).join(" AND "),
      ]
    : [];

  return uniqueSearchOptions([
    ...strategy.betterTerms,
    ...boundedPairs,
    ...strategy.narrowerTerms,
    ...strategy.broaderTerms.map(booleanConcept),
    ...buildSearchTermSuggestions(q, [], subjectFocusId, 12),
    ...broadConcepts,
  ]).slice(0, Math.max(1, Math.floor(Number(limit) || 1)));
}

export function buildFallbackSearches(
  query,
  subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID,
  { excludedTerms = [], resources: suppliedResources = [] } = {}
) {
  const q = cleanQuery(query);
  if (isZsrNavigationRequest(q)) {
    return [
      { label: "Find scholarly articles", text: "Choose a subject in A-Z Databases, then search 2-3 topic concepts.", href: AZ },
      { label: "Find books or background", text: "Use ZSR Library Search for books, ebooks, handbooks, and known titles.", href: fillTemplate(LIBRARY_LINKS.zsrPrimoSearch, "") },
      { label: "Choose tools for a subject", text: "Open a Subject & Course Research Guide for librarian-selected databases and search advice.", href: LIBRARY_LINKS.zsrResearchGuides },
      { label: "Get personalized help", text: "Ask ZSR and share your topic, assignment, source type, and searches already tried.", href: LIBRARY_LINKS.zsrAsk },
    ];
  }
  const strategy = buildSearchStrategy(q, subjectFocusId);
  const profiles = activeProfiles(q);
  const hasProfile = profiles.length > 0;
  const recovery = profiles.find((profile) => profile.recovery)?.recovery || {};
  const excluded = new Set(excludedTerms.map(normalizeSearchOptionKey).filter(Boolean));
  const used = new Set(excluded);
  const resources = suppliedResources.length
    ? suppliedResources
    : recommendResources(q, 4, subjectFocusId);
  const genericVariants = hasProfile ? [] : genericSearchVariants(q, subjectFocusId);
  const candidatePool = uniqueSearchOptions([
    ...strategy.narrowerTerms,
    ...(hasProfile ? [controlledBroaden(strategy, true), anchoredSynonymSearch(strategy)] : []),
    ...genericVariants,
    ...buildSearchTermSuggestions(q, [], subjectFocusId, 20),
  ]);

  const take = (preferred = []) => {
    const choices = uniqueSearchOptions([...preferred, ...candidatePool], used);
    const selected = choices[0] || "";
    if (selected) used.add(normalizeSearchOptionKey(selected));
    return selected;
  };

  const genericBaseKey = normalizeSearchOptionKey(genericBooleanQuery(q));
  const genericNarrowers = genericVariants.filter(
    (term) => normalizeSearchOptionKey(term) !== genericBaseKey
  );
  const narrowQuery = take(hasProfile ? [recovery.narrow, ...strategy.narrowerTerms] : genericNarrowers);
  const genericConcepts = genericTopicConcepts(q);
  const boundedBroaden = !hasProfile && genericConcepts.length >= 3
    ? genericConcepts.slice(0, 2).map(booleanConcept).join(" AND ")
    : "";
  const broadenQuery = hasProfile
    ? take([recovery.broaden, controlledBroaden(strategy, true), anchoredSynonymSearch(strategy)])
    : boundedBroaden
      ? take([boundedBroaden])
      : "";
  const switchQuery = take([recovery.switchDatabase]);
  const scholarQuery = take([recovery.scholar]);
  const namedDatabases = resources.filter((resource) => !GENERIC_NAVIGATION_RESOURCE_IDS.has(resource.id));
  const subjectDatabase = namedDatabases[0];
  const nextDatabase = namedDatabases[1] || namedDatabases[0];
  const fallbacks = [];

  if (narrowQuery) {
    fallbacks.push({
      label: "Too many irrelevant results? Add one precise limiter",
      text: narrowQuery,
      query: narrowQuery,
      href: nextDatabase?.accessUrl || fillTemplate(LIBRARY_LINKS.zsrArticleSearch, narrowQuery),
    });
  } else {
    fallbacks.push({
      label: "Too many irrelevant results? Add one limiter",
      text: "Keep the two core concepts, then add one population, place, date range, outcome, or method from the assignment.",
    });
  }
  if (broadenQuery) {
    fallbacks.push({
      label: "Too few results? Broaden one concept but keep the topic anchored",
      text: broadenQuery,
      query: broadenQuery,
      href: nextDatabase?.accessUrl || fillTemplate(LIBRARY_LINKS.zsrArticleSearch, broadenQuery),
    });
  } else {
    fallbacks.push({
      label: "Too few results? Remove only one limiter",
      text: "Keep both core topic concepts; remove only a population, place, date, or method term, then rerun the search.",
    });
  }
  if (nextDatabase && switchQuery) {
    fallbacks.push({
      label: `Switch databases and rerun in ${nextDatabase.name}`,
      text: switchQuery,
      query: switchQuery,
      href: nextDatabase.accessUrl,
    });
  }
  if (scholarQuery) {
    fallbacks.push({
      label: "Try a distinct keyword search in Google Scholar",
      text: scholarQuery,
      query: scholarQuery,
      href: fillTemplate(LIBRARY_LINKS.googleScholarSearch, scholarQuery),
    });
  }
  if (subjectDatabase) {
    fallbacks.push({
      label: `Reuse subject headings from ${subjectDatabase.name}`,
      text: "Open one relevant record, copy its most specific subject heading, and combine that heading with one core topic concept.",
      href: subjectDatabase.accessUrl,
    });
  }
  fallbacks.push({
    label: "Use citation chaining after one strong result",
    text: "Open its references for earlier research and its cited-by list for newer research.",
    href: fillTemplate(LIBRARY_LINKS.googleScholarSearch, strategy.betterTerms[0] || keywordSearchBase(q)),
  });
  return fallbacks;
}

export function buildFullTextWorkflow(query) {
  const q = cleanQuery(query);
  const doi = extractDoi(q);
  const pmid = extractPmid(q);
  const shouldShow = Boolean(doi || pmid || articleTitleLike(q) || /\b(full[-\s]?text|pdf|doi|pmid|article title|citation)\b/i.test(q));
  if (!shouldShow) return null;
  return {
    doi,
    pmid,
    titleOrCitation: !doi && !pmid ? q : "",
    installLink: LIBKEY_NOMAD_URL,
    guidance: [
      "Install LibKey Nomad and choose Wake Forest University as your library.",
      "Use DOI, PMID, or the exact article title when searching.",
      "If full text does not appear, try ZSR Library Search, Google Scholar, or ZSR Delivers.",
    ],
    links: [
      ...(doi || pmid ? [{ label: "Try LibKey lookup", url: libkeyUrl({ doi, pmid }) }] : []),
      { label: "Search Google Scholar", url: fillTemplate(LIBRARY_LINKS.googleScholarSearch, doi || pmid || q) },
      { label: "Search ZSR", url: fillTemplate(LIBRARY_LINKS.zsrPrimoSearch, doi || pmid || q) },
      { label: "ZSR Delivers / ILL", url: LIBRARY_LINKS.zsrDelivers },
    ],
  };
}

export function selectCitationGuides(query) {
  const q = cleanQuery(query);
  const guides = [];
  if (/\bapa\b/i.test(q)) guides.push(CITATION_GUIDES.find((guide) => guide.id === "apa"));
  if (/\bmla\b/i.test(q)) guides.push(CITATION_GUIDES.find((guide) => guide.id === "mla"));
  if (/\bchicago\b/i.test(q)) guides.push(CITATION_GUIDES.find((guide) => guide.id === "chicago"));
  if (/\bzotero|citation management|bibliography manager\b/i.test(q)) guides.push(CITATION_GUIDES.find((guide) => guide.id === "zotero"));
  guides.push(CITATION_GUIDES.find((guide) => guide.id === "general-citation"));
  return uniq(guides.filter(Boolean).map((guide) => guide.id))
    .map((id) => CITATION_GUIDES.find((guide) => guide.id === id))
    .slice(0, 3);
}

export function buildResearchPlan(query, limit = 5, subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID) {
  const q = cleanQuery(query);
  const navigationOnly = isZsrNavigationRequest(q);
  const subjectFocus = resolveSubjectFocus(subjectFocusId, q);
  const effectiveFocusId = subjectFocus.selectedId || subjectFocus.id;
  const intents = classifyResearchIntent(q);
  const strategy = buildSearchStrategy(q, effectiveFocusId);
  const rawRecommendations = recommendResources(q, limit, effectiveFocusId);
  const assignedRecommendations = assignResourceSearchInstructions(
    rawRecommendations,
    q,
    effectiveFocusId
  );
  const recommendations = navigationOnly
    ? assignedRecommendations
    : assignedRecommendations.filter((resource) => resource.searchTerms.length > 0);
  const reservedKeys = new Set(
    recommendations.flatMap((resource) => resource.searchTerms || []).map(normalizeSearchOptionKey)
  );
  const fallbacks = buildFallbackSearches(q, effectiveFocusId, {
    excludedTerms: [...reservedKeys],
    resources: recommendations,
  });
  fallbacks
    .map((fallback) => fallback.query)
    .filter(Boolean)
    .forEach((term) => reservedKeys.add(normalizeSearchOptionKey(term)));

  const searchTerms = uniqueSearchOptions(
    buildSearchTermSuggestions(q, [], effectiveFocusId, 20),
    reservedKeys
  ).slice(0, 3);
  searchTerms.forEach((term) => reservedKeys.add(normalizeSearchOptionKey(term)));

  const rawOtherStartingPoints = navigationOnly
    ? []
    : buildGeneralStartingPoints(recommendations, 3, effectiveFocusId, q);
  const otherStartingPoints = assignResourceSearchInstructions(
    rawOtherStartingPoints,
    q,
    effectiveFocusId,
    reservedKeys
  ).filter((resource) => resource.searchTerms.length > 0);
  otherStartingPoints
    .flatMap((resource) => resource.searchTerms || [])
    .forEach((term) => reservedKeys.add(normalizeSearchOptionKey(term)));
  const citationGuides = selectCitationGuides(q);
  const fullText = buildFullTextWorkflow(q);
  return {
    query: q,
    navigationOnly,
    subjectFocus: {
      id: subjectFocus.id,
      selectedId: subjectFocus.selectedId,
      label: subjectFocus.label,
      shortLabel: subjectFocus.shortLabel,
      autoDetected: Boolean(subjectFocus.autoDetected),
      description: subjectFocus.description,
    },
    intents,
    strategy,
    searchTerms,
    recommendations,
    otherStartingPoints,
    fallbacks,
    citationGuides,
    fullText,
    transparencyNote: navigationOnly
      ? "Choose the path that matches the task. Enter topic keywords only after opening the appropriate search tool."
      : "Every item below is a named database selected for this topic. Its link opens the exact ZSR A-Z entry (or the database itself), and each card has a distinct query and database-specific filters. Shorter lists mean weak matches were intentionally omitted.",
  };
}
