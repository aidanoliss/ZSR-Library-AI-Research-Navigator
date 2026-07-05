export const DEFAULT_SUBJECT_FOCUS_ID = "auto";

export const SUBJECT_FOCUSES = [
  {
    id: "auto",
    label: "Auto-detect",
    shortLabel: "Auto",
    description: "Let the topic choose the best ZSR subject lens.",
    prompt:
      "Infer the most useful discipline from the student's topic. Use it as a ranking lens, not a hard filter.",
    resourceIds: [],
    keywords: [],
    patterns: [],
  },
  {
    id: "biology-health",
    label: "Biology / Health Sciences",
    shortLabel: "Bio / Health",
    description: "Biomedical, life science, public-health, and disease-mechanism research.",
    prompt:
      "Prioritize biomedical and life-science language, including mechanisms, clinical/public-health context, DOI/PMID workflows, and citation chaining.",
    resourceIds: ["pubmed-medline", "web-of-science", "science-direct", "primo", "zsr-discovery", "databases-az"],
    keywords: [
      "health",
      "medicine",
      "medical",
      "biology",
      "biochemistry",
      "protein",
      "protein folding",
      "disease",
      "genetics",
      "clinical",
      "public health",
      "doi",
      "pmid",
    ],
    patterns: [
      /\b(protein|protein folding|protein misfolding|amyloid|biochemistry|biology|genetics|gene|mutation|molecular|cell|disease|clinical|medical|medicine|public health|pubmed|pmid|doi)\b/i,
    ],
  },
  {
    id: "psychology",
    label: "Psychology",
    shortLabel: "Psychology",
    description: "Behavior, cognition, development, mental health, and well-being.",
    prompt:
      "Prioritize psychology terms, population/outcome filters, empirical-study language, and APA-style citation expectations.",
    resourceIds: ["psycinfo", "pubmed-medline", "socindex"],
    keywords: ["psychology", "behavior", "cognition", "mental health", "depression", "anxiety", "well-being", "development"],
    patterns: [/\b(psychology|behavior|cognition|mental health|depression|anxiety|trauma|ptsd|well-being|wellbeing|development|self-esteem)\b/i],
  },
  {
    id: "communication-media",
    label: "Communication / Media Studies",
    shortLabel: "Communication",
    description: "Media effects, platforms, journalism, audience studies, and digital culture.",
    prompt:
      "Prioritize media-effects, platform, audience, journalism, communication-theory, and digital-culture language.",
    resourceIds: ["communication-mass-media", "communication-mass-media-complete", "socindex", "research-guides"],
    keywords: ["communication", "media", "social media", "journalism", "audience", "platform", "digital culture"],
    patterns: [/\b(communication|media|social media|instagram|tiktok|snapchat|journalism|news coverage|audience|platform|digital culture)\b/i],
  },
  {
    id: "business",
    label: "Business / Market Research",
    shortLabel: "Business",
    description: "Companies, industries, brands, markets, consumer behavior, and financials.",
    prompt:
      "Prioritize business databases, company/industry vocabulary, market reports, consumer behavior, financials, and trade-publication context.",
    resourceIds: ["business-guide", "mintel", "business-source", "mergent", "statista"],
    keywords: ["business", "market", "company", "industry", "consumer", "brand", "financial", "revenue", "retail"],
    patterns: [/\b(business|market|industry|consumer|brand|retail|company|financials?|revenue|marketing|rolex|energy drinks?)\b/i],
  },
  {
    id: "history-humanities",
    label: "History / Humanities",
    shortLabel: "History",
    description: "Historical context, humanities scholarship, cultural analysis, and archival leads.",
    prompt:
      "Prioritize historical context, humanities scholarship, primary-source awareness, subject headings, and citation trails.",
    resourceIds: ["jstor", "primo", "zsr-discovery", "research-guides", "proquest-news"],
    keywords: ["history", "historical", "humanities", "culture", "literature", "archive", "primary source"],
    patterns: [/\b(history|historical|humanities|literature|culture|archive|archival|primary source|cold war|russia|poland|soviet)\b/i],
  },
  {
    id: "education",
    label: "Education",
    shortLabel: "Education",
    description: "Teaching, learning, students, schools, curriculum, and education policy.",
    prompt:
      "Prioritize education descriptors, school/population filters, learning outcomes, curriculum, and education-policy sources.",
    resourceIds: ["eric", "education-source", "research-guides", "primo", "zsr-discovery"],
    keywords: ["education", "teaching", "learning", "school", "student", "curriculum", "classroom"],
    patterns: [/\b(education|teaching|learning|school|student|classroom|curriculum|pedagogy|teacher)\b/i],
  },
  {
    id: "policy-law",
    label: "Policy / Law",
    shortLabel: "Policy",
    description: "Policy memos, law, government sources, regulations, and current issues.",
    prompt:
      "Prioritize policy, legal, government, issue-report, statute/regulation, jurisdiction, and stakeholder language.",
    resourceIds: ["cq-researcher", "heinonline", "research-guides", "primo", "zsr-discovery"],
    keywords: ["policy", "law", "legal", "government", "regulation", "legislation", "court", "public policy"],
    patterns: [/\b(policy|law|legal|government|regulation|legislation|court|case law|public policy|policy memo)\b/i],
  },
  {
    id: "data-statistics",
    label: "Data / Statistics",
    shortLabel: "Data",
    description: "Datasets, surveys, statistics, rates, trends, and methods.",
    prompt:
      "Prioritize datasets, surveys, statistics, methodology, denominator/sample checks, trend language, and data-source evaluation.",
    resourceIds: ["icpsr", "statista", "research-guides", "primo", "zsr-discovery"],
    keywords: ["data", "statistics", "dataset", "survey", "rates", "prevalence", "trend", "methodology"],
    patterns: [/\b(data|statistics?|dataset|survey|rates?|prevalence|trend|methodology|variables?|sample size)\b/i],
  },
  {
    id: "interdisciplinary",
    label: "General / Interdisciplinary",
    shortLabel: "Interdisciplinary",
    description: "Cross-disciplinary topics where the best subject route is still unclear.",
    prompt:
      "Keep the path interdisciplinary: start with broad ZSR tools, then explain which subject branch to try next.",
    resourceIds: ["research-guides", "primo", "zsr-discovery", "databases-az"],
    keywords: ["interdisciplinary", "general", "overview", "background"],
    patterns: [],
  },
];

export function getSubjectFocus(id) {
  return SUBJECT_FOCUSES.find((focus) => focus.id === id) || SUBJECT_FOCUSES[0];
}

export function detectSubjectFocus(text) {
  const value = String(text || "");
  for (const focus of SUBJECT_FOCUSES) {
    if (focus.id === DEFAULT_SUBJECT_FOCUS_ID) continue;
    if ((focus.patterns || []).some((pattern) => pattern.test(value))) return focus;
  }
  return getSubjectFocus("interdisciplinary");
}

export function resolveSubjectFocus(selectedId, text) {
  const selected = getSubjectFocus(selectedId);
  if (selected.id !== DEFAULT_SUBJECT_FOCUS_ID) {
    return { ...selected, selectedId: selected.id, autoDetected: false };
  }
  const detected = detectSubjectFocus(text);
  return { ...detected, selectedId: DEFAULT_SUBJECT_FOCUS_ID, autoDetected: true };
}
