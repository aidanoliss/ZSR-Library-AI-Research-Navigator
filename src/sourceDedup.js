function normalizedTitle(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizedDoi(value) {
  return String(value || "").trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "");
}

function authorSignature(result) {
  return normalizedTitle(result.author || (result.authors || []).join(" ")).split(" ")
    .filter((word) => word && !["et", "al", "and"].includes(word)).sort().join(" ");
}

function year(result) {
  return String(result.date || result.publicationYear || "").match(/\b(?:18|19|20|21)\d{2}\b/)?.[0] || "";
}

function authorKeys(result) {
  const authors = result.authors?.length ? result.authors : String(result.author || "").split(/;/);
  return authors.map((author) => authorSignature({ author })).filter(Boolean);
}

function isChapter(result) {
  return /^(?:book[ _-])?chapter$/.test(String(result.type || "").toLowerCase());
}

function isbnKeys(result) {
  return (Array.isArray(result.isbn) ? result.isbn : String(result.isbn || "").split(/[;,]/))
    .map((isbn) => String(isbn).replace(/[^\dXx]/g, "").toUpperCase()).filter((isbn) => /^(?:\d{13}|\d{9}[\dX])$/.test(isbn));
}

function numericPageRange(value) {
  const match = String(value || "").trim().replace(/^pp?\.?\s*/i, "").match(/^(\d+)\s*(?:[-–—]\s*(\d*)\s*)?$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : null;
  return end != null && end < start ? null : { start, end };
}

function chapterPagesConflict(a, b) {
  if (!a.pages || !b.pages || normalizedTitle(a.pages) === normalizedTitle(b.pages)) return false;
  const pagesA = numericPageRange(a.pages);
  const pagesB = numericPageRange(b.pages);
  // Providers may report only a start page ("13" or "13-"). That is missing
  // metadata, not a conflicting range; known start/end disagreements still block merging.
  if (pagesA && pagesB) return pagesA.start !== pagesB.start || (pagesA.end != null && pagesB.end != null && pagesA.end !== pagesB.end);
  return true;
}

function metadataConflicts(a, b) {
  if (a.edition && b.edition && normalizedTitle(a.edition) !== normalizedTitle(b.edition)) return true;
  const bookA = /book|chapter|monograph/.test(normalizedTitle(a.type));
  const bookB = /book|chapter|monograph/.test(normalizedTitle(b.type));
  if (bookA && bookB) {
    if (isChapter(a) !== isChapter(b)) return true;
    const isbnA = isbnKeys(a);
    const isbnB = isbnKeys(b);
    if (isbnA.length && isbnB.length && !isbnA.some((isbn) => isbnB.includes(isbn))) return true;
    // Dates may differ for online and print records; distant dates need an identifier match.
    if (year(a) && year(b) && Math.abs(Number(year(a)) - Number(year(b))) > 3) return true;
  }
  if (isChapter(a) && isChapter(b) && chapterPagesConflict(a, b)) return true;
  return false;
}

function sameChapterVariant(a, b) {
  if (!isChapter(a) || !isChapter(b)) return false;
  const isbns = isbnKeys(a);
  if (!isbns.some((isbn) => isbnKeys(b).includes(isbn))) return false;
  const container = normalizedTitle(a.containerTitle);
  if (!container || container !== normalizedTitle(b.containerTitle)) return false;
  if (!authorKeys(a).some((author) => authorKeys(b).includes(author))) return false;
  const [shorter, longer] = [a.title, b.title].sort((x, y) => String(x).length - String(y).length);
  // A shared book identifier never establishes chapter identity. Require a main-title/
  // subtitle relationship AND a substantial shared abstract opening, ignoring OCR spacing.
  const sameTitle = normalizedTitle(shorter) === normalizedTitle(longer);
  const mainTitle = normalizedTitle(String(longer).split(":")[0]);
  if (!sameTitle && (!String(longer).includes(":") || mainTitle.length < 24 || mainTitle !== normalizedTitle(shorter))) return false;
  const opening = (result) => normalizedTitle(result.abstractText || result.abstractExcerpt).replace(/\s/g, "").slice(0, 200);
  const textA = opening(a);
  return textA.length === 200 && textA === opening(b);
}

function sameWork(a, b) {
  const doiA = normalizedDoi(a.doi);
  const doiB = normalizedDoi(b.doi);
  if (doiA && doiA === doiB) return true;
  // Conflicting identifiers are stronger evidence than a coincidentally matching title.
  if (doiA && doiB) return false;
  if (metadataConflicts(a, b)) return false;
  const title = normalizedTitle(a.title).replace(/^(?:a|an|the)\s+/, "");
  if (!title || title !== normalizedTitle(b.title).replace(/^(?:a|an|the)\s+/, "")) {
    return sameChapterVariant(a, b) || (!title && !b.title && a.url && a.url === b.url);
  }
  const authorA = authorSignature(a);
  const authorB = authorSignature(b);
  if (authorA && authorB && authorA !== authorB) return sameChapterVariant(a, b);
  const specific = title.length >= 24 || title.split(" ").length >= 4;
  // Sparse records can join a fuller copy, but short titles also require the same known year.
  return specific ? !year(a) || !year(b) || year(a) === year(b) || (authorA && authorA === authorB)
    : Boolean(year(a) && year(a) === year(b) && authorA && authorA === authorB);
}

function safeLink(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : "";
  } catch { return ""; }
}

function accessLinks(result) {
  const links = [
    ...(result.accessLinks || []),
    { url: result.url, label: result.sourceProvider || "Provider record", accessScope: result.accessScope || "library" },
    { url: result.openAccess?.landingPageUrl, label: "Open access record", accessScope: "open-access" },
    { url: result.openAccess?.pdfUrl, label: "Open access PDF", accessScope: "open-access" },
  ].map((link) => ({ ...link, url: safeLink(link.url) })).filter((link) => link.url);
  return [...new Map(links.map((link) => [link.url, link])).values()];
}

function mergeMetadata(primary, other) {
  const merged = { ...primary };
  for (const field of ["author", "date", "publicationYear", "containerTitle", "publisher", "doi", "pmid", "isbn", "issn", "volume", "issue", "pages", "edition", "cover", "fulfillment", "openAccess"])
    if (!merged[field] && other[field]) merged[field] = other[field];
  const primaryPages = numericPageRange(primary.pages);
  const otherPages = numericPageRange(other.pages);
  if (isChapter(primary) && isChapter(other) && primaryPages && otherPages &&
      primaryPages.start === otherPages.start && primaryPages.end == null && otherPages.end != null) merged.pages = other.pages;
  for (const field of ["subjects", "detailPoints"])
    merged[field] = [...new Set([...(primary[field] || []), ...(other[field] || [])])];
  const authors = [...(primary.authors || []), ...(other.authors || [])];
  merged.authors = [...new Map(authors.map((author) => [authorSignature({ author }), author])).values()];
  if (merged.authors.length) merged.author = `${merged.authors.slice(0, 2).join("; ")}${merged.authors.length > 2 ? " et al." : ""}`;
  // Keep the full abstract, preview, and provenance from one provider together. A longer
  // preview from a different provider must not relabel an existing full abstract.
  const abstractOwner = [primary, other].sort((a, b) =>
    Number(Boolean(b.abstractText)) - Number(Boolean(a.abstractText)) ||
    (b.abstractText || b.abstractExcerpt || "").length - (a.abstractText || a.abstractExcerpt || "").length)[0];
  if (abstractOwner.abstractText || abstractOwner.abstractExcerpt) {
    merged.abstractText = abstractOwner.abstractText || "";
    merged.abstractExcerpt = abstractOwner.abstractExcerpt || abstractOwner.abstractText.slice(0, 360);
    merged.abstractSource = abstractOwner.abstractSource || abstractOwner.sourceProvider || "Provider metadata";
    merged.abstractTruncated = Boolean(abstractOwner.abstractTruncated);
  }
  if (primary.peerReviewed == null && other.peerReviewed != null) merged.peerReviewed = other.peerReviewed;
  if (primary.peerReviewed === false || other.peerReviewed === false) merged.peerReviewed = false;
  merged.accessLinks = accessLinks({ ...primary, accessLinks: [...accessLinks(primary), ...accessLinks(other)] });
  merged.metadataSources = [...new Set([...(primary.metadataSources || []), primary.sourceProvider, ...(other.metadataSources || []), other.sourceProvider].filter(Boolean))];
  return merged;
}

/** Merge actual provider metadata and links before pagination; never synthesize citations. */
export function uniqueSourceResults(results = []) {
  const unique = [];
  for (const result of results || []) {
    if (!result) continue;
    const index = unique.findIndex((candidate) => sameWork(candidate, result));
    if (index < 0) unique.push(result);
    else unique[index] = mergeMetadata(unique[index], result);
  }
  return unique;
}
