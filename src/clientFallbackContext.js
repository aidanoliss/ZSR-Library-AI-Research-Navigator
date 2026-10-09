import { startsIndependentResearchTurn } from "./conversationContext.js";

/** Match the server's continuation rules when the transport cannot return a plan. */
export function clientFallbackContext({ latestUserText = "", hasPriorTopic = false, previousResearchSpec, researchSpec, assignmentContext = "", plannerContext = "" } = {}) {
  return {
    latestUserText,
    assignmentContext,
    plannerContext,
    researchSpec: researchSpec || undefined,
    previousResearchSpec: hasPriorTopic && !startsIndependentResearchTurn(latestUserText, true)
      ? previousResearchSpec || undefined
      : undefined,
  };
}
