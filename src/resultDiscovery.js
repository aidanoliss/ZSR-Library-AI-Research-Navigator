import { formatResearchTerm, researchConceptExpressions, researchFacetExpressions, researchSpecQuery } from "../config/researchSpec.js";

/** Variants change phrasing, never required concepts, comparison grouping, or limits. */
export function buildResultQueryOptions(spec) {
  if (!spec?.concepts?.length && !spec?.knownItem?.title) return [];
  const options = [];
  const seen = new Set();
  function add(label, description, query) {
    const key = query.toLowerCase().replace(/\s+/g, " ").trim();
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
  const exact = (concept) => concept.exactPhrase === true || /^known-item/.test(concept.source || "") || /^".*"$/.test(concept.preferredTerm);
  const standard = (concept) => formatResearchTerm(concept.preferredTerm, { exact: exact(concept) });
  add("Start here", "Search all required ideas together.", researchSpecQuery(spec));
  // Known-item titles and authors are deliberate exact matches.
  if (spec.knownItem?.title) return options;
  add("Include related terms", "Uses the alternatives already in your search brief. Check that they match your meaning.", compile((concept) => {
    if (exact(concept)) return standard(concept);
    const terms = [...new Set([concept.preferredTerm, ...(concept.synonyms || []).slice(0, 2)].filter(Boolean))];
    return terms.length > 1 ? `(${terms.map((term) => formatResearchTerm(term)).join(" OR ")})` : standard(concept);
  }));
  add("Match words anywhere", "Keeps every word, but relaxes automatic phrase matching. Explicit exact phrases stay quoted.", compile((concept) => {
    if (exact(concept) || /\b(?:AND|OR|NOT)\b|[()]/.test(concept.preferredTerm)) return standard(concept);
    const words = concept.preferredTerm.trim().split(/\s+/);
    return words.length > 1 ? `(${words.join(" AND ")})` : standard(concept);
  }));
  add("Match phrases", "Looks for multiword ideas as phrases. This can narrow the results.", compile((concept) => {
    if (/\b(?:AND|OR|NOT)\b|[()]/.test(concept.preferredTerm)) return standard(concept);
    return formatResearchTerm(concept.preferredTerm, { exact: concept.preferredTerm.trim().includes(" ") || exact(concept) });
  }));
  return options;
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
