import { applyScopePriorities } from "./searchClarification.js";
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
  if (text === String(current.topic || "").trim()) return { ...current, sourceRequirements };
  // Keep an explicit preference when the same scope is present in the edited topic.
  const matchingPreferences = Object.fromEntries(Object.entries(current.preferredFacets || {}).filter(([key, value]) => String(fresh.facets?.[key] || "").toLowerCase() === String(value).toLowerCase()).map(([key]) => [key, "preferred"]));
  return applyScopePriorities({ ...fresh, sourceRequirements }, matchingPreferences);
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

/** Add user-supplied scope without inventing facts or discarding the original request. */
export function improveResearchPrompt(topic, scope = {}) {
  const original = String(topic || "").trim();
  if (!original) return "";
  const fields = [["comparison", "versus"], ["population", "among"], ["geography", "in"], ["method", "using"]];
  const additions = fields.flatMap(([key, label]) => {
    const value = String(scope[key] || "").trim();
    return value ? [`${label} ${value}`] : [];
  });
  return [original, ...additions].join("\n");
}
