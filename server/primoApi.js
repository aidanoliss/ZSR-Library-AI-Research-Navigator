import { DEFAULT_MODE_ID, fillTemplate, getSearchMode, LIBRARY_LINKS } from "../config/libraryLinks.js";
import { searchPrimo } from "./primo.js";

function configuredEndpoint() {
  const endpoint = process.env.PRIMO_API_ENDPOINT;
  if (!endpoint || endpoint === LIBRARY_LINKS.primoApiEndpoint) return "";
  return endpoint;
}

export function buildPrimoRequest(query, modeId = DEFAULT_MODE_ID) {
  const mode = getSearchMode(modeId);
  const endpoint = configuredEndpoint();
  const params = new URLSearchParams({
    q: `any,contains,${query || ""}`,
    mode: "basic",
    tab: mode.id === "books" || mode.id === "primary" ? "LibraryCatalog" : "Articles",
    vid: "01WAKE_INST:ZSR",
  });

  return {
    configured: Boolean(endpoint && process.env.PRIMO_API_KEY),
    endpoint,
    url: endpoint ? `${endpoint}?${params}` : "",
    mode: mode.id,
  };
}

export async function searchPrimoApi(query, modeId = DEFAULT_MODE_ID, limit = 10) {
  const request = buildPrimoRequest(query, modeId);

  if (!request.configured) {
    return {
      configured: false,
      fallbackLinks: [
        {
          label: "Search ZSR",
          url: fillTemplate(LIBRARY_LINKS.zsrPrimoSearch, query),
        },
        {
          label: "Search Google Scholar",
          url: fillTemplate(LIBRARY_LINKS.googleScholarSearch, query),
        },
      ],
      results: await searchPrimo(query, limit, modeId),
    };
  }

  const res = await fetch(request.url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.PRIMO_API_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Primo API request failed (${res.status})`);
  const data = await res.json();
  const docs = data.docs || data.results || [];

  return {
    configured: true,
    results: docs.slice(0, limit).map((doc) => ({
      title: doc.title || doc.pnx?.display?.title?.[0] || "(untitled)",
      author: doc.author || doc.pnx?.display?.creator?.[0] || "",
      type: doc.type || doc.pnx?.display?.type?.[0] || "",
      date: doc.date || doc.pnx?.display?.creationdate?.[0] || "",
      url: doc.url || "",
      doi: doc.doi || doc.pnx?.addata?.doi?.[0] || "",
      pmid: doc.pmid || doc.pnx?.addata?.pmid?.[0] || "",
    })),
  };
}
