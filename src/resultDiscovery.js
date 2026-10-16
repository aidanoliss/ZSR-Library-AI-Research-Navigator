import { formatResearchTerm, researchConceptExpressions, researchFacetExpressions, researchSpecQuery, suggestedResearchVocabulary } from "../config/researchSpec.js";

const EXTRA_VOCABULARY = [
  ["wearables", "wearable technology", "wearable devices", "wearable sensors", "fitness trackers", "smartwatches"],
  ["remote work", "telework", "telecommuting", "working from home"],
  ["food insecurity", "food poverty", "food access", "hunger"],
  ["affordable housing", "housing affordability", "low-cost housing", "housing costs"],
];
const termKey = (term) => String(term || "").toLowerCase().replace(/\s+/g, " ").trim();
const exact = (concept) => concept.exactPhrase === true || /^known-item/.test(concept.source || "") || /^["“].*["”]$/.test(concept.preferredTerm);
const standard = (concept) => formatResearchTerm(concept.preferredTerm, { exact: exact(concept) });

/** These are search suggestions, not claims of equivalence or controlled headings. */
export function resultSearchVocabulary(spec) {
  if (spec?.knownItem?.title) return [];
  return (spec?.concepts || []).filter((concept) => concept.required !== false && concept.preferredTerm && !exact(concept)).map((concept) => {
    const seen = new Set([termKey(concept.preferredTerm)]);
    const extra = EXTRA_VOCABULARY.find((group) => group.some((term) => termKey(term) === termKey(concept.preferredTerm))) || [];
    const alternatives = [...(concept.synonyms || []), ...suggestedResearchVocabulary(concept.preferredTerm), ...extra].filter((term) => {
      const key = termKey(term);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 6);
    return { concept, term: concept.preferredTerm, alternatives };
  }).filter(({ alternatives }) => alternatives.length);
}

/** Variants retain required concepts, comparison grouping, exact phrases and limits. */
export function buildResultQueryOptions(spec) {
  if (!spec?.concepts?.length && !spec?.knownItem?.title) return [];
  const options = [];
  const seen = new Set();
  function add(label, description, query) {
    const key = termKey(query);
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push({ label, description, query });
  }
  function compile(transform) {
    const parts = researchConceptExpressions(spec, transform);
    for (const facet of researchFacetExpressions(spec)) {
      if (!parts.some((part) => part.toLowerCase().includes(facet.toLowerCase()))) parts.push(facet);
    }
    return parts.join(" AND ");
  }
  add("Start here", "Search all required ideas together.", researchSpecQuery(spec));
  if (spec.knownItem?.title) return options;
  const vocabulary = resultSearchVocabulary(spec);
  const alternatives = new Map(vocabulary.map(({ concept, alternatives }) => [concept, alternatives]));
  const expand = (concept, limit = 6) => {
    const terms = (alternatives.get(concept) || []).slice(0, limit);
    return terms.length ? `(${[standard(concept), ...terms.map((term) => formatResearchTerm(term))].join(" OR ")})` : standard(concept);
  };
  add("Include related terms", "Adds a few synonyms or related terms for each idea. Review them for fit before searching.", compile((concept) => expand(concept, 2)));
  add("Widen the vocabulary", "Uses more alternatives for every idea. May find more literature, including less relevant results.", compile((concept) => expand(concept)));
  // Change only one concept at a time to make the effect of expansion understandable.
  for (const { concept, term } of vocabulary) {
    add(`Broaden: ${term}`, `Adds alternatives for “${term}” while keeping the other ideas unchanged.`, compile((candidate) => candidate === concept ? expand(candidate) : standard(candidate)));
  }
  add("Match words anywhere", "Keeps every word, but relaxes automatic phrase matching. Explicit exact phrases stay quoted.", compile((concept) => {
    if (exact(concept) || /\b(?:AND|OR|NOT)\b|[()]/.test(concept.preferredTerm)) return standard(concept);
    const words = concept.preferredTerm.trim().split(/\s+/);
    return words.length > 1 ? `(${words.join(" AND ")})` : standard(concept);
  }));
  add("Match phrases", "Keeps multiword ideas together as phrases for a more focused search.", compile((concept) => {
    if (/\b(?:AND|OR|NOT)\b|[()]/.test(concept.preferredTerm)) return standard(concept);
    return formatResearchTerm(concept.preferredTerm, { exact: concept.preferredTerm.trim().includes(" ") || exact(concept) });
  }));
  // Focused pairs also help short, single-concept topics explore distinct vocabulary.
  if ((spec.concepts || []).filter((concept) => concept.required !== false).length === 1) {
    for (const { concept, term, alternatives: terms } of vocabulary) {
      for (const alternative of terms.slice(0, 4)) {
        add(`Also try: ${alternative}`, `Search “${term}” or “${alternative}”. This related term may cover a different part of your topic.`, compile((candidate) => candidate === concept ? `(${standard(candidate)} OR ${formatResearchTerm(alternative)})` : standard(candidate)));
      }
    }
  }
  return options.slice(0, 12);
}

export function resultQueryFilters(spec) {
  const requirements = spec?.sourceRequirements || {};
  return [
    requirements.peerReviewed && "Peer-reviewed sources",
    (requirements.publicationYearFrom || requirements.publicationYearTo) && `Published ${requirements.publicationYearFrom || "any year"}–${requirements.publicationYearTo || "present"}`,
    spec?.facets?.timePeriod && `Topic period: ${spec.facets.timePeriod}`,
  ].filter(Boolean);
}

/** Shared visibility rules keep in-page navigation aligned with rendered sections. */
export function resultDatabaseRecommendations(plan) {
  const seen = new Set();
  return (plan?.recommendations || []).filter((resource) => {
    const key = resource.id || resource.name;
    if (!key || seen.has(key) || !(resource.accessUrl || resource.url)) return false;
    seen.add(key);
    return true;
  });
}

export function resultSectionLinks({ id, spec, plan, showSources = false }) {
  return [
    showSources && { label: "Sources", href: `#${id}-sources` },
    buildResultQueryOptions(spec).length > 0 && { label: "Search terms", href: `#${id}-terms` },
    resultDatabaseRecommendations(plan).length > 0 && { label: plan?.navigationOnly ? "ZSR resources" : "Databases", href: `#${id}-databases` },
  ].filter(Boolean);
}
