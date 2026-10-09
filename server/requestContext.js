const CONTEXT_LIMIT = 2400;

function cleanContext(value) {
  return String(value || "").trim().slice(0, CONTEXT_LIMIT);
}

export function requestContextFromBody(body = {}) {
  return {
    assignmentContext: cleanContext(body.assignmentContext),
    plannerContext: cleanContext(body.plannerContext),
    researchSpec:
      body.researchSpec && typeof body.researchSpec === "object" && !Array.isArray(body.researchSpec)
        ? body.researchSpec
        : null,
    previousResearchSpec:
      body.previousResearchSpec && typeof body.previousResearchSpec === "object" && !Array.isArray(body.previousResearchSpec)
        ? body.previousResearchSpec
        : null,
  };
}

export function appendRequestContextForAi(history, requestContext = {}) {
  const assignmentContext = cleanContext(requestContext.assignmentContext);
  const plannerContext = cleanContext(requestContext.plannerContext);
  const effectiveSpec = requestContext.researchSpec;
  if (!assignmentContext && !plannerContext && !effectiveSpec) return history;

  const latestUserIndex = history.findLastIndex((message) => message.role === "user");
  if (latestUserIndex < 0) return history;

  const additions = [
    plannerContext ? `Guided planner choices for this request:\n${plannerContext}` : "",
    assignmentContext ? `Assignment brief for this request:\n${assignmentContext}` : "",
    effectiveSpec ? `Current research interpretation (use this topic and these source requirements):\n${cleanContext(JSON.stringify({ topic: effectiveSpec.topic, mode: effectiveSpec.mode, sourceRequirements: effectiveSpec.sourceRequirements, methodRequirements: effectiveSpec.methodRequirements, facets: effectiveSpec.facets, concepts: effectiveSpec.concepts }))}` : "",
    effectiveSpec?.searchIntent ? `Search interpretation (original question and actual retrieval focus; a reformulation is a search strategy, not an established conclusion):\n${cleanContext(JSON.stringify({ searchIntent: effectiveSpec.searchIntent }))}` : "",
  ].filter(Boolean);

  return history.map((message, index) => index === latestUserIndex
    ? { ...message, content: `${message.content}\n\n${additions.join("\n\n")}` }
    : message);
}
