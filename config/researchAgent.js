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
    bestFor: "public health, medicine, adolescent health, clinical outcomes, and DOI/PMID follow-up",
    notBestFor: "humanities background sources or market research reports",
    accessUrl: "https://pubmed.ncbi.nlm.nih.gov/",
    tags: ["scholarly", "articles", "health", "medicine", "statistics", "mental health", "autism", "doi", "pmid"],
    priority: 88,
    notes: "PubMed is open; full text may require Wake Forest access through ZSR or LibKey Nomad.",
    previewImage: "/preview-pubmed.png",
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
  { id: "citation", label: "citation help", pattern: /\b(citat|cite|apa|mla|chicago|bibliograph|zotero)\b/i },
  { id: "fulltext", label: "full-text access help", pattern: /\b(full[-\s]?text|pdf|doi|pmid|pubmed id|access this|find this article)\b/i },
  { id: "market", label: "market or business data", pattern: /\b(market|industry|consumer|brand|retail|company financial|financials|revenue|share|rolex|energy drinks?)\b/i },
  { id: "statistics", label: "statistics or datasets", pattern: /\b(statistics?|dataset|data|prevalence|rates?|survey|cpi|inflation|cost of living|economic indicators?)\b/i },
  { id: "legal", label: "legal or government sources", pattern: /\b(policy memo|legal|law|court|case law|statute|regulation|government|legislation|public policy)\b/i },
  { id: "news", label: "news or current events", pattern: /\b(news|newspaper|coverage|current events?|war in ukraine|ukraine)\b/i },
  { id: "evaluation", label: "source evaluation", pattern: /\b(evaluat|credible|peer[-\s]?reviewed|scholarly source|quality)\b/i },
  { id: "books", label: "books or background sources", pattern: /\b(background|overview|book|ebook|handbook|history of|introduction to)\b/i },
  { id: "scholarly", label: "scholarly articles", pattern: /\b(scholarly|peer[-\s]?reviewed|articles?|journal|literature review|studies|research on)\b/i },
];

const TOPIC_PROFILES = [
  {
    id: "rolex",
    pattern: /\b(rolex|luxury watch|watches)\b/i,
    better: ["luxury goods consumer behavior", "watch industry market share", "premium brand retail strategy"],
    broader: ["luxury goods", "consumer behavior", "retail market research", "brand equity"],
    narrower: ["Rolex brand positioning", "Swiss watch market", "luxury resale market", "high-income consumer segments"],
    alternate: ["premium watches", "luxury retail", "brand prestige", "conspicuous consumption"],
    resourceIds: ["business-guide", "mintel", "business-source", "statista"],
  },
  {
    id: "autism",
    pattern: /\b(autism|autistic|asd)\b/i,
    better: ["autism spectrum disorder", "autism AND special education", "autism intervention outcomes"],
    broader: ["neurodevelopmental disorders", "disability studies", "special education", "developmental psychology"],
    narrower: ["early intervention", "inclusive classrooms", "adolescent autism", "autism diagnosis"],
    alternate: ["ASD", "developmental disabilities", "neurodiversity", "educational accommodations"],
    resourceIds: ["psycinfo", "pubmed-medline", "eric", "education-source"],
  },
  {
    id: "cost-living",
    pattern: /\b(cost of living|inflation|consumer prices|cpi)\b/i,
    better: ["consumer price index", "household expenditure inflation", "cost of living economic indicators"],
    broader: ["inflation", "economic indicators", "household spending", "wage growth"],
    narrower: ["regional CPI", "housing affordability", "food prices", "real wages"],
    alternate: ["consumer prices", "living costs", "personal consumption expenditures", "purchasing power"],
    resourceIds: ["statista", "business-source", "research-guides", "primo"],
  },
  {
    id: "social-media-mental-health",
    pattern: /\b(social media|instagram|tiktok|snapchat)\b/i,
    better: ["social media AND adolescent mental health", "Instagram OR TikTok AND depression anxiety", "social comparison AND teen well-being"],
    broader: ["media effects", "adolescent development", "digital culture", "public health"],
    narrower: ["cyberbullying", "screen time", "body image", "sleep disruption"],
    alternate: ["online social networking", "platform use", "digital media", "well-being"],
    resourceIds: ["psycinfo", "communication-mass-media", "pubmed-medline", "socindex"],
  },
  {
    id: "ai-education",
    pattern: /\b(ai|artificial intelligence|generative ai|chatgpt)\b.*\b(education|school|teaching|learning)\b|\b(education|school|teaching|learning)\b.*\b(ai|artificial intelligence|generative ai|chatgpt)\b/i,
    better: ["generative AI in education", "artificial intelligence learning outcomes", "AI academic integrity teaching"],
    broader: ["education technology", "digital learning", "instructional technology", "academic integrity"],
    narrower: ["ChatGPT classroom use", "AI writing tools", "student learning outcomes", "teacher adoption"],
    alternate: ["edtech", "large language models", "AI literacy", "automated feedback"],
    resourceIds: ["eric", "education-source", "research-guides", "primo"],
  },
  {
    id: "college-mental-health-stats",
    pattern: /\b(college|university|student)\b.*\b(mental health|depression|anxiety|well-being|wellbeing|statistics|data)\b/i,
    better: ["college student mental health statistics", "student anxiety depression prevalence", "campus mental health survey"],
    broader: ["young adult mental health", "higher education health", "public health statistics"],
    narrower: ["undergraduate depression prevalence", "campus counseling utilization", "student anxiety trends"],
    alternate: ["college health survey", "student well-being", "mental health prevalence", "survey data"],
    resourceIds: ["pubmed-medline", "psycinfo", "icpsr", "statista"],
  },
  {
    id: "ukraine-news",
    pattern: /\b(ukraine|war in ukraine|russia ukraine)\b/i,
    better: ["Ukraine war news coverage", "Russia Ukraine conflict reporting", "Ukraine invasion newspapers"],
    broader: ["international news", "foreign policy", "war reporting", "conflict coverage"],
    narrower: ["humanitarian aid Ukraine", "NATO Ukraine", "Ukraine refugees", "energy sanctions"],
    alternate: ["Russia-Ukraine war", "invasion of Ukraine", "Eastern Europe conflict"],
    resourceIds: ["factiva", "proquest-news", "cq-researcher", "primo"],
  },
  {
    id: "russia-poland-history",
    pattern: /\b(russia|russian|poland|polish|soviet|eastern europe|central europe|cold war|warsaw pact)\b/i,
    better: ["Russia Poland relations", "Eastern Europe history", "Soviet Polish relations"],
    broader: ["European history", "international relations", "borderlands", "nationalism"],
    narrower: ["Cold War Eastern Europe", "Polish Soviet War", "Solidarity movement Poland", "Russia Poland diplomacy"],
    alternate: ["Polish-Russian relations", "Central Europe", "post-Soviet Europe", "Soviet Union"],
    resourceIds: ["jstor", "primo", "research-guides", "proquest-news", "cq-researcher"],
  },
  {
    id: "energy-drinks",
    pattern: /\b(energy drink|red bull|monster beverage|beverage market)\b/i,
    better: ["energy drinks market data", "functional beverage consumer trends", "energy drink brand share"],
    broader: ["beverage industry", "consumer packaged goods", "functional beverages", "retail sales"],
    narrower: ["college students energy drinks", "caffeine beverage market", "Red Bull market share"],
    alternate: ["sports drinks", "ready-to-drink beverages", "caffeinated beverages"],
    resourceIds: ["business-guide", "mintel", "statista", "business-source"],
  },
  {
    id: "company-financials",
    pattern: /\b(company financials?|financial statements?|annual report|10-k|revenue|balance sheet)\b/i,
    better: ["company financial statements", "annual report 10-K", "company profile financial ratios"],
    broader: ["corporate finance", "industry analysis", "public company filings"],
    narrower: ["income statement", "balance sheet", "segment revenue", "SEC filings"],
    alternate: ["company accounts", "financial ratios", "public filings"],
    resourceIds: ["business-guide", "mergent", "business-source", "primo"],
  },
  {
    id: "policy-memo",
    pattern: /\b(policy memo|policy brief|public policy|government sources?)\b/i,
    better: ["policy brief background evidence", "government report policy analysis", "scholarly policy evaluation"],
    broader: ["public policy", "government documents", "issue reports", "legal context"],
    narrower: ["stakeholder impacts", "implementation evidence", "state policy", "federal regulation"],
    alternate: ["policy analysis", "legislative context", "public affairs", "regulatory impact"],
    resourceIds: ["cq-researcher", "heinonline", "research-guides", "primo"],
  },
];

function cleanQuery(query) {
  return String(query || "").trim().replace(/\s+/g, " ");
}

function uniq(items) {
  return [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
}

function articleTitleLike(query) {
  const q = cleanQuery(query);
  if (extractDoi(q) || extractPmid(q)) return true;
  if (/^".+"$/.test(q)) return true;
  if (q.length > 55 && !/\b(i need|help me|brainstorm|research questions?|topic|find|where|how|what|sources?|database|statistics|market)\b/i.test(q)) return true;
  if (/:/.test(q) && q.split(/\s+/).length >= 7 && !/\?$/.test(q)) return true;
  return false;
}

function activeProfiles(query) {
  const q = cleanQuery(query);
  return TOPIC_PROFILES.filter((profile) => profile.pattern.test(q));
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

function resourceScore(resource, intents, profiles, query) {
  const q = query.toLowerCase();
  let score = resource.priority || 0;
  const ids = new Set(profiles.flatMap((profile) => profile.resourceIds || []));
  if (ids.has(resource.id)) score += 60;
  const intentIds = new Set(intents.map((intent) => intent.id));
  for (const tag of resource.tags || []) {
    if (q.includes(tag)) score += 10;
  }
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

export function recommendResources(query, limit = 5) {
  const q = cleanQuery(query);
  const intents = classifyResearchIntent(q);
  const profiles = activeProfiles(q);
  return ZSR_RESOURCE_CONFIG
    .map((resource) => ({
      ...resource,
      score: resourceScore(resource, intents, profiles, q),
      whyFits: whyResourceFits(resource, intents, profiles),
      searchTerms: termsForResource(resource, q, profiles),
      expect: expectForResource(resource),
      caution: resource.notes,
      nextStep: nextStepForResource(resource, q),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function whyResourceFits(resource, intents, profiles) {
  const profileMatch = profiles.find((profile) => profile.resourceIds?.includes(resource.id));
  if (profileMatch) return `This fits because the topic maps to ${resource.subjectArea.toLowerCase()} research rather than only a literal keyword search.`;
  const intentLabel = intents[0]?.label || "this research need";
  return `This fits the ${intentLabel} path and is grounded in the local ZSR resource config.`;
}

function termsForResource(resource, query, profiles) {
  const profileTerms = profiles.flatMap((profile) => [...profile.better.slice(0, 2), ...profile.alternate.slice(0, 1)]);
  const fallback = [query, `${query} ${resource.subjectArea}`];
  return uniq([...profileTerms, ...fallback]).slice(0, 4);
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
  if (resource.accessUrl?.includes("az.php")) return `Open the A-Z result for ${resource.name}, then search one of the terms below inside that database.`;
  return `Open ${resource.name} and test one focused search before broadening.`;
}

export function buildSearchStrategy(query) {
  const q = cleanQuery(query);
  const profiles = activeProfiles(q);
  const profileTerms = profiles.length
    ? profiles
    : [{
        better: [q],
        broader: ["background", "scholarly research", "subject guide"],
        narrower: [`${q} case study`, `${q} recent research`],
        alternate: [`${q} terminology`, `${q} evidence`],
        resourceIds: ["research-guides", "primo"],
      }];
  const betterTerms = uniq(profileTerms.flatMap((profile) => profile.better)).slice(0, 5);
  const broaderTerms = uniq(profileTerms.flatMap((profile) => profile.broader)).slice(0, 5);
  const narrowerTerms = uniq(profileTerms.flatMap((profile) => profile.narrower)).slice(0, 5);
  const alternateTerms = uniq(profileTerms.flatMap((profile) => profile.alternate)).slice(0, 5);
  const exactQuery = articleTitleLike(q) ? `"${q.replace(/^"|"$/g, "")}"` : q;
  return {
    isKnownItem: articleTitleLike(q),
    betterTerms,
    broaderTerms,
    narrowerTerms,
    alternateTerms,
    likelyDatabaseCategories: uniq(recommendResources(q, 5).map((resource) => resource.subjectArea)).slice(0, 5),
    links: {
      googleScholar: fillTemplate(LIBRARY_LINKS.googleScholarSearch, exactQuery),
      zsrCatalog: fillTemplate(LIBRARY_LINKS.zsrPrimoSearch, exactQuery),
      zsrArticles: fillTemplate(LIBRARY_LINKS.zsrArticleSearch, exactQuery),
    },
  };
}

export function buildFallbackSearches(query) {
  const q = cleanQuery(query);
  const strategy = buildSearchStrategy(q);
  const resources = recommendResources(q, 4);
  return [
    {
      label: "Try the exact phrase",
      text: articleTitleLike(q) ? `"${q.replace(/^"|"$/g, "")}"` : q,
      href: strategy.links.zsrCatalog,
    },
    {
      label: "Broaden the concept",
      text: strategy.broaderTerms.slice(0, 3).join(" OR "),
      href: fillTemplate(LIBRARY_LINKS.zsrPrimoSearch, strategy.broaderTerms.slice(0, 3).join(" OR ")),
    },
    {
      label: "Search likely database names",
      text: resources.map((resource) => resource.name).slice(0, 3).join(" OR "),
      href: AZ,
    },
    {
      label: "Try Google Scholar",
      text: strategy.betterTerms[0] || q,
      href: strategy.links.googleScholar,
    },
    {
      label: "Use citation chaining",
      text: "Open one strong source, then follow its references and cited-by links.",
      href: strategy.links.googleScholar,
    },
  ];
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

export function buildResearchPlan(query, limit = 5) {
  const q = cleanQuery(query);
  const intents = classifyResearchIntent(q);
  const strategy = buildSearchStrategy(q);
  const recommendations = recommendResources(q, limit);
  const fallbacks = buildFallbackSearches(q);
  const citationGuides = selectCitationGuides(q);
  const fullText = buildFullTextWorkflow(q);
  return {
    query: q,
    intents,
    strategy,
    recommendations,
    fallbacks,
    citationGuides,
    fullText,
    transparencyNote:
      "These are ZSR-oriented search paths from an editable local config plus live link-outs. Open each ZSR record or database to confirm access and fit.",
  };
}
