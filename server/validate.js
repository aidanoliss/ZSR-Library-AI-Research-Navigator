/**
 * Binds model-generated starting-point links to the curated resource registry.
 * Bibliographic source links come separately from server-side retrieval.
 *
 * The model could, despite instructions, hallucinate a URL or a database name.
 * This pass inspects the clickable link surface (the recommended starting_points)
 * and:
 *   - keeps a link whose URL exactly matches a curated resource,
 *   - CORRECTS a link to the canonical curated URL if the model named a real
 *     resource but got the URL slightly wrong,
 *   - DROPS a link that matches no curated resource at all (an invention).
 *
 * Evidence notes additionally require a retrieved source ID and an exact supplied
 * abstract quotation. This establishes quotation provenance, not claim entailment.
 * Returns the cleaned reply plus a small report so the caller can log drops.
 */

import { normalizeSearchOptionKey } from "../config/researchAgent.js";
import { validateEvidenceNotes } from "./sourceEvidence.js";

export function searchOrientation(liveResults = []) {
  return liveResults.length
    ? "Review the source records and provider abstracts below. This pilot does not generate research conclusions; check each source's methods, findings, and limitations before using it."
    : "Use the search brief and suggested databases to continue researching. No source-supported answer has been generated for this request.";
}

/** Normalize a URL for forgiving comparison (trailing slash, case, protocol). */
function normalizeUrl(url) {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

export function validateReply(reply, resources, liveResults = []) {
  const report = { dropped: [], corrected: [] };
  if (!reply) return { reply, report };
  const evidence = validateEvidenceNotes(reply, liveResults);
  report.evidenceDropped = evidence.dropped;

  const byUrl = new Map();
  const byName = new Map();
  for (const r of resources) {
    byUrl.set(normalizeUrl(r.url), r);
    byName.set(normalizeName(r.name), r);
  }

  let cleanedStartingPoints = reply.starting_points;
  if (Array.isArray(reply.starting_points)) {
    cleanedStartingPoints = [];
    for (const sp of reply.starting_points) {
      const urlMatch = byUrl.get(normalizeUrl(sp.url));
      if (urlMatch) {
        cleanedStartingPoints.push({ resource_name: urlMatch.name, url: urlMatch.url, why: urlMatch.why || urlMatch.description || "" });
        continue;
      }

      const nameMatch = byName.get(normalizeName(sp.resource_name));
      if (nameMatch) {
        // Real resource, wrong/invented URL → snap to the canonical curated URL.
        report.corrected.push({ name: sp.resource_name, from: sp.url, to: nameMatch.url });
        cleanedStartingPoints.push({ resource_name: nameMatch.name, url: nameMatch.url, why: nameMatch.why || nameMatch.description || "" });
        continue;
      }

      // Matches nothing curated → drop it entirely.
      report.dropped.push({ name: sp.resource_name, url: sp.url });
    }
  }

  const routedResources = resources.filter(
    (resource) => resource.recommended_query && resource.recommended_filters?.length
  );
  let databaseStrategy = reply.database_strategy;
  if (routedResources.length && Array.isArray(reply.database_strategy)) {
    const modelByName = new Map(
      reply.database_strategy.map((entry) => [normalizeName(entry.database), entry])
    );
    databaseStrategy = routedResources.map((resource) => {
      const modelEntry = modelByName.get(normalizeName(resource.name)) || {};
      return {
        database: resource.name,
        az_area: resource.type,
        why: resource.why || resource.description,
        search_inside: [
          resource.recommended_query,
          ...resource.recommended_filters,
        ],
        journals_or_sources: [],
      };
    });
  }

  let searchTerms = reply.search_terms;
  if (Array.isArray(reply.search_terms)) {
    const reserved = new Set(
      routedResources.map((resource) => normalizeSearchOptionKey(resource.recommended_query))
    );
    const seen = new Set(reserved);
    searchTerms = reply.search_terms.filter((term) => {
      const key = normalizeSearchOptionKey(term);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return {
    reply: {
      // Allowlist the pilot response. A disclaimer or a citation-shaped string
      // cannot validate free-form model claims in message or auxiliary fields.
      message: searchOrientation(liveResults),
      guidance_policy: "evidence_only",
      ...evidence.fields,
      ...(Array.isArray(cleanedStartingPoints) ? { starting_points: cleanedStartingPoints } : {}),
      ...(routedResources.length && Array.isArray(databaseStrategy) ? { database_strategy: databaseStrategy } : {}),
      ...(Array.isArray(searchTerms) ? { search_terms: searchTerms } : {}),
    },
    report,
  };
}
