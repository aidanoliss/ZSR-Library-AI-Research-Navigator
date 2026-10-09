import { sourceKeywordFallback, sourceQueryVariants } from "./searchQueries.js";
import { sourceRequirementFilters } from "./sourceRequirements.js";

/** Preview a wording change without removing concepts, exclusions, or filters. */
export function buildSearchRefinement(researchSpec) {
  if (!researchSpec || !sourceKeywordFallback(researchSpec)) return null;
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const protectedFacets = [researchSpec.facets?.population, researchSpec.facets?.geography].map((term) => clean(term).toLowerCase()).filter(Boolean);
  const changedTerms = [];
  const concepts = (researchSpec.concepts || []).flatMap((concept, index) => {
    const term = clean(concept.preferredTerm);
    const words = term.split(/\s+/);
    if (concept.required !== false && concept.source === "parsed" && !concept.exactPhrase && !protectedFacets.includes(term.toLowerCase()) && words.length >= 2 && words.length <= 3 && /^[\p{L}\p{N}* -]+$/u.test(term)) {
      changedTerms.push(term);
      return words.map((word, wordIndex) => ({ ...concept, id: `${concept.id || `concept-${index + 1}`}-word-${wordIndex + 1}`, preferredTerm: word, synonyms: [], exactPhrase: false }));
    }
    return [concept];
  });
  if (!changedTerms.length) return null;
  const nextSpec = { ...researchSpec, concepts };
  return {
    researchSpec: nextSpec,
    query: sourceQueryVariants(nextSpec)[0],
    explanation: `Search the words in ${changedTerms.map((term) => `“${term}”`).join(", ")} separately instead of requiring them to appear together. Every word remains required; your filters and exclusions stay unchanged. This may still return no matches.`,
  };
}

/** Never interpret a provider outage, or an unconfigured lane, as zero literature. */
export function emptySearchReason(attempts = []) {
  if (attempts.some((attempt) => ["error", "timeout", "rate_limited", "cancelled"].includes(attempt?.status))) return "search_incomplete";
  const completed = attempts.filter((attempt) => ["empty", "success"].includes(attempt?.status));
  if (!completed.length) return "provider_unavailable";
  if (completed.some((attempt) => attempt.retrievedCount > 0 || attempt.resultCount > 0 || attempt.emptyReason === "no_eligible_records")) return "no_eligible_records";
  return completed.every((attempt) => attempt.retrievedCount === 0 || attempt.emptyReason === "no_records") ? "no_records" : "no_matches";
}

/** An actionable recovery must state its change and carry the complete requirements. */
export function buildSearchRecovery(researchSpec, { outcomes = {}, resultCount = 0 } = {}) {
  if (!researchSpec || resultCount > 0) return null;
  const attempts = Object.values(outcomes).flat().filter(Boolean);
  const failed = attempts.some((attempt) => ["error", "timeout", "rate_limited", "cancelled"].includes(attempt.status));
  const reason = emptySearchReason(attempts);
  const query = sourceQueryVariants(researchSpec)[0] || "";
  const preservedRequirements = [
    `Source type: ${researchSpec.sourceContract?.label || researchSpec.mode || "current selection"}`,
    ...sourceRequirementFilters(researchSpec.sourceRequirements),
    ...["population", "geography", "timePeriod", "method"].filter((name) => researchSpec.facets?.[name]).map((name) => `${name}: ${researchSpec.facets[name]}`),
  ];
  if (failed) return {
    kind: "retry", reason, query, researchSpec, changes: ["Retry the same search; no requirements change."], preservedRequirements,
    buttonLabel: "Retry source search",
    explanation: "A source provider did not complete its search. This does not establish that no relevant sources exist.",
  };
  const optional = (researchSpec.concepts || []).filter((concept) => concept.required === false);
  const expandedSpec = { ...researchSpec, searchExpansion: "full-synonyms" };
  const expandedQuery = sourceQueryVariants(expandedSpec)[0] || "";
  const recordedQueries = attempts.map((attempt) => attempt.query).filter(Boolean);
  const attempted = new Set(recordedQueries.length ? recordedQueries : sourceQueryVariants(researchSpec).slice(0, 3));
  const completed = attempts.some((attempt) => ["empty", "success"].includes(attempt.status));
  if (completed && expandedQuery && !attempted.has(expandedQuery)) return {
    kind: "broaden", reason, query: expandedQuery, researchSpec: expandedSpec,
    buttonLabel: "Search with more synonyms",
    explanation: "Search additional equivalent terms while keeping every required concept and assignment filter.",
    changes: (researchSpec.concepts || []).filter((concept) => concept.required !== false && concept.synonyms?.length > 3)
      .map((concept) => `Add alternatives for ${concept.preferredTerm}: ${concept.synonyms.slice(3, 5).join(", ")}.`),
    preservedRequirements,
  };
  return {
    kind: "manual", reason, query, researchSpec, buttonLabel: "Edit search",
    explanation: reason === "no_eligible_records"
      ? "The providers returned records, but none passed the current topic and assignment checks. Review the requirements or try a subject database."
      : reason === "no_records"
        ? "The completed searches returned no records for these terms. Try different wording or search a subject database; this does not establish that no relevant sources exist."
        : completed
          ? "The completed searches found no leads passing the current checks. Review the topic wording or try a subject database."
          : "Live discovery is unavailable for this request. Use the database links or edit the search.",
    changes: optional.length ? ["Optional concepts are already excluded from source queries; required concepts remain in place."] : ["No automatic change can safely broaden this search while preserving the stated requirements."],
    preservedRequirements,
  };
}
