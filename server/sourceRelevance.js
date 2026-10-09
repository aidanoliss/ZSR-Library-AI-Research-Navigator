import { uniqueSourceResults } from "../src/sourceDedup.js";
import { assessSourceRequirements } from "../src/sourceAssessment.js";

const STOPWORDS = new Set(["a", "an", "and", "or", "of", "the", "in", "on", "to", "for", "with"]);

function tokens(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+/g)?.filter((word) => !STOPWORDS.has(word))
    .map((word) => word.length > 4 ? word.replace(/ies$/, "y").replace(/(?:ing|ed|s)$/, "") : word) || [];
}

function termMatches(term, words) {
  if (/\s+OR\s+/i.test(term)) return String(term).split(/\s+OR\s+/i).some((alternative) => termMatches(alternative, words));
  const required = tokens(term);
  return required.length > 0 && required.every((word) => words.has(word));
}

function evidenceExcerpt(text, terms, limit = 360) {
  // A matching method or concept may occur near the end of a long abstract.
  const sentences = String(text).split(/(?<=[.!?])\s+/);
  const sentence = sentences.find((part) => terms.some((term) => termMatches(term, new Set(tokens(part))))) || String(text);
  if (sentence.length <= limit) return sentence;
  const termWords = terms.flatMap(tokens);
  const match = [...sentence.matchAll(/[a-z0-9]+/gi)].find((word) => tokens(word[0]).some((token) => termWords.includes(token)));
  const start = Math.max(0, (match?.index || 0) - 80);
  return sentence.slice(start, start + limit);
}

function identityText(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function titleIdentity(value) {
  return identityText(value).replace(/^(?:a|an|the)\s+/, "");
}

function actualAuthorNames(source) {
  const name = (value) => {
    if (typeof value === "string") return value.trim();
    if (!value || typeof value !== "object") return "";
    const display = value.displayName || value.display_name || value.name;
    if (typeof display === "string") return display.trim();
    return [value.given, value.family].filter((part) => typeof part === "string").join(" ").trim();
  };
  return [...(Array.isArray(source.authors) ? source.authors : []), ...(Array.isArray(source.author) ? source.author : [source.author])]
    .flatMap((author) => name(author).split(/\s*[;|]\s*/)).filter(Boolean);
}

function actualAuthorMatch(source, requestedAuthor) {
  if (!requestedAuthor) return null;
  const requested = identityText(requestedAuthor).split(" ").filter(Boolean);
  const authors = actualAuthorNames(source);
  if (!authors.length) return null;
  return authors.some((author) => {
    const supplied = new Set(identityText(author).split(" "));
    // Full requested name tokens must occur in one actual author field. A name
    // mentioned in the title/abstract, or just a matching initial, is insufficient.
    return requested.length > 0 && requested.every((word) => supplied.has(word));
  });
}

/** Bibliographic identity is assessed separately from discussion of the requested work. */
export function assessKnownItemIdentity(source, spec) {
  const item = spec?.knownItem;
  if (!item?.title) return null;
  const requestedTitle = titleIdentity(item.title);
  const actualTitle = titleIdentity(source.title);
  const mainTitle = titleIdentity(String(source.title || "").split(/\s*[:：]\s*/)[0]);
  const titleMatch = Boolean(requestedTitle && (actualTitle === requestedTitle || mainTitle === requestedTitle));
  const authorMatch = actualAuthorMatch(source, item.author);
  const identifierChecks = [
    [item.doi, source.doi, (value) => String(value || "").toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "").trim()],
    [item.pmid, source.pmid, (value) => String(value || "").replace(/\D/g, "")],
    [item.isbn, source.isbn, (value) => String(value || "").toUpperCase().replace(/[^0-9X]/g, "")],
  ].filter(([requested]) => requested).map(([requested, actual, normalize]) => actual ? normalize(requested) === normalize(actual) : null);
  const identifierMatch = !identifierChecks.length || identifierChecks.every((match) => match === null) ? null
    : identifierChecks.some((match) => match === false) ? false : true;
  const recordType = String(source.type || "").toLowerCase().replace(/[_-]/g, " ");
  const typeMismatch = item.kind === "article" ? /\b(?:book|ebook|e book|monograph|chapter)\b/.test(recordType)
    : item.kind === "book" ? Boolean(recordType && !/\b(?:book|ebook|e book|monograph)\b/.test(recordType)) : false;
  const exact = identifierMatch !== false && !typeMismatch && (identifierMatch === true || (titleMatch && (!item.author || authorMatch === true)));
  const mentioned = termMatches(item.title, new Set(tokens([source.title, source.abstractText || source.abstractExcerpt, ...(source.subjects || [])].join(" "))));
  const status = exact ? "exact" : titleMatch && authorMatch === null && identifierMatch !== false && !typeMismatch ? "unverified" : mentioned || titleMatch ? "related" : "mismatch";
  return {
    status, titleMatch, authorMatch, identifierMatch, typeMatch: !typeMismatch,
    basis: identifierMatch === true ? "identifier" : exact ? item.author ? "title-and-author-fields" : "title-field" : "metadata-identity-check",
    explanation: exact
      ? identifierMatch === true ? "The supplied identifier matches the provider record. Confirm the edition or version in the linked record."
        : item.author ? "The requested title and supplied author match the bibliographic fields. Confirm the edition or version in the linked record."
          : "The requested title matches the provider title. No author was specified; confirm the author, edition, and version in the linked record."
      : status === "unverified" ? "The title matches, but author metadata is missing. The requested item's identity is not established."
        : status === "related" ? `This is a related work, not a matched copy of the requested item.${!titleMatch ? " Its title differs from the requested title." : ""}${item.author && authorMatch === false ? " Its author field does not match the requested author." : ""}${typeMismatch ? " Its document type differs from the requested item." : ""}${identifierMatch === false ? " Its identifier differs from the supplied identifier." : ""}`
          : "The bibliographic fields do not identify the requested work.",
  };
}

export function hasExactKnownItem(results, spec) {
  return Boolean(spec?.knownItem?.title) && (results || []).some((source) => assessKnownItemIdentity(source, spec)?.status === "exact");
}

function knownItemRelevance(source, spec) {
  const identity = assessKnownItemIdentity(source, spec);
  const item = spec.knownItem;
  const evidence = [
    ...(identity.titleMatch ? [{ concept: item.title, field: "title", term: item.title, excerpt: String(source.title).slice(0, 280) }] : []),
    ...(identity.authorMatch ? [{ concept: item.author, field: "authors", term: item.author, excerpt: [...new Set(actualAuthorNames(source))].join("; ").slice(0, 280) }] : []),
    ...(identity.identifierMatch ? [{ concept: "Requested identifier", field: "identifier", term: item.doi || item.pmid || item.isbn, excerpt: source.doi || source.pmid || source.isbn }] : []),
  ];
  return {
    status: identity.status === "exact" ? "meets" : identity.status === "mismatch" ? "mismatch" : identity.status === "unverified" ? "unverified" : "partial",
    category: identity.status === "exact" ? "exact-item" : identity.status === "unverified" ? "possible-item" : "related-work",
    label: identity.status === "exact" ? "Requested item · metadata match" : identity.status === "unverified" ? "Possible requested item · verify author" : "Related work · requested item not matched",
    identity, evidence,
    matchedConcepts: evidence.map((item) => item.concept),
    missingConcepts: [!identity.titleMatch ? item.title : "", item.author && identity.authorMatch !== true ? item.author : ""].filter(Boolean),
    missingFacets: [],
    explanation: identity.explanation,
  };
}

function comparisonRelationship(fields, spec, required) {
  if (!spec?.comparison?.terms?.length) return null;
  const sides = spec.comparison.terms.map((term, index) => required.find((concept) => concept.id === spec.comparison.conceptIds?.[index] || concept.preferredTerm === term) || { preferredTerm: term });
  const anchors = required.filter((concept) => !sides.includes(concept));
  const sideMatches = (text, side) => [side.preferredTerm, ...(side.synonyms || [])].some((term) => termMatches(term, new Set(tokens(text))));
  const textualFields = fields.filter((item) => ["title", "abstract"].includes(item.field));
  const allText = textualFields.map((item) => item.text).join(" ");
  const interventionSides = sides.some((side) => /\b(?:therapy|therapies|treatment|mindfulness|intervention|CBT|MBSR|medication)\b/i.test([side.preferredTerm, ...(side.synonyms || [])].join(" ")));
  const combinationCue = /\b(?:combined|integrated|blended|multicomponent|multi-component)\s+(?:\w+\s+){0,2}(?:intervention|treatment|therapy|program|approach|model|method|technique)s?\b|\b(?:integration|combination) of\b/i;
  const interventionCue = /\b(?:combined? effects|combining|integrating|informed by)\b/i;
  const hasCombinationCue = (text) => combinationCue.test(text) || (interventionSides && interventionCue.test(text));
  const combined = hasCombinationCue(allText) && sides.every((side) => sideMatches(allText, side));
  if (combined) return { status: "combined-approach", explanation: "The metadata describes a combined approach. It does not establish a comparison of the two approaches used separately.", evidence: textualFields.filter((item) => hasCombinationCue(item.text)).map(({ field, text }) => ({ field, excerpt: text.slice(0, 360) })) };
  // A discipline or method such as "comparative politics" is not a comparison
  // of the requested relationship. The anchor topic must occur in that statement.
  const comparisonMarker = /\b(?:compar(?:e|es|ed|ing|ison|isons)|versus|vs|differences? between)\b|\b(?:behave|respond|perform)\b.{0,35}\b(?:like|differently|similarly)\b/i;
  const direct = textualFields.flatMap(({ field, text }) => String(text).split(/(?<=[.!?])\s+/).map((excerpt) => ({ field, excerpt })))
    .find(({ excerpt }) => sides.every((side) => sideMatches(excerpt, side)) && anchors.every((anchor) => sideMatches(excerpt, anchor)) && comparisonMarker.test(excerpt)
      && !/^(?:previous|prior|earlier|other|these studies|this literature|future)\b|\b(?:future (?:studies|research)|further (?:studies|research)).{0,30}\b(?:should|could|will|must|need)/i.test(excerpt)
      && !/\b(?:no|without|lack(?:s|ing)?|not|never)\b.{0,30}\b(?:compar|head.to.head)/i.test(excerpt)
      && !/\b(?:wait[- ]?list|placebo|usual care|control group)\b/i.test(excerpt));
  return direct ? { status: "comparison-indicated", explanation: "The title or abstract explicitly describes a comparison involving both requested concepts. Verify the study groups and design in the source.", evidence: [{ ...direct, excerpt: direct.excerpt.slice(0, 360) }] }
    : { status: "not-established", explanation: "Both terms may occur in the metadata, but a direct comparison between them is not established. Read the methods and study groups.", evidence: [] };
}

/** Metadata evidence is an interpretable ranking signal, not a claim about findings. */
export function assessSourceRelevance(source, researchSpec) {
  if (researchSpec?.knownItem?.title) return knownItemRelevance(source, researchSpec);
  const fields = [
    ["title", source.title],
    ["abstract", source.abstractText || source.abstractExcerpt],
    ["subjects", (source.subjects || []).join("; ")],
    ...(researchSpec?.knownItem?.title ? [["authors", [source.author, ...(source.authors || [])].join(" ")]] : []),
  ].filter(([, text]) => text).map(([field, text]) => ({ field, text, words: new Set(tokens(text)) }));
  const required = (researchSpec?.concepts || []).filter((concept) => concept.required !== false && concept.preferredTerm);
  const evidence = [];
  const matched = [];
  const missing = [];
  for (const concept of required) {
    const terms = [concept.preferredTerm, ...(concept.synonyms || [])];
    const field = fields.find((item) => terms.some((term) => termMatches(term, item.words)));
    if (field) {
      matched.push(concept);
      evidence.push({ concept: concept.preferredTerm, field: field.field, term: terms.find((term) => termMatches(term, field.words)), excerpt: evidenceExcerpt(field.text, terms) });
    } else missing.push(concept);
  }
  const comparisonIds = researchSpec?.comparison?.conceptIds || [];
  const comparisonTerms = researchSpec?.comparison?.terms || [];
  const isComparisonSide = (concept) => comparisonIds.includes(concept.id) || comparisonTerms.includes(concept.preferredTerm);
  const anchors = required.filter((concept) => !isComparisonSide(concept));
  const anchorMatch = anchors.length > 0 && anchors.every((concept) => matched.includes(concept));
  const matchedSides = matched.filter(isComparisonSide).length;
  // Partial comparisons remain explicitly labeled; incomplete non-comparison topics fail closed.
  const partialComparison = comparisonTerms.length >= 2 && anchorMatch && missing.length > 0;
  const topicStatus = !required.length ? "unverified" : !missing.length ? "meets" : partialComparison ? "partial" : "mismatch";
  const relationship = comparisonRelationship(fields, researchSpec, required);
  const category = comparisonTerms.length >= 2 && !missing.length && relationship?.status === "comparison-indicated" ? "direct-comparison"
    : comparisonTerms.length >= 2 && !missing.length ? "supporting"
    : !missing.length && required.length ? "full-topic-match"
      : matchedSides ? "supporting" : "background";
  const label = relationship?.status === "combined-approach" ? "Combined approach · comparison not established"
    : comparisonTerms.length >= 2 && !missing.length && category === "supporting" ? "Topic match · comparison not established"
      : { "direct-comparison": "Comparison indicated · verify design", "full-topic-match": "All topic concepts found", supporting: "Supporting source · partial topic match", background: "Background · partial topic match" }[category];
  const assessment = assessSourceRequirements(source, researchSpec || {});
  const facetChecks = { population: "population", timePeriod: "study-period" };
  const facetTerms = ["population", "geography", "timePeriod"].map((name) => ({ term: researchSpec?.facets?.[name], checkId: facetChecks[name] }));
  const includedMethods = researchSpec?.methodRequirements?.include || [];
  facetTerms.push(...includedMethods.map((term) => ({ term, checkId: `method-include-${term}` })));
  if (!includedMethods.length && !researchSpec?.methodRequirements?.exclude?.length) facetTerms.push({ term: researchSpec?.facets?.method });
  const missingFacets = [...new Set(facetTerms.filter(({ term, checkId }) => {
    if (!term) return false;
    const check = assessment.checks.find((item) => item.id === checkId);
    return check ? check.status !== "meets" : !fields.some(({ words }) => termMatches(term, words));
  }).map(({ term }) => term))];
  const status = topicStatus === "meets" && (missingFacets.length || (relationship && relationship.status !== "comparison-indicated")) ? "partial" : topicStatus;
  const scopeLabel = missingFacets.length && !missing.length
    ? category === "direct-comparison" ? "Comparison indicated · scope needs checking" : category === "full-topic-match" ? "Topic match · scope needs checking" : label
    : label;
  return {
    status, category, label: scopeLabel, evidence, relationship,
    matchedConcepts: matched.map((concept) => concept.preferredTerm),
    missingConcepts: missing.map((concept) => concept.preferredTerm),
    missingFacets,
    explanation: required.length
      ? `Metadata mentions ${matched.map((concept) => concept.preferredTerm).join("; ") || "none of the required concepts"}.${missing.length ? ` Not found in the supplied metadata: ${missing.map((concept) => concept.preferredTerm).join("; ")}.` : ""}${missingFacets.length ? ` Facets not established: ${missingFacets.join("; ")}.` : ""}${relationship ? ` ${relationship.explanation}` : " Read the source to confirm the relationship and findings."}`
      : "Keyword metadata match; read the source to confirm its relevance.",
  };
}

/** Rank the complete deduplicated pool against the original question, independent of query order. */
export function rankSourceResults(results, researchSpec, limit = 10) {
  const ranked = uniqueSourceResults(results).map((result, position) => {
    const sourceAssessment = assessSourceRequirements(result, researchSpec || {});
    const matchExplanation = assessSourceRelevance(result, researchSpec);
    const coverage = matchExplanation.matchedConcepts.length / Math.max(1, matchExplanation.matchedConcepts.length + matchExplanation.missingConcepts.length);
    const categoryScore = { "exact-item": 250, "possible-item": 60, "related-work": 0, "direct-comparison": 50, "full-topic-match": 40, supporting: 15, background: 0 }[matchExplanation.category] || 0;
    const fieldScore = matchExplanation.evidence.reduce((sum, item) => sum + ({ title: 8, abstract: 5, subjects: 2, authors: 4 }[item.field] || 0), 0);
    const unverifiedRequirements = sourceAssessment.checks.filter((check) => check.status === "unverified").length;
    const score = Math.round(coverage * 100 + categoryScore + fieldScore - matchExplanation.missingFacets.length * 5 - unverifiedRequirements * 12 + (sourceAssessment.status === "meets" ? 5 : 0));
    return { ...result, sourceAssessment, matchExplanation, metadataRank: { score, coverage, basis: "title-abstract-subject-metadata" }, _position: position };
  }).filter((result) => result.sourceAssessment.status !== "mismatch" && result.matchExplanation.status !== "mismatch");
  return ranked.sort((a, b) => b.metadataRank.score - a.metadataRank.score || a._position - b._position)
    .slice(0, Math.max(1, limit)).map(({ _position, ...result }) => result);
}
