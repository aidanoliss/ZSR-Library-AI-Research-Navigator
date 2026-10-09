const FORMAT = "zsr-search-session-metrics";
const VERSION = 1;
const EVENT_TYPES = new Set(["search_started", "search_finished", "source_opened", "source_saved", "source_marked_useful", "exported"]);
const text = (value, max = 240) => typeof value === "string" ? value.slice(0, max) : "";

function browserSessionStorage() {
  try { return globalThis.sessionStorage || null; } catch { return null; }
}

function summarizeSearches(events) {
  const searches = new Map();
  for (const event of events) {
    if (!event.searchId) continue;
    if (event.type === "search_started") {
      searches.set(event.searchId, { searchId: event.searchId, startedAt: event.at, latencyMs: null, resultCount: null, status: null, firstOpenMs: null, firstSaveMs: null, firstUsefulMs: null });
      continue;
    }
    const search = searches.get(event.searchId);
    if (!search) continue;
    const elapsed = Math.max(0, Date.parse(event.at) - Date.parse(search.startedAt));
    if (event.type === "search_finished") {
      search.latencyMs = elapsed;
      search.resultCount = event.resultCount ?? null;
      search.status = event.status || null;
    }
    const field = { source_opened: "firstOpenMs", source_saved: "firstSaveMs", source_marked_useful: "firstUsefulMs" }[event.type];
    if (field && search[field] === null) search[field] = elapsed;
  }
  return [...searches.values()];
}

/** Local, explicitly enabled pilot timing. Never sends data or stores prompt text. */
export function createSearchMetricsSession({ sessionId = "pilot", storage = browserSessionStorage(), now = () => Date.now(), maxEvents = 1000 } = {}) {
  const id = text(String(sessionId), 160) || "pilot";
  const key = `${FORMAT}:v${VERSION}:${id}`;
  const eventLimit = Math.max(1, Math.min(5000, Number(maxEvents) || 1000));
  let state = { format: FORMAT, version: VERSION, sessionId: id, enabled: false, startedAt: null, events: [], droppedEvents: 0 };
  let storageAvailable = Boolean(storage);
  try {
    const previous = JSON.parse(storage?.getItem(key) || "null");
    if (previous?.format === FORMAT && previous.version === VERSION && previous.sessionId === id && Array.isArray(previous.events)) {
      state = { ...state, enabled: previous.enabled === true, startedAt: previous.startedAt || null,
        events: previous.events.filter((event) => EVENT_TYPES.has(event.type) && Number.isFinite(Date.parse(event.at))).slice(-eventLimit),
        droppedEvents: Number.isInteger(previous.droppedEvents) ? Math.max(0, previous.droppedEvents) : 0 };
    }
  } catch { storageAvailable = false; }
  const timestamp = () => new Date(now()).toISOString();
  const persist = () => {
    try { if (storage) storage.setItem(key, JSON.stringify(state)); } catch { storageAvailable = false; }
  };
  const snapshot = () => ({ ...JSON.parse(JSON.stringify(state)), storageAvailable, searches: summarizeSearches(state.events),
    interpretation: "Opening or saving a source does not establish usefulness. firstUsefulMs requires an explicit participant judgment. Missing timings mean unobserved, not zero." });
  const record = (type, details = {}) => {
    if (!state.enabled || !EVENT_TYPES.has(type)) return null;
    let searchId = text(details.searchId);
    if (!searchId && type !== "exported") searchId = [...state.events].reverse().find((event) => event.type === "search_started")?.searchId || "";
    if (type === "search_started" && !details.searchId) searchId = `search-${state.events.length + state.droppedEvents + 1}`;
    const event = { type, at: timestamp(), ...(searchId ? { searchId } : {}) };
    for (const field of ["sourceId", "status", "accessScope"]) if (text(details[field])) event[field] = text(details[field]);
    if (Number.isInteger(details.resultCount) && details.resultCount >= 0) event.resultCount = details.resultCount;
    state.events.push(event);
    if (state.events.length > eventLimit) { state.events.shift(); state.droppedEvents += 1; }
    persist();
    return { ...event };
  };
  return {
    start() { state.enabled = true; state.startedAt ||= timestamp(); persist(); return snapshot(); },
    stop() { state.enabled = false; persist(); return snapshot(); },
    isEnabled() { return state.enabled; },
    record,
    snapshot,
    exportJson() { record("exported"); return `${JSON.stringify(snapshot(), null, 2)}\n`; },
    clear() {
      state = { format: FORMAT, version: VERSION, sessionId: id, enabled: false, startedAt: null, events: [], droppedEvents: 0 };
      try { storage?.removeItem(key); } catch { storageAvailable = false; }
      return snapshot();
    },
  };
}
