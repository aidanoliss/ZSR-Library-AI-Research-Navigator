import { describeSourceRole } from "./sourceLearning.js";
import { sourcePublicationYear } from "./sourceAssessment.js";

/**
 * Pick up to three returned sources to open first, with a plain reason for
 * each, plus one search tip when the results are thin. Everything is derived
 * from provider metadata and the app's own match checks, so nothing here can
 * state a finding or name a source that was not returned.
 */

export function sourceKey(result = {}) {
  return String(result.doi || result.url || result.id || result.title || "");
}

function fullMatch(result) {
  const fit = result.matchExplanation;
  if (!fit || fit.status === "mismatch" || fit.excludedMatches?.length) return false;
  return Array.isArray(fit.missingConcepts) && fit.missingConcepts.length === 0;
}

function hasAbstract(result) {
  return String(result.abstractText || result.abstractExcerpt || "").trim().length >= 80;
}

export function whereToStart(results = [], spec = {}, { currentYear = new Date().getFullYear(), incomplete = false } = {}) {
  const ranked = (Array.isArray(results) ? results : []).filter((result) => result?.title && sourceKey(result));
  // A search that did not finish returns an arbitrary subset; recommending
  // from it would present a partial list as the best starting point.
  if (incomplete && ranked.length < 5) return { picks: [], tip: "The library search didn't fully finish, so these results are incomplete. Search again before choosing sources." };
  const full = ranked.filter(fullMatch);
  const picks = [];
  const add = (result, reason) => {
    if (!result || picks.length >= 3 || picks.some((pick) => pick.key === sourceKey(result))) return;
    picks.push({ key: sourceKey(result), title: result.title, reason });
  };
  const terms = spec?.comparison?.terms || [];
  const comparisons = terms.length === 2 ? ranked.filter((result) => result.matchExplanation?.category === "direct-comparison") : [];
  const books = spec?.mode === "books" || spec?.mode === "primary";

  if (comparisons.length) add(comparisons[0], `Directly compares ${terms[0].replace(/\*/g, "")} and ${terms[1].replace(/\*/g, "")}.`);
  if (books) {
    const shelf = full.find((result) => result.fulfillment?.location && !/unavailable|checked out|missing|lost/i.test(result.fulfillment.statusLabel || ""));
    if (shelf) add(shelf, `On the shelf: ${shelf.fulfillment.location}${shelf.fulfillment.callNumber ? `, ${shelf.fulfillment.callNumber}` : ""}.`);
  } else {
    const overview = full.find((result) => ["synthesis", "review"].includes(describeSourceRole(result).id));
    if (overview) add(overview, describeSourceRole(overview).id === "synthesis" ? "A research review: a quick overview of what has been studied." : "A review article: useful background before reading individual studies.");
  }
  const best = full.find((result) => hasAbstract(result) && !picks.some((pick) => pick.key === sourceKey(result))) || full[0];
  if (best) add(best, describeSourceRole(best).id === "study" ? "A study that matches every part of your topic." : hasAbstract(best) ? "Matches every part of your topic, with an abstract to skim first." : "Matches every part of your topic.");
  const dated = full.map((result) => ({ result, year: sourcePublicationYear(result) })).filter((item) => item.year && item.year >= currentYear - 3);
  // Skip a newest match already picked for another reason; ties fall to rank.
  const newest = dated.sort((a, b) => b.year - a.year).find((item) => !picks.some((pick) => pick.key === sourceKey(item.result)));
  if (newest && newest.year >= (dated[0]?.year || 0) - 1) add(newest.result, `One of the newest matches (${newest.year}).`);

  const tip = !ranked.length ? ""
    : !full.length ? "None of these match every idea in your topic. Try “More ways to search” below, or remove one concept with Edit search."
      : terms.length === 2 && !comparisons.length ? "No result clearly compares both sides. Read one source on each side, or ask a librarian about comparative studies."
        : full.length < 3 ? "Only a few results match every idea. The database search strings below can find more."
          : "";
  return picks.length || tip ? { picks, tip } : null;
}
