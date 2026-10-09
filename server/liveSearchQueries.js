import { researchSpecQuery } from "../config/researchSpec.js";
import { sourceQueryVariants } from "../config/searchQueries.js";

/** Search the unqualified topic first; narrower plan variants are fallbacks. */
export function liveSearchQueries(plan, fallbackText = "") {
  if (!plan) return [fallbackText].filter(Boolean);
  if (plan.researchSpec) return sourceQueryVariants(plan.researchSpec);
  const catalogQueries = (plan.recommendations || [])
    .filter((resource) => resource.id === "primo")
    .flatMap((resource) => resource.searchTerms || []);
  const planQueries = [
    ...(plan.searchTerms || []),
    ...(plan.fallbacks || []).map((fallback) => fallback.query),
    ...(plan.recommendations || []).flatMap((resource) => resource.searchTerms || []),
  ];
  const canonical = researchSpecQuery(plan.researchSpec);
  const compiled = [...new Set([canonical, ...catalogQueries, ...planQueries]
    .map((query) => String(query || "").trim())
    .filter(Boolean))].slice(0, 5);
  return compiled.length ? compiled : [fallbackText].filter(Boolean);
}
