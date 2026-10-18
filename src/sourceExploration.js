/** Keep the seed payload bibliographic; do not transmit notes or saved collections. */
export function sourceExplorationSeed(source = {}) {
  return {
    title: String(source.title || "").slice(0, 500),
    doi: String(source.doi || source.citation?.doi || "").slice(0, 350),
    openAlexId: String(source.citation?.openAlexId || source.openAlexId || "").slice(0, 100),
    ...([source.identityCheck?.status, source.identityCheck?.observedStatus].includes("title-difference") ? { identityCheck: { status: "title-difference" } } : {}),
  };
}

export async function requestSourceExploration(payload, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl("/api/explore-sources", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal });
  if (!response.ok) {
    if (response.status === 429) throw new Error("Too many requests right now. Wait a moment and try again.");
    if (response.status === 401 || response.status === 403) throw new Error("Your session cannot access citation exploration. Sign in again, then retry.");
    throw new Error("Citation exploration could not complete. Try again.");
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.results) || typeof data.status !== "string") throw new Error("Citation exploration returned an unreadable response. Try again.");
  return { ...data, results: data.results.slice(0, 10) };
}

export const EXPLORATION_RELATIONSHIPS = [
  { id: "similar", label: "Related works", help: "Related metadata leads; no citation relationship is implied." },
  { id: "references", label: "References", help: "Works the selected source cites, when a provider supplies reference links." },
  { id: "citing", label: "Citing works", help: "Works that cite the selected source, when an indexed citation provider is available." },
];
