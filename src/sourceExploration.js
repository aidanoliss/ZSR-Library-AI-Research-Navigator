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
    if (response.status === 401 || response.status === 403) throw new Error("Your session cannot access source search. Sign in again, then retry.");
    throw new Error("Source search could not complete. Try again.");
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.results) || typeof data.status !== "string") throw new Error("Source search returned an unreadable response. Try again.");
  return { ...data, results: data.results.slice(0, 10) };
}

export const EXPLORATION_RELATIONSHIPS = [
  { id: "similar", label: "Similar sources", help: "Find other sources about this topic. Similarity does not mean one source cites another." },
  { id: "references", label: "Its references", help: "Explore sources listed in this work’s references." },
  { id: "citing", label: "Who cites it", help: "Find later works that reference this source." },
];

/** Short primary copy; keep the provider's full explanation in search details. */
export function explorationStatus(response, relationship = "similar") {
  if (!response) return { title: "", detail: "" };
  const count = response.results?.length || 0;
  if (count) return {
    title: `${count} ${relationship === "references" ? "references" : relationship === "citing" ? "sources citing this work" : "similar sources"} found`,
    detail: `${response.coverage?.seedLookupStatus === "not_found" ? "The original DOI could not be confirmed; these are title-search matches. " : ""}${response.coverage?.failedLookupCount ? "Some lookups did not finish, so this list is partial. " : ""}Open a source to check its relevance.`,
  };
  const states = {
    empty: ["No matching sources found", "This search found no sources that passed the current checks. Try another connection type or search in Google Scholar below."],
    identity_mismatch: ["Check the original source first", "Its title and DOI do not agree. We stopped this lookup to avoid showing connections to the wrong work."],
    retracted: ["This source may have been retracted", "Check its publisher’s notice before using or following it."],
    timeout: ["The search took too long", "Try again, or use the Google Scholar link below."],
    rate_limited: ["The source service is busy", "Wait a moment and try again."],
    cancelled: ["Search cancelled", "You can try again whenever you’re ready."],
    not_found: ["We couldn’t find the original record", "Search its title in Google Scholar below."],
  };
  if (relationship === "citing" && response.status === "unavailable") return { title: "Citation lookup isn’t available here", detail: "Open Google Scholar below, find this title, then choose “Cited by” when available." };
  if (response.status === "unsupported") return { title: "This lookup isn’t available with these settings", detail: response.coverage?.accessScope === "open-access" ? "We cannot confirm free full-text access for these connections. Your open-access setting was kept." : relationship === "references" ? "We need a supported source identifier to retrieve its references. Try Similar sources or Google Scholar below." : "Try another connection type or Google Scholar below." };
  const [title, detail] = states[response.status] || ["The source service couldn’t complete this search", "Try again, or search in Google Scholar below."];
  return { title, detail };
}

export function explorationExcerpt(source = {}) {
  const text = String(source.abstractExcerpt || source.abstractText || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= 260) return text;
  const clipped = text.slice(0, 257);
  return `${clipped.slice(0, clipped.lastIndexOf(" ") > 180 ? clipped.lastIndexOf(" ") : clipped.length)}…`;
}
