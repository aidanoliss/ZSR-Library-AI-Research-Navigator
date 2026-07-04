import { LIBRARY_LINKS } from "./libraryLinks.js";

const ROUTES = [
  {
    id: "psychology-social-sciences",
    label: "Psychology / Social Sciences librarian",
    unit: "Subject research support",
    href: LIBRARY_LINKS.zsrAsk,
    patterns: [/psych/i, /ptsd|trauma|mental health|anxiety|depression|adolescent|teen|youth/i],
    modes: ["scholarly", "general"],
    reason: "Best fit for behavioral-health, adolescent-development, and social-science research questions.",
  },
  {
    id: "communication-media",
    label: "Communication / Media Studies librarian",
    unit: "Subject research support",
    href: LIBRARY_LINKS.zsrAsk,
    patterns: [/communication|media|television|tv|film|news|social media|instagram|tiktok|snapchat/i],
    modes: ["scholarly", "news", "general"],
    reason: "Useful when the research scope is media effects, representation, platforms, audiences, or journalism.",
  },
  {
    id: "health-sciences",
    label: "Health Sciences research support",
    unit: "Database and evidence support",
    href: LIBRARY_LINKS.zsrAsk,
    patterns: [/health|clinical|medicine|medical|pubmed|medline|therapy|diagnosis|symptom/i],
    modes: ["scholarly", "data"],
    reason: "Good route for PubMed/MEDLINE searches, clinical terms, evidence filters, and health outcomes.",
  },
  {
    id: "data-statistics",
    label: "Data and Statistics support",
    unit: "Data research support",
    href: LIBRARY_LINKS.zsrAsk,
    patterns: [/data|statistics|survey|dataset|prevalence|trend|poll|icpsr|statista/i],
    modes: ["data"],
    reason: "Best when the student needs datasets, statistics, survey instruments, or trend evidence.",
  },
  {
    id: "primary-special-collections",
    label: "Special Collections & Archives",
    unit: "Primary-source support",
    href: "https://zsr.wfu.edu/special/",
    patterns: [/archive|archival|primary source|manuscript|letters|photographs|oral history|special collections/i],
    modes: ["primary"],
    reason: "Best for original materials, archives, campus history, rare books, and primary-source strategy.",
  },
  {
    id: "citation-zotero",
    label: "Citation and Zotero help",
    unit: "Research services",
    href: LIBRARY_LINKS.zsrCitationGuide,
    patterns: [/citation|cite|apa|mla|chicago|zotero|bibliography|works cited/i],
    modes: [],
    reason: "Useful when the main blocker is citation style, source management, or bibliography cleanup.",
  },
  {
    id: "ask-zsr",
    label: "Ask ZSR general research help",
    unit: "Research consultations",
    href: LIBRARY_LINKS.zsrAsk,
    patterns: [],
    modes: [],
    reason: "Fallback route when the topic spans multiple departments or the best subject owner is unclear.",
  },
];

function routeScore(route, text, modeId, matchedResources = []) {
  let score = 0;
  if (route.modes.includes(modeId)) score += 2;
  for (const pattern of route.patterns) {
    if (pattern.test(text)) score += 3;
  }
  for (const resource of matchedResources) {
    const haystack = `${resource?.name || ""} ${resource?.description || ""} ${(resource?.tags || []).join(" ")}`;
    for (const pattern of route.patterns) {
      if (pattern.test(haystack)) score += 1;
    }
  }
  return score;
}

export function recommendLibrarianRoutes(topic, modeId = "scholarly", matchedResources = []) {
  const text = String(topic || "").toLowerCase();
  const ranked = ROUTES
    .map((route) => ({ ...route, score: routeScore(route, text, modeId, matchedResources) }))
    .sort((a, b) => b.score - a.score);

  const selected = ranked.filter((route) => route.score > 0).slice(0, 3);
  if (!selected.some((route) => route.id === "ask-zsr")) {
    selected.push(ROUTES.find((route) => route.id === "ask-zsr"));
  }
  return selected.filter(Boolean).slice(0, 3).map(({ score, patterns, modes, ...route }) => route);
}
