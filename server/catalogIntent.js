const TOPIC_OPTION_RE = /\b(brainstorm|options?|angles?|possible topics?|topic ideas?|research questions?|narrow|focus)\b/i;
const CATALOG_DISCOVERY_RE = /\b(articles?|books?|sources?|evidence|results?|databases?|catalog|journals?|search terms?|keywords?|pdf|full[-\s]?text|doi|pmid)\b/i;
const CITATION_ONLY_RE = /\b(citat|cite|apa|mla|chicago|zotero|bibliograph)\b/i;
const EVALUATION_ONLY_RE = /\b(evaluat(?:e|es|ed|ing|ion)?|credible|quality|authority|bias)\b/i;

export function shouldLookupCatalog(text, responseStyle, userTurnCount = 1) {
  const value = String(text || "");
  if (!value.trim()) return false;

  const asksForDiscovery = CATALOG_DISCOVERY_RE.test(value);
  if (responseStyle === "hybrid") {
    if ((CITATION_ONLY_RE.test(value) || EVALUATION_ONLY_RE.test(value)) && !asksForDiscovery) return false;
    return true;
  }
  if (TOPIC_OPTION_RE.test(value) && !asksForDiscovery) return false;
  if ((CITATION_ONLY_RE.test(value) || EVALUATION_ONLY_RE.test(value)) && !asksForDiscovery) return false;
  if (userTurnCount > 1) return asksForDiscovery;
  if (responseStyle === "plan" || responseStyle === "answer") return asksForDiscovery;
  return responseStyle === "sources" || asksForDiscovery;
}
