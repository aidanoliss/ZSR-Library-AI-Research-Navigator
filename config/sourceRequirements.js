// Assignment constraints travel beside search terms, never inside Boolean text.
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const COUNT = "(?:\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const SOURCE_COUNT_RE = new RegExp(`\\b(${COUNT})\\s+(?:(?:peer[- ]reviewed|scholarly|academic|journal|recent)\\s+)*(?:sources?|articles?|studies|papers?|references?)\\b`, "i");
const YEAR = "(?:18|19|20|21)\\d{2}";
const DATE_RANGE_RE = new RegExp(`\\b(?:published\\s+|publication (?:years?|dates?)\\s*:?\\s*)?(?:between\\s+|from\\s+)?(${YEAR})\\s*(?:[-–]|to|through|and)\\s*(${YEAR})\\b`, "i");
const DATE_BOUND_RE = new RegExp(`\\b(?:published\\s+|publication (?:years?|dates?)\\s*:?\\s*)?(since|after|before|from|until|through)\\s+(${YEAR})\\b`, "i");
const RECENT_RE = /\b(?:published\s+(?:in\s+)?)?(?:the\s+)?(?:last|past|previous)\s+(\d{1,3})\s+years?\b/i;

function year(value) {
  const parsed = typeof value === "number" ? value : /^\d{4}$/.test(String(value || "")) ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed >= 1800 && parsed <= 2199 ? parsed : null;
}

export function normalizeSourceRequirements(value = {}) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const count = Number(raw.requestedSourceCount);
  return {
    publicationYearFrom: year(raw.publicationYearFrom),
    publicationYearTo: year(raw.publicationYearTo),
    peerReviewed: raw.peerReviewed === true,
    requestedSourceCount: Number.isInteger(count) && count > 0 && count <= 100 ? count : null,
  };
}

function dateRequest(text, currentYear) {
  const value = String(text || "");
  const candidates = [DATE_RANGE_RE, RECENT_RE, DATE_BOUND_RE].flatMap((pattern, kind) =>
    [...value.matchAll(new RegExp(pattern.source, "gi"))].map((match) => ({ kind, match,
      explicit: /^(?:published|publication)\b/i.test(match[0]) || /\b(?:sources?|articles?|studies|papers?|books?|publications?)\s*$/i.test(value.slice(0, match.index)),
      // A date-only control or follow-up is a publication filter. A date attached
      // to a topic is its subject period unless publication wording says otherwise.
      standalone: !value.replace(match[0], "").replace(/\b(?:only|please|limit|restrict|it|them|to|the|date|range|years?|use)\b/gi, "").replace(/[\s.,:;!?-]/g, ""),
    }))
  );
  const chosen = candidates.filter((candidate) => candidate.explicit || candidate.standalone)
    .sort((a, b) => Number(b.explicit) - Number(a.explicit) || a.kind - b.kind || a.match.index - b.match.index)[0];
  if (!chosen) return null;
  const { match, kind } = chosen;
  if (kind === 0) return { match: match[0], publicationYearFrom: Number(match[1]), publicationYearTo: Number(match[2]) };
  if (kind === 1) return { match: match[0], publicationYearFrom: currentYear - Number(match[1]) + 1, publicationYearTo: currentYear };
  const bound = match;
  const before = /^(before|until|through)$/i.test(bound[1]);
  return {
    match: bound[0],
    publicationYearFrom: before ? null : Number(bound[2]) + (bound[1].toLowerCase() === "after" ? 1 : 0),
    publicationYearTo: before ? Number(bound[2]) - (bound[1].toLowerCase() === "before" ? 1 : 0) : null,
  };
}

/** Dates left in the topic describe its scope, never silently restrict publication. */
export function subjectDateScope(text, { publicationContext = true } = {}) {
  const value = String(text || "");
  const publication = publicationContext ? dateRequest(value, new Date().getFullYear()) : null;
  const remaining = publication ? value.replace(publication.match, " ") : value;
  const range = remaining.match(/\b(?:from\s+|between\s+)?((?:1\d{3}|20\d{2}|21\d{2})\s*(?:[-–]|to|through|and)\s*(?:1\d{3}|20\d{2}|21\d{2}))\b/i);
  const bound = remaining.match(/\b(?:since|after|before|from|until|through|in)\s+(?:1\d{3}|20\d{2}|21\d{2})\b/i);
  const relative = remaining.match(/\b(?:the\s+)?(?:last|past|previous)\s+\d{1,3}\s+years?\b/i);
  const match = range || bound || relative;
  return match ? { text: match[0], label: range ? range[1] : match[0], note: `“${match[0]}” describes the period being studied; it is not a publication-date limit. Check that each source covers this period.` } : null;
}

export function extractSourceRequirements(text, { currentYear = new Date().getFullYear() } = {}) {
  const value = String(text || "");
  const count = value.match(SOURCE_COUNT_RE)?.[1]?.toLowerCase();
  return normalizeSourceRequirements({
    ...dateRequest(value, currentYear),
    peerReviewed: /\bpeer[- ]reviewed\b/i.test(value) && !/\b(?:not|no|without)\s+(?:necessarily\s+)?peer[- ]reviewed\b/i.test(value),
    requestedSourceCount: NUMBER_WORDS[count] || Number(count),
  });
}

export function sourceRequirementUpdates(text, { currentYear = new Date().getFullYear() } = {}) {
  const value = String(text || "");
  const parsed = extractSourceRequirements(value, { currentYear });
  const updates = {};
  if (parsed.publicationYearFrom !== null) updates.publicationYearFrom = parsed.publicationYearFrom;
  if (parsed.publicationYearTo !== null) updates.publicationYearTo = parsed.publicationYearTo;
  if (/\b(?:any (?:publication )?(?:year|date)|no date (?:limit|restriction))s?\b/i.test(value)) {
    updates.publicationYearFrom = null;
    updates.publicationYearTo = null;
  }
  if (/\bpeer[- ]reviewed\b/i.test(value)) updates.peerReviewed = parsed.peerReviewed;
  if (parsed.requestedSourceCount !== null) updates.requestedSourceCount = parsed.requestedSourceCount;
  return updates;
}

export function stripSourceRequirementText(text) {
  let value = String(text || "");
  const date = dateRequest(value, new Date().getFullYear());
  if (date) value = value.replace(date.match, " ");
  return value
    .replace(SOURCE_COUNT_RE, " ")
    .replace(/\b(?:peer[- ]reviewed|scholarly|academic)\s+(?:journal\s+)?(?:sources?|articles?|studies|papers?|references?)\b/gi, " ")
    .replace(/\bpeer[- ]reviewed\b/gi, " ")
    .replace(/\b(?:i\s+(?:need|want)|for)\s+(?:a|my|the)?\s*(?:first[- ]year|undergraduate|college|class|research|term|course|final|introductory|\d+[- ]page|\d+[- ]word)?\s*(?:research\s+)?(?:paper|essay|assignment|project|class)\b[^.!?]*/gi, " ")
    .replace(/\b(?:i\s+(?:need|want)|please)\s*(?=[.!?]|$)/gi, " ")
    .replace(/\s+/g, " ").trim();
}

export function sourceRequirementFilters(value) {
  const requirements = normalizeSourceRequirements(value);
  const { publicationYearFrom: from, publicationYearTo: to } = requirements;
  return [
    from || to ? `Publication year: ${from || "any"}–${to || "present"}` : "",
    requirements.peerReviewed ? "Peer reviewed: verify the database or journal's review status" : "",
  ].filter(Boolean);
}
