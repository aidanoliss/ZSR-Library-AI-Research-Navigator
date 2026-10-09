import { useEffect, useId, useRef, useState } from "react";
import { reviseSearchTopic } from "./resultSearch.js";
import { getSearchMode } from "../config/libraryLinks.js";
import { isSavedSource } from "./researchWorkspace.js";
import { sourcePublicationYear } from "./sourceAssessment.js";

export const RESULT_VIEWS = [
  { id: "results", label: "Results" },
  { id: "strategy", label: "Search strategy" },
  { id: "saved", label: "Saved sources" },
];

export function ResultWorkspaceHeader({ id, view, onViewChange, onEditRequirements, topic, researchSpec, mode, busy, onSearch, savedCount = 0 }) {
  const [draft, setDraft] = useState(topic || "");
  const [error, setError] = useState("");
  const inputId = useId();
  const tabRefs = useRef({});
  useEffect(() => setDraft(topic || ""), [topic]);
  const requirements = researchSpec?.sourceRequirements || {};
  function submit(event) {
    event.preventDefault();
    if (!draft.trim() || !onSearch || busy) return;
    let next;
    try { next = reviseSearchTopic(draft, researchSpec, mode); }
    catch (cause) { setError(cause.message); return; }
    setError("");
    onViewChange("results");
    onSearch(`Search for sources on: ${draft.trim()}`, {
      mode: next.mode,
      researchSpec: next,
      changes: [{ label: "Topic", after: draft.trim() }],
    });
  }
  function moveTab(event, current) {
    const index = RESULT_VIEWS.findIndex((item) => item.id === current);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? RESULT_VIEWS.length - 1
      : event.key === "ArrowRight" ? (index + 1) % RESULT_VIEWS.length
        : event.key === "ArrowLeft" ? (index + RESULT_VIEWS.length - 1) % RESULT_VIEWS.length : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = RESULT_VIEWS[nextIndex].id;
    onViewChange(next);
    tabRefs.current[next]?.focus();
  }
  return <header className="result-workspace-header">
    <form className="result-topic-search" onSubmit={submit}>
      <label htmlFor={inputId}>Research topic</label>
      <div>
        <input id={inputId} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} readOnly={!onSearch} />
        {onSearch && <button type="submit" disabled={busy || !draft.trim()}>{busy ? "Searching…" : "Search"}</button>}
      </div>
    </form>
    {error && <p className="error-note" role="alert">{error}</p>}
    <div className="result-active-requirements" aria-label="Requirements kept for this search">
      <span>{getSearchMode(researchSpec?.mode || mode).shortLabel}</span>
      {(requirements.publicationYearFrom || requirements.publicationYearTo) && <span>Published {requirements.publicationYearFrom || "any year"}–{requirements.publicationYearTo || "present"}</span>}
      {researchSpec?.facets?.timePeriod && <span>Topic period: {researchSpec.facets.timePeriod}</span>}
      {researchSpec?.facets?.method && <span>Method: {researchSpec.facets.method}</span>}
      {requirements.peerReviewed && <span>Peer review required</span>}
      <button type="button" onClick={() => { onViewChange("strategy"); onEditRequirements?.(); }}>Edit requirements</button>
    </div>
    <nav className="result-view-tabs" role="tablist" aria-label="Research results views">
      {RESULT_VIEWS.map((item) => <button key={item.id} type="button" role="tab" id={`${id}-tab-${item.id}`} aria-selected={view === item.id} aria-controls={`${id}-panel-${item.id}`} tabIndex={view === item.id ? 0 : -1} ref={(node) => { tabRefs.current[item.id] = node; }} onClick={() => onViewChange(item.id)} onKeyDown={(event) => moveTab(event, item.id)}>{item.label}{item.id === "saved" && savedCount > 0 && <span>{savedCount}</span>}</button>)}
    </nav>
  </header>;
}

export function SavedSourcesView({ items = [], onManage, onSourceEvent }) {
  const sources = items.filter(isSavedSource);
  return <section className="saved-results-view" aria-label="Saved sources">
    <div className="saved-results-heading"><h3>Saved sources <span>{sources.length}</span></h3><button type="button" onClick={onManage}>Notes & comparison</button></div>
    {!sources.length ? <p>Choose Save on a result to keep it here. Your saved sources stay in this browser.</p> : <ul>
      {sources.map((item) => {
        const source = item.sourceRecord || item;
        return <li key={item.id || item.url || item.title}>
          <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => onSourceEvent?.("source_opened", { sourceId: item.url || item.id })}>{item.title}</a>
          <p>{[source.author, sourcePublicationYear(source), source.containerTitle].filter(Boolean).join(" · ") || "Open the record to check citation details."}</p>
          {item.notes && <p className="saved-result-note">{item.notes}</p>}
        </li>;
      })}
    </ul>}
  </section>;
}

export function LocalStudyPanel({ enabled, onToggle, onExport, onClear }) {
  return <details className="local-study-panel">
    <summary>Usability session</summary>
    <p>Optional, browser-only timing for a review session. No topics, titles, or events are sent to a server. Mark a result useful only after checking it.</p>
    <label><input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} /> Record this session locally</label>
    <div><button type="button" onClick={onExport}>Export session</button><button type="button" onClick={onClear}>Clear session</button></div>
  </details>;
}
