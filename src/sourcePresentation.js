/** Explain a search outcome without turning a provider failure into a literature claim. */
export const SOURCE_OUTCOME_MESSAGES = {
  partial: "Some providers could not finish. Another attempt may find more sources.",
  disabled: "Search is not enabled for this collection here.",
  unconfigured: "Search is not connected for this collection here.",
  not_configured: "Search is not connected for this collection here.",
  rate_limited: "The provider is temporarily limiting requests. Try again shortly.",
  timeout: "The provider took too long to respond.",
  error: "The provider could not complete the search.",
  unavailable: "The provider is currently unavailable.",
  unsupported: "This collection does not support the requested source type.",
  unsupported_mode: "This collection does not support the requested source type.",
  cancelled: "The search was cancelled before it finished.",
  empty: "No leads passed the current topic and assignment checks.",
};

export const RETRY_SOURCE_OUTCOMES = new Set(["partial", "rate_limited", "timeout", "error", "unavailable", "cancelled"]);

export function sourceLaneOutcome(status = {}) {
  // Older saved sessions used reason rather than outcome for configuration failures.
  if (status.requested && status.configured === false) return "not_configured";
  if (status.requested && status.enabled === false) return "disabled";
  return status.outcome || status.status || status.reason || "unknown";
}

export function emptySourcePresentation(lanes = []) {
  const requested = lanes.filter((lane) => lane.status?.requested).map((lane) => {
    const outcome = sourceLaneOutcome(lane.status);
    const reason = lane.status?.emptyReason;
    const message = outcome === "empty" && reason === "no_records" ? "The completed provider searches returned no records for these terms."
      : outcome === "empty" && reason === "no_eligible_records" ? "Records were returned, but none passed the topic and assignment checks."
        : SOURCE_OUTCOME_MESSAGES[outcome] || "No completed search was reported for this collection.";
    return { label: lane.label, outcome, message };
  });
  const completed = requested.some((lane) => ["empty", "success", "partial"].includes(lane.outcome));
  const retryable = requested.some((lane) => RETRY_SOURCE_OUTCOMES.has(lane.outcome));
  return {
    title: completed ? "No matching sources yet" : retryable ? "Source search couldn’t finish" : "Source search isn’t available here",
    explanation: completed
      ? "We don’t have sources to show for this search. Try different terms or continue in another search tool."
      : retryable ? "A search service did not respond successfully. Your topic may be fine; retry before changing it."
        : "The selected collection cannot be searched here right now. You can still search directly using the links below.",
    retryable, requested,
  };
}

/** Render only public web images, never data URLs, local services, or embedded credentials. */
export function safeSourceImageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase();
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "";
    if (!host.includes(".") || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return "";
    return url.href;
  } catch { return ""; }
}

function validIsbn(value) {
  const isbn = String(value || "").replace(/[-\s]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(isbn)) return [...isbn].reduce((sum, digit, index) => sum + (digit === "X" ? 10 : Number(digit)) * (10 - index), 0) % 11 === 0 ? isbn : "";
  if (/^97[89]\d{10}$/.test(isbn)) return [...isbn].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10 === 0 ? isbn : "";
  return "";
}

/** Provider thumbnails may depict the containing journal or book, not the individual article. */
export function sourceImageCandidates(source = {}) {
  const supplied = safeSourceImageUrl(source.cover);
  const candidates = supplied ? [{ url: supplied, label: "Source image", description: "Provider image; it may show the containing publication. Confirm the edition in the source record." }] : [];
  const values = Array.isArray(source.isbn) ? source.isbn : String(source.isbn || "").split(/[;,]/);
  const isbn = values.map(validIsbn).find(Boolean);
  if (isbn) {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
    if (!candidates.some((candidate) => candidate.url === url)) candidates.push({ url, label: "Book cover", description: "Cover from Open Library, matched by ISBN. For chapters, this is the containing book." });
    else Object.assign(candidates.find((candidate) => candidate.url === url), { label: "Book cover", description: "Cover from Open Library, matched by ISBN. For chapters, this is the containing book." });
  }
  return candidates;
}
