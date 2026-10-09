import { sourceKindFromMetadata, sourcePublicationYear } from "./sourceAssessment.js";
import { uniqueSourceResults } from "./sourceDedup.js";

/** Count a work once while retaining the separate access options merged into its record. */
export function sourceResultLanes(results = [], discovery = null) {
  const records = uniqueSourceResults([
    ...results.filter((result) => result?.accessScope !== "open-access"),
    ...results.filter((result) => result?.accessScope === "open-access"),
  ]);
  const library = records.filter((result) => result.accessScope !== "open-access");
  const mergedAccessCount = library.filter((result) => result.accessLinks?.some((link) => link.accessScope === "open-access")).length;
  return [
    { id: "library", label: "Library sources", results: library, status: discovery?.lanes?.library, mergedResultCount: 0 },
    { id: "open-access", label: "Open-access sources", results: records.filter((result) => result.accessScope === "open-access"), status: discovery?.lanes?.openAccess, mergedResultCount: Math.max(mergedAccessCount, Number(discovery?.lanes?.openAccess?.mergedResultCount) || 0) },
  ];
}

const TYPE_LABELS = {
  "scholarly-article": "Articles",
  book: "Books",
  "book-chapter": "Book chapters",
  news: "News",
  dataset: "Data",
};

export function sourceTypeKey(result) {
  return sourceKindFromMetadata(result) || String(result?.type || "").toLowerCase().trim() || "unknown";
}

export function sourceTypeLabel(key) {
  return TYPE_LABELS[key] || (key === "unknown" ? "Type not supplied" : key.replace(/[_-]+/g, " ").replace(/^./, (char) => char.toUpperCase()));
}

export function sourceTypeOptions(results = []) {
  return [...new Set(results.map(sourceTypeKey))].sort((a, b) => sourceTypeLabel(a).localeCompare(sourceTypeLabel(b)));
}

/** View-only filtering never changes the research brief or broadens its requirements. */
export function filterSourceResults(results = [], { type = "all", from = "", to = "", sort = "relevance" } = {}) {
  const fromYear = /^\d{4}$/.test(String(from)) ? Number(from) : null;
  const toYear = /^\d{4}$/.test(String(to)) ? Number(to) : null;
  const filtered = results.filter((result) => {
    if (type !== "all" && sourceTypeKey(result) !== type) return false;
    const year = sourcePublicationYear(result);
    if ((fromYear !== null || toYear !== null) && year === null) return false;
    if (fromYear !== null && year < fromYear) return false;
    if (toYear !== null && year > toYear) return false;
    return true;
  });
  // Provider-ranked order is stable, including ties and undated records.
  return sort === "newest" ? filtered.sort((a, b) => (sourcePublicationYear(b) ?? -Infinity) - (sourcePublicationYear(a) ?? -Infinity)) : filtered;
}

/** Share one initial-page budget across access lanes, selecting the strongest eligible works. */
export function paginateSourceLanes(lanes = [], filters = {}, limit = 5) {
  const filteredLanes = lanes.map((lane) => ({ ...lane, filteredResults: filterSourceResults(lane.results, filters) }));
  const ranked = filteredLanes.flatMap((lane) => lane.filteredResults).sort((a, b) => filters.sort === "newest"
    ? (sourcePublicationYear(b) ?? -Infinity) - (sourcePublicationYear(a) ?? -Infinity)
    : (b.metadataRank?.score ?? 0) - (a.metadataRank?.score ?? 0));
  const initial = new Set(ranked.slice(0, Math.max(0, limit)));
  return filteredLanes.map((lane) => ({
    ...lane,
    initialResults: lane.filteredResults.filter((result) => initial.has(result)),
    moreResults: lane.filteredResults.filter((result) => !initial.has(result)),
  }));
}

export function shortSourceExcerpt(value, maxLength = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength + 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > maxLength / 2 ? cut.lastIndexOf(" ") : maxLength).trimEnd()}…`;
}

function authorName(author) {
  if (typeof author === "string") return author;
  if (!author || typeof author !== "object") return "";
  return author.name || author.displayName || [author.given, author.family].filter(Boolean).join(" ");
}

export function sourceAuthors(result = {}, compact = false) {
  const raw = Array.isArray(result.authors) && result.authors.length ? result.authors : result.author || result.citation?.authors || [];
  const authors = (Array.isArray(raw) ? raw : String(raw).split(/\s*;\s*/)).map(authorName).filter(Boolean);
  if (!compact) return authors.join("; ");
  const visible = authors.slice(0, 2).join("; ");
  return shortSourceExcerpt(`${visible}${authors.length > 2 ? " et al." : ""}`, 110);
}

export function sourceJournal(result = {}) {
  return result.containerTitle || result.journalTitle || result.publicationTitle || result.journal || result.citation?.journal || "";
}
