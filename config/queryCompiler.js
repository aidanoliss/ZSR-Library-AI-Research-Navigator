import { getResourceCapability, getSourceModeContract } from "./resourceCapabilities.js";
import { researchSpecQuery, formatResearchTerm, researchFacetExpressions, researchConceptExpressions } from "./researchSpec.js";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const quoted = formatResearchTerm;

function conceptExpression(concept, variant = 0) {
  const preferred = clean(concept?.preferredTerm);
  const synonyms = (concept?.synonyms || []).map(clean).filter(Boolean);
  if (!preferred) return "";
  if (!synonyms.length || variant <= 0) return quoted(preferred, { exact: concept.exactPhrase === true || /^known-item/.test(concept.source || "") });
  const selected = synonyms.slice(0, Math.min(2, variant));
  return `(${[preferred, ...selected].map(quoted).join(" OR ")})`;
}

function modeQualifier(modeId, resourceId, base) {
  if (modeId === "data" && !/\b(dataset|statistics?|survey)\b/i.test(base)) {
    if (resourceId === "icpsr") return "dataset OR survey";
    if (["statista", "mergent", "mintel"].includes(resourceId)) return "statistics OR trend";
  }
  if (modeId === "legal-policy" && !/\b(law|legal|regulation|policy|statute|court)\b/i.test(base)) {
    return "law OR regulation OR policy";
  }
  return "";
}

function dialectQuery(base, dialect) {
  if (!base) return "";
  if (dialect === "pubmed") {
    return base.replace(/\b([a-z][a-z-]+)\*/gi, "$1*");
  }
  if (dialect === "factiva") {
    return base.replace(/\bNOT\b/gi, "not");
  }
  return base;
}

/** Compile one topic-preserving query for a specific database/provider. */
export function compileResourceQuery(resource, spec, routeIndex = 0) {
  const capability = getResourceCapability(resource);
  const requiredConcepts = (spec?.concepts || []).filter((concept) => concept.required !== false);
  const expressions = researchConceptExpressions(spec, (concept, index) =>
    conceptExpression(concept, index === routeIndex % Math.max(requiredConcepts.length, 1) ? 1 : 0)
  ).filter(Boolean);
  let base = expressions.join(" AND ") || researchSpecQuery(spec);

  for (const expression of researchFacetExpressions(spec)) if (!base.toLowerCase().includes(expression.toLowerCase())) base += ` AND ${expression}`;

  const qualifier = modeQualifier(spec?.mode, resource?.id, base);
  if (qualifier) base += ` AND (${qualifier})`;

  return dialectQuery(clean(base), capability.queryDialect);
}

function normalizedWords(value) {
  return new Set(clean(value).toLowerCase().replace(/[^a-z0-9*\s-]/g, " ").split(/\s+/).filter(Boolean));
}

function conceptPresent(query, concept) {
  const terms = [concept?.preferredTerm, ...(concept?.synonyms || [])].map(clean).filter(Boolean);
  return terms.some((term) => {
    const normalized = term.toLowerCase();
    if (!normalized) return false;
    const words = [...normalizedWords(normalized)].filter((word) => !["and", "or", "not"].includes(word));
    const queryWords = normalizedWords(query);
    return words.length > 0 && words.every((word) => [...queryWords].some((candidate) =>
      candidate === word || (word.endsWith("*") && candidate.startsWith(word.slice(0, -1))) ||
      (candidate.endsWith("*") && word.startsWith(candidate.slice(0, -1)))
    ));
  });
}

export function validateCompiledQuery(query, spec) {
  const missingConceptIds = (spec?.concepts || [])
    .filter((concept) => concept.required !== false && !conceptPresent(query, concept))
    .map((concept) => concept.id);
  const naturalLanguage = /^(?:can|could|would|please|help|how|why|what|where|when)\b/i.test(clean(query));
  return {
    valid: Boolean(clean(query)) && missingConceptIds.length === 0 && !naturalLanguage,
    missingConceptIds,
    naturalLanguage,
  };
}

export function compileFallbackQueries(spec) {
  const concepts = (spec?.concepts || []).filter((concept) => concept.required !== false);
  const canonical = researchSpecQuery(spec);
  if (spec?.knownItem?.title) {
    const titleOnly = quoted(spec.knownItem.title, { exact: true });
    return {
      canonical,
      narrow: canonical,
      broaden: titleOnly,
      controlledReduction: titleOnly,
    };
  }
  const population = clean(spec?.facets?.population);
  const geography = clean(spec?.facets?.geography);
  const limiter = [population, geography].find(Boolean);
  const narrower = limiter && !canonical.toLowerCase().includes(limiter.toLowerCase())
    ? `${canonical} AND ${quoted(limiter)}`
    : canonical;
  const synonymConcept = concepts.find((concept) => concept.synonyms?.length);
  let broaden = synonymConcept
    ? researchConceptExpressions(spec, (concept) => concept.id === synonymConcept.id
      ? conceptExpression(concept, 2)
      : conceptExpression(concept, 0)).join(" AND ")
    : canonical;
  // Synonym expansion must retain assignment facets and every required concept.
  for (const expression of researchFacetExpressions(spec)) if (!broaden.toLowerCase().includes(expression.toLowerCase())) broaden += ` AND ${expression}`;
  const reduced = broaden;
  return {
    canonical,
    narrow: clean(narrower),
    broaden: clean(broaden),
    controlledReduction: clean(reduced),
  };
}

export function sourceModeValidation(resources, modeId) {
  const contract = getSourceModeContract(modeId);
  const top = (resources || []).slice(0, 3);
  const compatible = top.filter((resource) => {
    const capability = getResourceCapability(resource);
    return capability.sourceKinds.some((kind) => contract.allowedKinds.includes(kind));
  });
  const required = top.filter((resource) => {
    const capability = getResourceCapability(resource);
    return capability.sourceKinds.some((kind) => contract.requiredKinds.includes(kind));
  });
  return {
    valid: top.length > 0 && compatible.length === top.length && required.length >= Math.min(2, top.length),
    topCount: top.length,
    compatibleCount: compatible.length,
    requiredCount: required.length,
  };
}
