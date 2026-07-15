import { isZsrNavigationRequest } from "../config/researchAgent.js";

const MAX_CONTEXT_TURNS = 4;

export function submittedResearchContext(messages = [], endIndex = messages.length) {
  const submittedTurns = messages
    .slice(0, Math.max(0, endIndex))
    .filter((message) => message?.role === "user")
    .map((message) => String(message.content || "").trim())
    .filter(Boolean);

  if (!submittedTurns.length) return "";
  const researchTurns = submittedTurns.filter((turn) => !isZsrNavigationRequest(turn));
  const relevantTurns = researchTurns.length ? researchTurns : submittedTurns;
  return relevantTurns.slice(-MAX_CONTEXT_TURNS).join(" ");
}
