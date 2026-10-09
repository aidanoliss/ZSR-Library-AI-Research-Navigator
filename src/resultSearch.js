import { buildResearchSpec, inferExplicitModeRequest } from "../config/researchSpec.js";
import { sourceRequirementUpdates } from "../config/sourceRequirements.js";

/** A topic edit rebuilds concepts; assignment limits change only when explicitly requested. */
export function reviseSearchTopic(topic, current = {}, mode = "scholarly") {
  const text = String(topic || "").trim();
  const fresh = buildResearchSpec(text, { modeId: inferExplicitModeRequest(text, current.mode || mode) });
  const sourceRequirements = { ...fresh.sourceRequirements, ...current.sourceRequirements, ...sourceRequirementUpdates(text) };
  if (sourceRequirements.publicationYearFrom && sourceRequirements.publicationYearTo && sourceRequirements.publicationYearFrom > sourceRequirements.publicationYearTo) {
    throw new Error("The starting year is later than the ending year. Edit the date requirements in Search strategy.");
  }
  return { ...fresh, sourceRequirements };
}

/** Transport completion does not imply that the source providers succeeded. */
export function searchRunStatus(payload = {}) {
  const outcomes = Object.values(payload.sourceDiscovery?.lanes || {}).filter((lane) => lane.requested).map((lane) => lane.outcome);
  const hasResults = Boolean(payload.liveResults?.length);
  const failed = outcomes.some((outcome) => ["partial", "error", "timeout", "rate_limited", "cancelled", "unavailable"].includes(outcome));
  if (failed) return hasResults ? "partial" : "provider_error";
  if (hasResults) return "complete";
  if (outcomes.some((outcome) => ["empty", "success"].includes(outcome))) return "empty";
  return "not_searched";
}
