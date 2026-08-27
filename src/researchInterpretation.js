const FACET_FIELDS = ["population", "geography", "timePeriod", "method", "documentType"];

function cleanText(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    return cleanText(value.value || value.label || value.name || value.term || "");
  }
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeTextList(value) {
  const items = Array.isArray(value) ? value : String(value || "").split(/[,;|]/);
  const seen = new Set();
  return items
    .map(cleanText)
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeResearchSpec(spec = {}, fallback = {}) {
  const raw = spec && typeof spec === "object" ? spec : {};
  const rawFacets = raw.facets && typeof raw.facets === "object" ? raw.facets : {};
  const concepts = (Array.isArray(raw.concepts) ? raw.concepts : normalizeTextList(raw.concepts))
    .map((concept, index) => {
      const preferredTerm = cleanText(
        typeof concept === "string" ? concept : concept?.preferredTerm || concept?.term || concept?.label
      );
      if (!preferredTerm) return null;
      return {
        id: cleanText(concept?.id) || `concept-${index + 1}`,
        preferredTerm,
        synonyms: normalizeTextList(concept?.synonyms),
        required: concept?.required !== false,
      };
    })
    .filter(Boolean);

  const facets = Object.fromEntries(
    FACET_FIELDS.map((field) => [
      field,
      cleanText(rawFacets[field] ?? raw[field] ?? fallback?.facets?.[field]),
    ])
  );

  return {
    topic: cleanText(raw.topic || fallback.topic),
    mode: cleanText(raw.modeId || raw.mode || raw.sourceMode || fallback.mode),
    disciplines: normalizeTextList(raw.disciplines || raw.discipline || fallback.disciplines),
    concepts,
    facets,
    sourceContract: raw.sourceContract || raw.source_contract || fallback.sourceContract || null,
    planHash: cleanText(raw.planHash || raw.plan_hash || fallback.planHash),
    configVersion: cleanText(raw.configVersion || raw.config_version || fallback.configVersion),
  };
}

function conceptText(spec) {
  return (spec.concepts || []).map((concept) => concept.preferredTerm).filter(Boolean).join(", ");
}

function comparableValue(spec, field) {
  if (field === "concepts") return conceptText(spec);
  if (field === "disciplines") return (spec.disciplines || []).join(", ");
  if (field in (spec.facets || {})) return cleanText(spec.facets[field]);
  return cleanText(spec[field]);
}

const DIFF_FIELDS = [
  ["topic", "Topic"],
  ["concepts", "Concepts"],
  ["population", "Population"],
  ["geography", "Geography"],
  ["timePeriod", "Date range"],
  ["method", "Method"],
  ["documentType", "Document type"],
  ["mode", "Source type"],
  ["disciplines", "Discipline"],
];

export function researchSpecDiff(original, edited) {
  const beforeSpec = normalizeResearchSpec(original);
  const afterSpec = normalizeResearchSpec(edited);
  return DIFF_FIELDS.flatMap(([field, label]) => {
    const before = comparableValue(beforeSpec, field);
    const after = comparableValue(afterSpec, field);
    return before === after ? [] : [{ field, label, before: before || "Not specified", after: after || "Not specified" }];
  });
}

function fieldLine(label, value) {
  const clean = cleanText(value);
  return clean ? `${label}: ${clean}.` : "";
}

export function buildInterpretationCorrectionPrompt(original, edited) {
  const baseline = normalizeResearchSpec(original);
  const next = normalizeResearchSpec(edited, baseline);
  const changes = researchSpecDiff(baseline, next);
  if (!changes.length) return "";

  return [
    "Apply these student-corrected research constraints and rebuild the search plan.",
    `Original topic: ${baseline.topic || next.topic || "the current research request"}.`,
    fieldLine("Corrected topic", next.topic),
    fieldLine("Required concepts", conceptText(next)),
    fieldLine("Population", next.facets.population),
    fieldLine("Geography", next.facets.geography),
    fieldLine("Date range", next.facets.timePeriod),
    fieldLine("Method", next.facets.method),
    fieldLine("Document type", next.facets.documentType),
    fieldLine("Source type", next.mode),
    fieldLine("Discipline", next.disciplines.join(", ")),
    `Student changes: ${changes.map((change) => `${change.label} from "${change.before}" to "${change.after}"`).join("; ")}.`,
    "Treat these as search constraints, not factual claims. Preserve every field that the student did not change.",
  ].filter(Boolean).join(" ");
}

const REFINEMENT_CHANGES = {
  "too-broad": "narrow the scope to the most central subtopic while retaining every required concept",
  "too-narrow": "remove only the most restrictive scope limiter",
  "wrong-discipline": "reclassify only the discipline from the original topic wording",
  "wrong-source-type": "reclassify only the source type from the original topic and assignment wording",
};

export function buildBoundedRefinementPrompt(kind, context = {}) {
  const targetMode = cleanText(context.targetMode);
  const currentMode = cleanText(context.mode);
  const desiredChange = kind === "wrong-source-type" && targetMode
    ? `change only the source type from "${currentMode || "the current mode"}" to "${targetMode}"`
    : REFINEMENT_CHANGES[kind];
  if (!desiredChange) return "";
  const topic = cleanText(context.topic) || "the current topic";
  return `Refine "${topic}". Change exactly one field: ${desiredChange}. Keep every other interpreted concept, facet, source constraint, and discipline unchanged. Before the revised plan, state the one change you made.`;
}

export function sourceContractLines(contract) {
  if (!contract || typeof contract !== "object") return [];
  const kinds = normalizeTextList(
    contract.requiredSourceKinds || contract.requiredKinds || contract.sourceKinds || contract.allowedSourceKinds
  );
  const lines = [];
  if (kinds.length) lines.push(`Compatible source kinds: ${kinds.join(", ")}`);
  if (contract.minimumCompatibleTopResults != null) {
    lines.push(`Top-result requirement: ${contract.minimumCompatibleTopResults} compatible routes`);
  }
  if (contract.fallbackPolicy) lines.push(`Fallback policy: ${cleanText(contract.fallbackPolicy)}`);
  if (contract.label || contract.description) lines.push(cleanText(contract.label || contract.description));
  return [...new Set(lines.filter(Boolean))].slice(0, 4);
}
