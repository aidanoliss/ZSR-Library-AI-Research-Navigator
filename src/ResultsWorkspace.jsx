import EvidenceNotebook from "./EvidenceNotebook.jsx";
import { ScopePriorityControls } from "./SearchClarification.jsx";
import { applyScopePriorities, scopePriorityRows } from "./searchClarification.js";
import { ResearchPrivacyContext } from "./researchPrivacy.js";
import SourceIdentityNotice from "./SourceIdentityNotice.jsx";
import { useContext, useEffect, useId, useRef, useState } from "react";
import { reviseSearchTopic, improveResearchPrompt } from "./resultSearch.js";
import { getSearchMode } from "../config/libraryLinks.js";
import { filterSavedSources, isSavedSource, RESEARCH_ITEM_STATUSES, sourceForResearchItem } from "./researchWorkspace.js";
import { sourcePublicationYear } from "./sourceAssessment.js";
import { downloadRis } from "./ris.js";
import { sourceTypeLabel, sourceTypeKey } from "./sourceResultView.js";

export const RESULT_VIEWS = [
  { id: "results", label: "Results" },
  { id: "strategy", label: "Search strategy" },
  { id: "saved", label: "Saved sources" },
];

export function ResultWorkspaceHeader({ id, view, onViewChange, onEditRequirements, topic, researchSpec, mode, busy, onSearch, savedCount = 0 }) {
  const [draft, setDraft] = useState(topic || "");
  const [error, setError] = useState("");
  const [improving, setImproving] = useState(false);
  const [scope, setScope] = useState({ population: "", geography: "", method: "", comparison: "" });
  const [promptNotice, setPromptNotice] = useState("");
  const [priorities, setPriorities] = useState({});
  useEffect(() => setPriorities({}), [researchSpec]);
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
    {onSearch ? <form className="result-topic-search" onSubmit={submit}>
      <label htmlFor={inputId}>Research topic</label>
      <div>
        <textarea rows={2} id={inputId} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} readOnly={!onSearch} />
        {onSearch && <button type="submit" disabled={busy || !draft.trim()}>{busy ? "Searching…" : "Search"}</button>}
      </div>
    </form> : <p className="result-topic-caption"><strong>Search scope</strong>{topic}</p>}
    {onSearch && <div className="prompt-improvement">
      <button type="button" className="prompt-improve-toggle" aria-expanded={improving} aria-controls={`${inputId}-improve`} onClick={() => { setImproving(!improving); setPromptNotice(""); }}>Refine this prompt</button>
      {improving && <section id={`${inputId}-improve`} aria-label="Prompt refinement">
        <strong>Make the scope clearer</strong>
        <p>Keep your topic and add only details you need. Leave fields blank for a broader search. Ask what the evidence shows, rather than asking it to prove a conclusion.</p>
        <div className="prompt-scope-fields">{[
          ["population", "Who or what?", "e.g. undergraduate students"],
          ["geography", "Where?", "e.g. United States"],
          ["method", "Study method", "e.g. systematic reviews"],
          ["comparison", "Compare with", "e.g. in-person teaching"],
        ].map(([key, label, hint]) => <label key={key}>{label}<input value={scope[key]} maxLength={160} placeholder={hint} onChange={(event) => setScope({ ...scope, [key]: event.target.value })} /></label>)}</div>
        <label className="prompt-preview-label">Prompt preview<textarea readOnly rows={4} value={improveResearchPrompt(draft, scope)} /></label>
        <p>Existing assignment requirements stay in place. These are your words, not an AI-generated answer.</p>
        <button type="button" disabled={busy || !draft.trim() || improveResearchPrompt(draft, scope).length > 2000} onClick={() => { setDraft(improveResearchPrompt(draft, scope)); setScope({ population: "", geography: "", method: "", comparison: "" }); setImproving(false); setPromptNotice("Prompt updated. Review it above, then choose Search to run it."); }}>Use this prompt</button>
        {improveResearchPrompt(draft, scope).length > 2000 && <p role="alert">Shorten the topic or scope to 2,000 characters before applying.</p>}
      </section>}
      {promptNotice && <p role="status">{promptNotice}</p>}
    </div>}
    {onSearch && scopePriorityRows(researchSpec).length > 0 && <details className="scope-priority-editor"><summary>Required criteria & preferences</summary><ScopePriorityControls spec={researchSpec} priorities={priorities} onChange={setPriorities} /><button type="button" className="scope-apply" disabled={busy || !Object.keys(priorities).length} onClick={() => {
      const next = applyScopePriorities(researchSpec, priorities);
      onViewChange("results"); onSearch(`Search for sources on: ${next.topic}`, { researchSpec: next, mode: next.mode, changes: [{ label: "Scope priorities", after: "Updated required criteria and preferences" }] });
    }}>Apply & search</button></details>}
    {Object.keys(researchSpec?.preferredFacets || {}).length > 0 && <p className="scope-preference-tags">{Object.entries(researchSpec.preferredFacets).map(([key, value]) => <span key={key}>Preferred {key}: {value}</span>)}</p>}
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

export function SavedSourcesView({ items = [], onManage, onSourceEvent, onRemove, onUpdate, removedItem, onUndoRemove, renderExtra }) {
  const privateMode = useContext(ResearchPrivacyContext);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [exportNotice, setExportNotice] = useState("");
  const sources = items.filter(isSavedSource);
  const visible = filterSavedSources(items, query, status);
  return <section className="saved-results-view" aria-label="Saved sources">
    <div className="saved-results-heading"><h3>Saved sources <span>{sources.length}</span></h3>
      <div>{onManage && <button type="button" onClick={onManage}>Compare & review</button>}
      {sources.length > 0 && <button type="button" disabled={!visible.length} onClick={() => {
        try { setExportNotice(downloadRis(visible.map(sourceForResearchItem), { filename: "saved-sources" }) ? "Citation download started. Check the metadata before citing." : "No citations could be downloaded."); }
        catch { setExportNotice("Citation download failed. Try again."); }
      }}>Export {visible.length} {visible.length === 1 ? "citation" : "citations"}</button>}</div>
    </div>
    <p className="saved-collection-help">{privateMode ? "Private shortlist. Export a backup before ending this session or reloading." : "Your shortlist for this research topic. Saved in this browser; export a backup from Review to keep your notes."}</p>
    {removedItem && <div className="saved-undo" role="status"><span>Unsaved “{removedItem.title}”.</span><button type="button" onClick={onUndoRemove}>Undo unsave</button></div>}
    {exportNotice && <p role="status">{exportNotice}</p>}
    {sources.length > 0 && <div className="saved-collection-filters">
      <label>Find a saved source<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, author or your notes" /></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All saved sources</option>{RESEARCH_ITEM_STATUSES.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>
    </div>}
    {!sources.length ? <div className="saved-collection-empty"><strong>A home for your sources</strong><p>Choose Save on a result. Return here to add notes, build your shortlist and export citations.</p></div>
      : !visible.length ? <div className="saved-collection-empty"><p>No saved sources match these filters.</p><button type="button" onClick={() => { setQuery(""); setStatus("all"); }}>Clear filters</button></div> : <>
      <p className="saved-visible-count" role="status">Showing {visible.length} of {sources.length} saved sources</p>
      <ul>{visible.map((item) => {
        const source = item.sourceRecord || item;
        return <li key={item.id || item.url || item.title}>
          <div className="saved-source-title"><div><span className="saved-source-type">{sourceTypeLabel(sourceTypeKey(source))}</span>
          {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => onSourceEvent?.("source_opened", { sourceId: item.url || item.id })}>{item.title}</a> : <strong>{item.title}</strong>}</div>
          {onRemove && <button type="button" onClick={() => onRemove(item)} aria-label={`Unsave ${item.title}`}>Unsave</button>}</div>
          <p>{[source.author, sourcePublicationYear(source), source.edition, source.containerTitle].filter(Boolean).join(" · ") || "Open the record to check citation details."}</p>
          <SourceIdentityNotice source={source} />
          {onUpdate && <label className="saved-source-status">Status<select value={item.status} onChange={(event) => onUpdate(item, { status: event.target.value })}>{RESEARCH_ITEM_STATUSES.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>}
          {onUpdate ? <details className="saved-source-notes"><summary>My notes{item.notes ? " · added" : ""}</summary><label>Reading notes<textarea rows={3} maxLength={4000} value={item.notes || ""} onChange={(event) => onUpdate(item, { notes: event.target.value })} placeholder="Why it may help, useful pages, claims to check…" /></label><small>{privateMode ? "Kept only for this private session." : "Saved automatically in this browser."}</small></details> : item.notes && <p className="saved-result-note">{item.notes}</p>}
          {onUpdate && <EvidenceNotebook item={item} onChange={(evidenceEntries) => onUpdate(item, { evidenceEntries })} />}
          {renderExtra?.(item)}
        </li>;
      })}</ul></>}
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
