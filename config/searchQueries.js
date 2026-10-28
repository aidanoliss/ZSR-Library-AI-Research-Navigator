import { researchSpecQuery, formatResearchTerm, researchFacetExpressions, researchConceptExpressions, conceptTermOptions } from "./researchSpec.js";

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

/** Variants change vocabulary, never invent a method or remove a required facet. */
export function sourceQueryVariants(spec) {
  if (!spec) return [];
  const canonical = researchSpecQuery(spec);
  if (spec.knownItem) return [canonical].filter(Boolean);
  const concepts = (spec.concepts || []).filter((concept) => concept.required !== false && concept.preferredTerm);
  const compile = (variant) => {
    const expressions = researchConceptExpressions(spec, (concept, index) => {
      const synonyms = (concept.synonyms || []).map(clean).filter(Boolean);
      const terms = variant === "expanded"
        ? [concept.preferredTerm, ...synonyms.slice(0, spec.searchExpansion === "full-synonyms" ? 5 : 3)]
        : [synonyms.length && index === variant ? synonyms[0] : concept.preferredTerm];
      const expression = [...new Set(terms.map(clean))].map((term) => formatResearchTerm(term, term === clean(concept.preferredTerm) ? conceptTermOptions(concept) : { exact: concept.exactPhrase === true })).join(" OR ");
      return terms.length > 1 ? `(${expression})` : expression;
    });
    for (const facet of researchFacetExpressions(spec)) if (!expressions.some((expression) => expression.toLowerCase().includes(facet.toLowerCase()))) expressions.push(facet);
    return expressions.join(" AND ");
  };
  const expanded = compile("expanded");
  const swaps = concepts.map((concept, index) => ({ index, words: clean(concept.preferredTerm).split(/\s+/).length }))
    .sort((a, b) => b.words - a.words || a.index - b.index).map(({ index }) => compile(index));
  return [...new Set([...(spec.searchExpansion === "full-synonyms" ? [expanded, canonical] : [canonical, expanded]), ...swaps])].filter(Boolean).slice(0, 5);
}

/**
 * Keyword-only providers (Crossref, OpenAlex search) ignore Boolean operators.
 * Stripping only the word NOT would turn every excluded term into a positive
 * keyword, so remove each NOT clause with its parenthesized or quoted operand.
 */
export function withoutNegatedClauses(query) {
  const value = String(query || "");
  let output = "";
  let index = 0;
  const pattern = /\bNOT\s+/g;
  for (let match = pattern.exec(value); match; match = pattern.exec(value)) {
    output += value.slice(index, match.index);
    let end = match.index + match[0].length;
    if (value[end] === "(") {
      let depth = 0;
      for (; end < value.length; end += 1) {
        if (value[end] === "(") depth += 1;
        else if (value[end] === ")" && --depth === 0) { end += 1; break; }
      }
    } else if (/["“]/.test(value[end] || "")) {
      const close = value.slice(end + 1).search(/["”]/);
      end = close < 0 ? value.length : end + close + 2;
    } else {
      end += (value.slice(end).match(/^[^\s()]+/) || [""])[0].length;
    }
    index = end;
    pattern.lastIndex = end;
  }
  return clean(`${output}${value.slice(index)}`.replace(/\bAND\s*$/i, "").replace(/\bAND\s+(?=AND\b)/gi, "").replace(/\(\s*\)/g, " "));
}

/** A final retrieval fallback, used only after the normal queries yield no matches. */
export function sourceKeywordFallback(spec) {
  if (!spec || spec.knownItem) return "";
  const protectedFacets = [spec.facets?.population, spec.facets?.geography].map((term) => clean(term).toLowerCase()).filter(Boolean);
  // The parser's incidental short grouping is not an explicit phrase request.
  // Preserve every word; keep quoted phrases, named facets and vocabulary intact.
  let relaxed = false;
  const keywords = researchConceptExpressions(spec, (concept) => {
    const term = clean(concept.preferredTerm);
    const words = term.split(/\s+/);
    if (concept.source === "parsed" && !concept.exactPhrase && !protectedFacets.includes(term.toLowerCase()) && words.length >= 2 && words.length <= 3 && /^[\p{L}\p{N}* -]+$/u.test(term)) {
      relaxed = true;
      return `(${words.join(" AND ")})`;
    }
    return formatResearchTerm(term, { exact: concept.exactPhrase === true });
  });
  for (const facet of researchFacetExpressions(spec)) if (!keywords.some((expression) => expression.toLowerCase().includes(facet.toLowerCase()))) keywords.push(facet);
  return relaxed ? keywords.join(" AND ") : "";
}
