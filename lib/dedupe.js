function normalizeUrl(value = "") {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return String(value).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

export function normalizeCompanyName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(inc|inc\.|llc|ltd|corp|corporation|company|co)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function companyDedupeKeys(company = {}) {
  const keys = new Set();
  const name = normalizeCompanyName(company.name);
  const website = normalizeUrl(company.website_url);
  const source = String(company.source_url || "").trim().toLowerCase();
  const sourceUid = String(company.source_uid || "").trim().toLowerCase();

  if (name) keys.add(`name:${name}`);
  if (website) keys.add(`website:${website}`);
  if (source) keys.add(`source:${source}`);
  if (sourceUid) keys.add(`source_uid:${sourceUid}`);
  return Array.from(keys);
}

export function companyFingerprint(company = {}) {
  const website = normalizeUrl(company.website_url);
  if (website) return `website:${website}`;
  const sourceUid = String(company.source_uid || "").trim().toLowerCase();
  if (sourceUid) return `source_uid:${sourceUid}`;
  const name = normalizeCompanyName(company.name);
  return name ? `name:${name}` : "";
}

export function dedupeCompanyCandidates(existingCompanies = [], candidates = []) {
  const seen = new Map();
  for (const company of existingCompanies) {
    for (const key of companyDedupeKeys(company)) {
      seen.set(key, company);
    }
  }

  const unique = [];
  const duplicates = [];

  for (const candidate of candidates) {
    const keys = companyDedupeKeys(candidate);
    const matchedKey = keys.find((key) => seen.has(key));
    if (matchedKey) {
      duplicates.push({
        candidate,
        matched_company: seen.get(matchedKey),
        matched_key: matchedKey,
      });
      continue;
    }
    unique.push(candidate);
    for (const key of keys) seen.set(key, candidate);
  }

  return { unique, duplicates };
}
