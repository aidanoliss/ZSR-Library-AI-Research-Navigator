import { isSearchRefinementFollowup } from "../src/conversationContext.js";

const TOPIC_OPTION_RE = /\b(brainstorm|options?|angles?|possible topics?|topic ideas?|research questions?|narrow|focus)\b/i;
const CATALOG_DISCOVERY_RE = /\b(articles?|books?|sources?|papers?|stud(?:y|ies)|literature|evidence|results?|databases?|catalog|journals?|search terms?|keywords?|pdf|full[-\s]?text|doi|pmid)\b/i;
const CITATION_ONLY_RE = /\b(citat|cite|apa|mla|chicago|zotero|bibliograph)\b/i;
const EVALUATION_ONLY_RE = /\b(evaluat(?:e|es|ed|ing|ion)?|credible|quality|authority|bias)\b/i;

export function shouldLookupCatalog(text, responseStyle, userTurnCount = 1, options = {}) {
  // An edited ResearchSpec is an explicit request to run discovery again,
  // even when the correction prompt itself does not contain a search keyword.
  if (options.correctedResearchSpec) return true;
  const value = String(text || "");
  if (!value.trim()) return false;

  const asksForDiscovery = CATALOG_DISCOVERY_RE.test(value);
  // A completed guided brief and an update to an existing search are source
  // requests even when the student's wording contains no discovery keyword.
  if (String(options.plannerContext || "").trim()) return true;
  if (options.previousResearchSpec && isSearchRefinementFollowup(value)) return true;
  if (responseStyle === "hybrid") {
    if ((CITATION_ONLY_RE.test(value) || EVALUATION_ONLY_RE.test(value)) && !asksForDiscovery) return false;
    return true;
  }
  if (TOPIC_OPTION_RE.test(value) && !asksForDiscovery) return false;
  if ((CITATION_ONLY_RE.test(value) || EVALUATION_ONLY_RE.test(value)) && !asksForDiscovery) return false;
  if (userTurnCount > 1) return asksForDiscovery;
  if (responseStyle === "plan" || responseStyle === "answer") return true;
  return responseStyle === "sources" || asksForDiscovery;
}
