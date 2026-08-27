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
    resourceIds: ["pubmed-medline", "web-of-science", "science-direct", "academic-search-premier"],
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
      "maternal health",
      "mortality",
      "epidemiology",
      "telemedicine",
      "antibiotic resistance",
      "antimicrobial resistance",
      "hospital",
      "nursing",
      "circadian",
      "blue light",
      "epigenetic",
      "healthcare",
      "doi",
      "pmid",
    ],
    patterns: [
      /\b(protein|protein folding|protein misfolding|amyloid|biochemistry|biology|genetics|gene|mutation|molecular|cell|disease|clinical|medical|medicine|healthcare|telemedicine|public health|maternal|mortality|epidemiology|pubmed|pmid|doi|dementia|alzheimer'?s?|food insecurity|ecology|ecological|biodiversity|pollinator|environmental science|antibiotic|antimicrobial|hospital|nursing|circadian|blue[-\s]?light|epigenetic|prenatal famine)\b/i,
    ],
  },
  {
    id: "science-engineering",
    label: "Science / Engineering",
    shortLabel: "Science",
    description: "Physical science, engineering, technology, materials, and applied-science research.",
    prompt:
      "Prioritize multidisciplinary science indexes, technical vocabulary, document-type filters, publication years, and citation chaining.",
    resourceIds: ["web-of-science", "science-direct", "academic-search-premier", "proquest-research-library"],
    keywords: ["science", "engineering", "technology", "physics", "chemistry", "materials", "quantum", "sensor", "agriculture", "climate change", "machine learning"],
    patterns: [/\b(engineering|technology|physics|chemistry|materials science|quantum|sensors?|robotics|agricultur(?:e|al)|precision agriculture|climate(?: science| change| resilience| adaptation)?|global warming|environmental change|machine learning|algorithmic|facial recognition)\b/i],
  },
  {
    id: "psychology",
    label: "Psychology",
    shortLabel: "Psychology",
    description: "Behavior, cognition, development, mental health, and well-being.",
    prompt:
      "Prioritize psychology terms, population/outcome filters, empirical-study language, and APA-style citation expectations.",
    resourceIds: ["psycinfo", "pubmed-medline", "socindex"],
    keywords: ["psychology", "behavior", "cognition", "cognitive offloading", "mental health", "depression", "anxiety", "antidepressant", "psychotherapy", "well-being", "development"],
    patterns: [/\b(psychology|behavior|cognition|cognitive|cognitive offloading|metacognition|critical thinking|mental health|depression|anxiety|antidepressants?|ssri|psychotherapy|trauma|ptsd|well-being|wellbeing|development|self-esteem|sleep deprivation|personality|narcissism|psychopathy)\b/i],
  },
  {
    id: "communication-media",
    label: "Communication / Media Studies",
    shortLabel: "Communication",
    description: "Media effects, platforms, journalism, audience studies, and digital culture.",
    prompt:
      "Prioritize media-effects, platform, audience, journalism, communication-theory, and digital-culture language.",
    resourceIds: ["communication-mass-media", "socindex", "academic-search-premier", "proquest-research-library"],
    keywords: ["communication", "media", "social media", "journalism", "audience", "platform", "digital culture"],
    patterns: [/\b(communication|media|social media|instagram|tiktok|snapchat|journalism|news coverage|news framing|misinformation|disinformation|audience|platform|digital culture)\b/i],
  },
  {
    id: "economics",
    label: "Economics / Political Economy",
    shortLabel: "Economics",
    description: "Economic theory, macroeconomics, public finance, labor, development, and political economy.",
    prompt:
      "Prioritize economics indexes, named schools of thought, models and assumptions, policy mechanisms, empirical tests, and economic-history context.",
    resourceIds: ["econlit", "jstor", "web-of-science", "business-source", "proquest-research-library"],
    keywords: ["economics", "economic theory", "macroeconomics", "microeconomics", "Keynesian", "neoclassical", "fiscal policy", "monetary policy", "political economy"],
    patterns: [/\b(economics?|economic theory|macroeconomics?|microeconomics?|keynesian|neoclassical|monetar(?:ism|ist)|fiscal policy|monetary policy|monetary tightening|inflation targeting|unemployment|minimum wage|political economy|labor economics|development economics)\b/i],
  },
  {
    id: "business",
    label: "Business / Market Research",
    shortLabel: "Business",
    description: "Companies, industries, brands, markets, consumer behavior, and financials.",
    prompt:
      "Prioritize business databases, company/industry vocabulary, market reports, consumer behavior, financials, and trade-publication context.",
    resourceIds: ["mintel", "business-source", "mergent", "statista", "proquest-research-library"],
    keywords: ["business", "market", "company", "industry", "consumer", "brand", "financial", "revenue", "retail"],
    patterns: [/\b(business|market|industry|consumer|brand|retail|company|financials?|revenue|marketing|rolex|energy drinks?|supply chains?|esg|sustainability reporting|merger)\b/i],
  },
  {
    id: "history-humanities",
    label: "History / Humanities",
    shortLabel: "History",
    description: "Historical context, humanities scholarship, cultural analysis, and archival leads.",
    prompt:
      "Prioritize historical context, humanities scholarship, primary-source awareness, subject headings, and citation trails.",
    resourceIds: ["historical-abstracts", "jstor", "project-muse", "academic-search-premier"],
    keywords: ["history", "historical", "humanities", "culture", "literature", "novel", "archive", "primary source", "manuscript"],
    patterns: [/\b(history|historical|humanities|literature|novels?|fiction|poetry|postwar|culture|jazz|archive|archival|primary source|cold war|russia|poland|soviet|medieval|manuscript|religion|philosophy|ethics|moral responsibility|classics|art history|music history|book history|print culture|printing|typograph|watermarks?|almanacs?|material culture)\b/i],
  },
  {
    id: "education",
    label: "Education",
    shortLabel: "Education",
    description: "Teaching, learning, students, schools, curriculum, and education policy.",
    prompt:
      "Prioritize education descriptors, school/population filters, learning outcomes, curriculum, and education-policy sources.",
    resourceIds: ["eric", "education-source", "academic-search-premier", "proquest-research-library"],
    keywords: ["education", "teaching", "learning", "school", "student", "curriculum", "classroom"],
    patterns: [/\b(education|educational outcomes?|teaching|learning|school|student|classroom|curriculum|pedagogy|teacher|critical literacy|writing courses?|academic performance|higher education|college|university)\b/i],
  },
  {
    id: "policy-law",
    label: "Policy / Law",
    shortLabel: "Policy",
    description: "Policy memos, law, government sources, regulations, and current issues.",
    prompt:
      "Prioritize policy, legal, government, issue-report, statute/regulation, jurisdiction, and stakeholder language.",
    resourceIds: ["proquest-political-science", "cq-researcher", "heinonline", "socindex", "jstor"],
    keywords: ["policy", "law", "legal", "government", "regulation", "legislation", "court", "public policy"],
    patterns: [/\b(policy|law|legal|government|regulation|legislation|court|case law|public policy|policy memo|surveillance|immigration|democratic institutions?)\b/i],
  },
  {
    id: "data-statistics",
    label: "Data / Statistics",
    shortLabel: "Data",
    description: "Datasets, surveys, statistics, rates, trends, and methods.",
    prompt:
      "Prioritize datasets, surveys, statistics, methodology, denominator/sample checks, trend language, and data-source evaluation.",
    resourceIds: ["icpsr", "statista", "academic-search-premier", "proquest-research-library"],
    keywords: ["data", "statistics", "dataset", "survey", "rates", "prevalence", "trend", "methodology"],
    patterns: [/\b(data|statistics?|dataset|survey|rates?|prevalence|trend|methodology|variables?|sample size)\b/i],
  },
  {
    id: "interdisciplinary",
    label: "General / Interdisciplinary",
    shortLabel: "Interdisciplinary",
    description: "Cross-disciplinary topics where the best subject route is still unclear.",
    prompt:
      "Keep the path interdisciplinary, but recommend named databases and concrete searches rather than navigation directories.",
    resourceIds: ["academic-search-premier", "proquest-research-library", "jstor"],
    keywords: ["interdisciplinary", "general", "overview", "background"],
    patterns: [],
  },
];

export function getSubjectFocus(id) {
  return SUBJECT_FOCUSES.find((focus) => focus.id === id) || SUBJECT_FOCUSES[0];
}

export function detectSubjectFocus(text) {
  const value = String(text || "");
  let matches = SUBJECT_FOCUSES.filter(
    (focus) => focus.id !== DEFAULT_SUBJECT_FOCUS_ID && (focus.patterns || []).some((pattern) => pattern.test(value))
  );
  if (
    /\b(novels?|fiction|poetry|literature|literary|narrative|postwar)\b/i.test(value) &&
    matches.some((focus) => focus.id === "history-humanities")
  ) {
    matches = matches.filter((focus) => focus.id !== "psychology");
  }
  if (
    /\bmachine[-\s]+learning\b/i.test(value) &&
    !/\b(education|teaching|school|student|classroom|curriculum|pedagogy|course)\b/i.test(value)
  ) {
    matches = matches.filter((focus) => focus.id !== "education");
  }
  if (!matches.length) return getSubjectFocus("interdisciplinary");
  if (matches.length === 1) return matches[0];

  const [primary] = matches;
  return {
    ...primary,
    label: matches.map((focus) => focus.shortLabel || focus.label).join(" + "),
    shortLabel: "Interdisciplinary",
    description: `Combined subject lens: ${matches.map((focus) => focus.label).join(", ")}.`,
    prompt: matches.map((focus) => focus.prompt).join(" "),
    resourceIds: [...new Set(matches.flatMap((focus) => focus.resourceIds || []))],
    keywords: [...new Set(matches.flatMap((focus) => focus.keywords || []))],
    matchedFocusIds: matches.map((focus) => focus.id),
    interdisciplinary: true,
  };
}

export function resolveSubjectFocus(selectedId, text) {
  const selected = getSubjectFocus(selectedId);
  if (selected.id !== DEFAULT_SUBJECT_FOCUS_ID) {
    return { ...selected, selectedId: selected.id, autoDetected: false };
  }
  const detected = detectSubjectFocus(text);
  return { ...detected, selectedId: DEFAULT_SUBJECT_FOCUS_ID, autoDetected: true };
}
