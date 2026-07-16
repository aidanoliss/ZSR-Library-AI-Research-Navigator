export function applySourceContract(reply, resources, plan, liveResults, responseStyle) {
  if (!reply || !["hybrid", "sources"].includes(responseStyle)) return reply;

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
  const sourceNotice = liveResults?.length
    ? "These automated source leads may or may not be fully relevant to your search. Open each record and confirm its topic, evidence, source type, and access before using it."
    : "No live catalog records passed the relevance check. The named ZSR routes and searches below are still useful starting points, but their results may or may not be fully relevant; verify each item you open.";

  return {
    ...reply,
    source_notice: sourceNotice,
    starting_points: startingPoints,
    database_strategy: databaseStrategy,
    search_terms: plan?.searchTerms || reply.search_terms || [],
  };
}

export function transparentSourceFallback(responseStyle) {
  if (!["hybrid", "sources"].includes(responseStyle)) return null;
  return {
    message: "The AI answer could not be generated, so I have not substituted a canned response. The named ZSR databases and searches below were built directly from your submitted topic.",
  };
}
