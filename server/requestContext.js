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
  };
}

export function appendRequestContextForAi(history, requestContext = {}) {
  const assignmentContext = cleanContext(requestContext.assignmentContext);
  const plannerContext = cleanContext(requestContext.plannerContext);
  if (!assignmentContext && !plannerContext) return history;

  const latestUserIndex = history.findLastIndex((message) => message.role === "user");
  if (latestUserIndex < 0) return history;

  const additions = [
    plannerContext ? `Guided planner choices for this request:\n${plannerContext}` : "",
    assignmentContext ? `Assignment brief for this request:\n${assignmentContext}` : "",
  ].filter(Boolean);

  return history.map((message, index) => index === latestUserIndex
    ? { ...message, content: `${message.content}\n\n${additions.join("\n\n")}` }
    : message);
}
