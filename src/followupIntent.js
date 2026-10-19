/**
 * Recognize follow-ups that ask for help with the current search rather than
 * a new topic or a fresh round of sources. Only "more search terms" is handled
 * specially today; anything else returns null and uses the normal search.
 */

const TERM_WORDS = /\b(?:search\s+terms?|keywords?|key\s+words|synonyms?|search\s+words|terms|words|phrases|search\s+strings?|boolean(?:\s+(?:strings?|searches|queries))?|vocabulary|subject\s+headings?|ways\s+to\s+(?:search|phrase\s+(?:it|this)))\b/i;
const MORE_WORDS = /\b(?:more|other|different|additional|alternative|alternate|new|extra|related|better|else|another|any|some|similar)\b/i;
const FILLER = new Set([
  "can", "could", "would", "you", "please", "give", "provide", "show", "suggest", "list", "find", "get", "need", "want", "help", "me", "with",
  "more", "other", "different", "additional", "alternative", "alternate", "new", "extra", "related", "better", "else", "another", "any", "some", "similar",
  "search", "searches", "searching", "terms", "term", "keywords", "keyword", "key", "words", "word", "synonyms", "synonym", "phrases", "phrase", "strings", "string",
  "boolean", "queries", "query", "vocabulary", "subject", "headings", "heading", "ways", "way", "phrase", "it", "this", "that", "my", "the", "a", "an", "to", "for",
  "try", "use", "using", "i", "could", "should", "what", "are", "there", "of", "on", "in", "topic", "research", "these", "those", "ideas", "options", "instead", "also", "too", "now", "thanks", "thank",
]);

function topicalWords(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter((word) => word.length > 1 && !FILLER.has(word));
}

export function followupIntent(text) {
  const value = String(text || "").trim();
  if (!value || value.length > 240) return null;
  const asksForTerms = /\bwhat else (?:can|could|should) i (?:search|type|try|look up)\b/i.test(value)
    || /\b(?:synonyms?|alternative (?:words|terms|keywords)|other ways to (?:say|phrase|search))\b/i.test(value)
    || (TERM_WORDS.test(value) && MORE_WORDS.test(value));
  // "More search terms about climate refugees" names a new topic; leave that
  // to the normal search so the student's new idea is not ignored.
  if (asksForTerms && topicalWords(value).length === 0) return "more-search-terms";
  return null;
}
