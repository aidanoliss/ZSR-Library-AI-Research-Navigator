import { describeSourceRole } from "./sourceLearning.js";
import { assessSourceRequirements, sourcePublicationYear, sourceRequestFitTier } from "./sourceAssessment.js";
import { sourceFitSummary } from "./sourceFitFeedback.js";

/**
 * Pick up to three returned sources to open first, with a plain reason for
 * each, plus one search tip when the results are thin. Everything is derived
 * from provider metadata and the app's own match checks, so nothing here can
 * state a finding or name a source that was not returned.
 */

export function sourceKey(result = {}) {
  return String(result.doi || result.url || result.id || result.title || "");
}

function coversTopic(result) {
  const fit = result.matchExplanation;
  return sourceRequestFitTier(result) >= 2
    && Array.isArray(fit?.missingConcepts) && fit.missingConcepts.length === 0;
}

function hasAbstract(result) {
  return String(result.abstractText || result.abstractExcerpt || "").trim().length >= 80;
}

export function whereToStart(results = [], spec = {}, { currentYear = new Date().getFullYear(), incomplete = false } = {}) {
  const ranked = (Array.isArray(results) ? results : []).filter((result) => result?.title && sourceKey(result))
    .map((result) => result.sourceAssessment ? result : { ...result, sourceAssessment: assessSourceRequirements(result, spec) });
  // A search that did not finish returns an arbitrary subset; recommending
  // from it would present a partial list as the best starting point.
  if (incomplete && ranked.length < 5) return { picks: [], tip: "The library search didn't fully finish, so these results are incomplete. Search again before choosing sources." };
  const full = ranked.filter(coversTopic);
  const supported = full.filter((result) => sourceRequestFitTier(result) === 3);
  const candidates = supported.length ? supported : full;
  const picks = [];
  const add = (result, reason) => {
    if (!result || picks.length >= 3 || picks.some((pick) => pick.key === sourceKey(result))) return;
    const warnings = sourceFitSummary(result.sourceAssessment).attention.map((check) => check.message + ".");
    if (result.matchExplanation?.missingFacets?.length && !warnings.length) warnings.push("Check the requested scope in the source.");
    picks.push({ key: sourceKey(result), title: result.title, reason: [reason, ...warnings].join(" ") });
  };
  const terms = spec?.comparison?.terms || [];
  const comparisons = terms.length === 2
    ? candidates.filter((result) => result.matchExplanation?.category === "direct-comparison")
    : [];
  const books = spec?.mode === "books" || spec?.mode === "primary";

  if (comparisons.length) {
    const sides = terms.map((term) => term.replace(/\*/g, "")).join(" and ");
    add(comparisons[0], `The title or abstract indicates a comparison of ${sides}. Check the groups and design.`);
  }
  if (books) {
    const located = candidates.find((result) => result.fulfillment?.location && !/unavailable|checked out|missing|lost/i.test(result.fulfillment.statusLabel || ""));
    if (located) {
      const { location, callNumber } = located.fulfillment;
      add(located, `Check availability at ${location}${callNumber ? `, ${callNumber}` : ""}.`);
    }
  } else {
    const overview = candidates.find((result) => ["synthesis", "review"].includes(describeSourceRole(result).id));
    if (overview) add(overview, "The record indicates a review. Use it to get oriented in the literature.");
  }
  const remaining = candidates.filter((result) => !picks.some((pick) => pick.key === sourceKey(result)));
  const best = remaining.find(hasAbstract) || remaining[0];
  if (best) add(best, hasAbstract(best) ? "Topic terms appear in the record. Skim the abstract to check relevance." : "Topic terms appear in the record. Open it to check relevance.");
  const dated = candidates.map((result) => ({ result, year: sourcePublicationYear(result) }))
    .filter((item) => item.year && item.year >= currentYear - 3);
  // Skip a newest lead already picked for another reason; ties fall to rank.
  const newest = dated.sort((a, b) => b.year - a.year).find((item) => !picks.some((pick) => pick.key === sourceKey(item.result)));
  if (newest && newest.year >= (dated[0]?.year || 0) - 1) add(newest.result, `One of the newest leads (${newest.year}).`);

  const tip = !ranked.length ? ""
    : !full.length ? "The available metadata doesn't show every required topic in any lead. Try “More ways to search” below, or review the concepts with Edit search."
      : terms.length === 2 && !comparisons.length ? "A direct comparison remains unconfirmed. Read one source on each side, or ask a librarian about comparative studies."
        : full.length < 3 ? "Only a few records mention every required topic. The database search strings below can find more."
          : "";
  return picks.length || tip ? { picks, tip } : null;
}
