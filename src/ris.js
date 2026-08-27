/**
 * Provider-neutral RIS export for verified source-lead metadata.
 *
 * This module deliberately performs no lookups and fills no missing fields. It
 * only normalizes metadata already present on source leads returned by a
 * discovery provider such as Primo, Crossref, or OpenAlex.
 */

const RIS_TYPE = Object.freeze({
  JOURNAL: "JOUR",
  BOOK: "BOOK",
  CHAPTER: "CHAP",
  NEWS: "NEWS",
  DATA: "DATA",
  GENERIC: "GEN",
});

const FIELD_ORDER = Object.freeze([
  "TY",
  "TI",
  "AU",
  "PY",
  "DA",
  "JO",
  "T2",
  "VL",
  "IS",
  "SP",
  "EP",
  "PB",
  "DO",
  "SN",
  "AN",
  "UR",
  "N1",
]);

function cleanValue(value) {
  if (value === undefined || value === null) return "";

  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\r\n\u2028\u2029]+/g, " ")
    .replace(/[\t ]+/g, " ")
    .trim();
}

function firstValue(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const first = value.map(cleanValue).find(Boolean);
      if (first) return first;
      continue;
    }

    const cleaned = cleanValue(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function authorName(author) {
  if (!author || typeof author !== "object") return cleanValue(author);

  const direct = firstValue(author.name, author.displayName, author.author);
  if (direct) return direct;

  const family = firstValue(author.family, author.familyName, author.lastName);
  const given = firstValue(author.given, author.givenName, author.firstName);
  return family && given ? `${family}, ${given}` : family || given;
}

function normalizeAuthors(value) {
  const authors = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\s*[;|]\s*/)
      : value
        ? [value]
        : [];

  return authors.map(authorName).filter(Boolean);
}

function mappedType(value) {
  const normalized = cleanValue(value).toLowerCase().replace(/[_-]+/g, " ");
  if (!normalized) return "";

  if (/\b(book chapter|chapter)\b/.test(normalized)) return RIS_TYPE.CHAPTER;
  if (/\b(book|ebook|monograph)\b/.test(normalized)) return RIS_TYPE.BOOK;
  if (/\b(news|newspaper|magazine)\b/.test(normalized)) return RIS_TYPE.NEWS;
  if (/\b(data|dataset|statistic|statistical)\b/.test(normalized)) return RIS_TYPE.DATA;
  if (/\b(article|journal|scholarly|academic)\b/.test(normalized)) return RIS_TYPE.JOURNAL;
  return "";
}

function normalizeRisType(lead) {
  return mappedType(lead?.sourceKind) || mappedType(lead?.type) || RIS_TYPE.GENERIC;
}

function normalizeDoi(value) {
  return cleanValue(value)
    .replace(/^doi\s*:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .trim();
}

function normalizePmid(value) {
  return cleanValue(value).replace(/^pmid\s*:\s*/i, "").trim();
}

function identifierValues(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map(cleanValue).filter(Boolean);
}

function pageFields(value) {
  const pages = cleanValue(value);
  if (!pages) return {};

  const range = pages.match(/^(.+?)\s*[-\u2013\u2014]\s*([^\s].*)$/);
  if (!range) return { SP: pages };
  return { SP: cleanValue(range[1]), EP: cleanValue(range[2]) };
}

/**
 * Normalize one source lead into RIS tag/value fields.
 *
 * Repeated RIS fields (AU and SN) are represented as arrays. Empty fields are
 * omitted; TY is the only field supplied by the exporter itself because RIS
 * requires every record to declare a record type.
 */
export function normalizeSourceLead(lead = {}) {
  const type = normalizeRisType(lead);
  const title = firstValue(lead.title);
  const authors = normalizeAuthors(lead.authors ?? lead.author);
  const publicationYear = firstValue(lead.publicationYear, lead.year);
  const date = firstValue(lead.date, lead.publicationDate);
  const containerTitle = firstValue(
    lead.containerTitle,
    lead.journalTitle,
    lead.publicationTitle,
    lead.journal
  );
  const doi = normalizeDoi(lead.doi);
  const pmid = normalizePmid(lead.pmid);
  const url = firstValue(lead.url);
  const provider = firstValue(lead.sourceProvider, lead.provenance?.provider);
  const serialNumbers = [
    ...identifierValues(lead.isbn),
    ...identifierValues(lead.issn),
  ];

  const fields = { TY: type };
  if (title) fields.TI = title;
  if (authors.length) fields.AU = authors;
  if (publicationYear) fields.PY = publicationYear;
  if (date) fields.DA = date;
  if (containerTitle) {
    if (type === RIS_TYPE.CHAPTER) fields.T2 = containerTitle;
    else fields.JO = containerTitle;
  }

  const volume = firstValue(lead.volume);
  const issue = firstValue(lead.issue);
  const publisher = firstValue(lead.publisher);
  if (volume) fields.VL = volume;
  if (issue) fields.IS = issue;
  Object.assign(fields, pageFields(lead.pages));
  if (publisher) fields.PB = publisher;
  if (doi) fields.DO = doi;
  if (serialNumbers.length) fields.SN = serialNumbers;
  if (pmid) fields.AN = pmid;
  if (url) fields.UR = url;
  if (provider) fields.N1 = `Metadata provider: ${provider}`;

  return fields;
}

function fingerprintPart(value) {
  return cleanValue(value).toLocaleLowerCase("en-US");
}

function leadKey(lead) {
  const doi = fingerprintPart(normalizeDoi(lead?.doi));
  if (doi) return `doi:${doi}`;

  const pmid = fingerprintPart(normalizePmid(lead?.pmid));
  if (pmid) return `pmid:${pmid}`;

  const isbn = identifierValues(lead?.isbn).map(fingerprintPart).find(Boolean);
  if (isbn) return `isbn:${isbn}`;

  const url = fingerprintPart(lead?.url);
  if (url) return `url:${url}`;

  const title = fingerprintPart(lead?.title);
  if (!title) return "";

  const authors = normalizeAuthors(lead?.authors ?? lead?.author).map(fingerprintPart).join("|");
  const date = fingerprintPart(firstValue(lead?.publicationYear, lead?.year, lead?.date, lead?.publicationDate));
  const container = fingerprintPart(firstValue(lead?.containerTitle, lead?.journalTitle, lead?.publicationTitle, lead?.journal));
  return `metadata:${title}|${authors}|${date}|${container}`;
}

/** Keep the first copy of each selected source lead without merging metadata. */
export function dedupeSourceLeads(leads = []) {
  const input = Array.isArray(leads) ? leads : leads ? [leads] : [];
  const seen = new Set();

  return input.filter((lead) => {
    if (!lead || typeof lead !== "object") return false;
    const key = leadKey(lead);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fieldValues(value) {
  return Array.isArray(value) ? value : [value];
}

/** Serialize one source lead or an array of selected leads as CRLF RIS text. */
export function serializeRis(leads = []) {
  const records = dedupeSourceLeads(leads).map((lead) => {
    const fields = normalizeSourceLead(lead);
    const lines = [];

    for (const tag of FIELD_ORDER) {
      for (const rawValue of fieldValues(fields[tag])) {
        const value = cleanValue(rawValue);
        if (value) lines.push(`${tag}  - ${value}`);
      }
    }

    lines.push("ER  -");
    return lines.join("\r\n");
  });

  return records.length ? `${records.join("\r\n\r\n")}\r\n` : "";
}

/** Create a path-safe, bounded filename with exactly one .ris suffix. */
export function safeRisFilename(value = "research-sources") {
  const base = cleanValue(value)
    .replace(/\.ris$/i, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 100);

  return `${base || "research-sources"}.ris`;
}

/**
 * Download selected leads in a browser. Returns false in Node/SSR or when the
 * selection produces no records, making it safe to call from shared code.
 */
export function downloadRis(leads, { filename = "research-sources.ris" } = {}) {
  const content = serializeRis(leads);
  if (!content) return false;
  if (
    typeof document === "undefined" ||
    typeof document.createElement !== "function" ||
    !document.body ||
    typeof document.body.appendChild !== "function" ||
    typeof Blob === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return false;
  }

  const blob = new Blob([content], {
    type: "application/x-research-info-systems;charset=utf-8",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = href;
    anchor.download = safeRisFilename(filename);
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    return true;
  } finally {
    anchor.remove();
    URL.revokeObjectURL(href);
  }
}
