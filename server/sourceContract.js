import { recommendLibrarianRoutes } from "../config/librarianRoutes.js";

export function applySourceContract(reply, resources, plan, liveResults, responseStyle, context = {}) {
  if (!reply) return reply;

  const topic = plan?.researchSpec?.topic || context.topic || "";
  const modeId = context.modeId || plan?.modeId || plan?.researchSpec?.mode || "scholarly";
  // Contact names and links come only from the governed directory. Model output
  // cannot invent or override a person-level librarian route.
  const governedReply = {
    ...reply,
    librarian_routes: recommendLibrarianRoutes(topic, modeId, resources || []),
  };
  if (!["hybrid", "sources"].includes(responseStyle)) return governedReply;

  const sourceRoutes = resources || [];
  const routedDatabases = sourceRoutes.filter((resource) => resource.recommended_query);
  const startingPoints = sourceRoutes.map((resource) => ({
    resource_name: resource.name,
    url: resource.url,
    why: resource.why || resource.description,
  }));
  const databaseStrategy = routedDatabases.map((resource) => ({
    database: resource.name,
    az_area: resource.type,
    why: resource.why || resource.description,
    search_inside: [resource.recommended_query, ...(resource.recommended_filters || [])],
    journals_or_sources: [resource.expect].filter(Boolean),
  }));
  const usesCrossrefFallback = liveResults?.some((result) => /crossref/i.test(result.sourceProvider || ""));
  const sourceNotice = liveResults?.length
    ? usesCrossrefFallback
      ? "These source leads may or may not be fully relevant. Some come from Crossref bibliographic metadata because ZSR discovery returned too few records; search each title through ZSR and confirm relevance, source type, and access before using it."
      : "These automated source leads may or may not be fully relevant to your search. Open each record and confirm its topic, evidence, source type, and access before using it."
    : "No verified source records were returned after the ZSR and scholarly-metadata searches. Do not treat the database routes below as citations; revise one concept or ask a librarian before using sources.";

  return {
    ...governedReply,
    source_notice: sourceNotice,
    starting_points: startingPoints,
    database_strategy: databaseStrategy,
    search_terms: plan?.searchTerms || governedReply.search_terms || [],
  };
}

export function transparentSourceFallback(responseStyle) {
  if (!["hybrid", "sources"].includes(responseStyle)) return null;
  return {
    message: "The AI answer could not be generated, so I have not substituted a canned response. The named ZSR databases and searches below were built directly from your submitted topic.",
  };
}
