import { extractDoiIdentifier } from "../config/sourceIdentifiers.js";
import { fetchDiscoveryJson } from "./discoveryOutcome.js";

const cache = new Map();
const titleKey = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

export function compareRegistryIdentity(source, record) {
  const doi = extractDoiIdentifier(source.doi);
  if (!doi || extractDoiIdentifier(record?.DOI).toLowerCase() !== doi.toLowerCase()) return { status: "unverified", detail: "A matching Crossref registry record was not available. This does not establish whether the source is real or false." };
  const title = Array.isArray(record.title) ? String(record.title[0] || "").slice(0, 1000) : "";
  const match = title && titleKey(title) === titleKey(source.title);
  return { status: !title ? "unverified" : match ? "title-matched" : "title-difference", provider: "Crossref", doi, registryTitle: title,
    url: `https://doi.org/${encodeURIComponent(doi)}`,
    detail: !title ? "The DOI is registered, but Crossref supplied no title to compare."
      : match ? "The DOI and normalized title match Crossref metadata. This does not verify findings, full text, or all citation fields."
        : "The provider title differs from the DOI registry title. This can be a title variant or a metadata error; check the original record before citing." };
}

/** Corroborate the first five visible records within a shared two-second budget.
 * Keep both titles; never replace provider metadata or invent a missing DOI.
 */
export async function checkSourceIdentities(sources, { signal, timeoutMs = 2000, fetchImpl } = {}) {
  const deadline = Date.now() + timeoutMs;
  let next = 0;
  const results = [...sources];
  const work = async () => {
    while (next < Math.min(5, sources.length) && !signal?.aborted) {
      const index = next++;
      const source = sources[index];
      const doi = extractDoiIdentifier(source.doi);
      if (!doi) continue;
      const key = doi.toLowerCase();
      let record = cache.get(key);
      if (record?.expiresAt < Date.now()) { cache.delete(key); record = null; }
      let identityCheck;
      try {
        if (!record && deadline > Date.now()) {
          const { response, data } = await fetchDiscoveryJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { headers: { Accept: "application/json" } }, { signal, timeoutMs: deadline - Date.now(), retries: 0, fetchImpl });
          if (response.ok && data?.message?.DOI) {
            record = { data: { DOI: String(data.message.DOI).slice(0, 500), title: Array.isArray(data.message.title) ? [String(data.message.title[0] || "").slice(0, 1000)] : [] }, expiresAt: Date.now() + 6 * 60 * 60_000 };
            if (cache.size >= 500) cache.delete(cache.keys().next().value);
            cache.set(key, record);
          }
        }
        identityCheck = compareRegistryIdentity(source, record?.data);
      } catch { identityCheck = { status: "unverified", detail: "The DOI registry check could not complete. Open the provider record to verify its citation details." }; }
      results[index] = { ...source, identityCheck: { ...identityCheck, checkedAt: new Date().toISOString() } };
    }
  };
  await Promise.all([work(), work(), work()]);
  return results;
}
