import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ResearchPrivacyContext } from "./researchPrivacy.js";
import { SavedSourcesView } from "./ResultsWorkspace.jsx";
import { downloadText } from "./exportPlan.js";
import {
  COURSE_TEMPLATES,
  addSearchHistoryEntry,
  RESEARCH_ITEM_STATUSES,
  assignmentContext,
  normalizeResearchWorkspace,
  workspaceToMarkdown,
  workspaceToJson,
  parseWorkspaceImport,
  mergeWorkspaceImport,
  WORKSPACE_MAX_BYTES,
  isSavedSource,
  workspaceTabAfterKey,
} from "./researchWorkspace.js";
import { assignmentProgress } from "./workspaceRequirements.js";
import { RequirementProgress, SavedSourceEvidence, SourceComparison } from "./WorkspaceSourcePanels.jsx";

const Icon = {
  close: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>,
  brief: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4M9 11h6M9 15h6" /></svg>,
  trail: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M5 7h10l-2 3 2 3H5" /><circle cx="18" cy="18" r="3" /></svg>,
  history: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>,
  review: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z" /><path d="m8 10 2 2 4-4M8 16h8" /></svg>,
  trash: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>,
  external: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14" /><path d="M19 13v6H5V5h6" /></svg>,
  copy: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  download: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>,
};

const TABS = [
  { id: "brief", label: "Brief" },
  { id: "trail", label: "Research" },
  { id: "history", label: "Searches" },
  { id: "review", label: "Review" },
];

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function EmptyState({ children }) {
  return <p className="research-workspace-empty">{children}</p>;
}

export default function ResearchWorkspace({ open, workspace, topic, onChange, onClose, onHandoff, initialTab = "trail", researchSpec = null, onRemoveResearchItem, onUpdateResearchItem, removedItem, onUndoRemove, onReplaySearch }) {
  const privateMode = useContext(ResearchPrivacyContext);
  const closeButtonRef = useRef(null);
  const bodyRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [tab, setTab] = useState(initialTab);
  const tabRefs = useRef({});
  const importRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const latestWorkspaceRef = useRef(workspace);
  latestWorkspaceRef.current = workspace;
  const [comparisonIds, setComparisonIds] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [manualQuery, setManualQuery] = useState("");

  const current = useMemo(() => normalizeResearchWorkspace(workspace), [workspace]);
  const assignmentSummary = assignmentContext({ ...current.assignment, enabled: true });
  const progress = useMemo(() => assignmentProgress(current, researchSpec), [current, researchSpec]);
  const comparisonItems = current.trail.filter((item) => isSavedSource(item) && comparisonIds.includes(item.id));
  const usableItems = progress.selected;

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    setTab(TABS.some((item) => item.id === initialTab) ? initialTab : "trail");
    setNotice("");
    setError("");
    setComparisonIds([]);
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    function onKeyDown(event) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open, initialTab]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [tab, open]);

  if (!open) return null;

  function changeAssignment(field, value) {
    onChange({ ...current, assignment: { ...current.assignment, [field]: value } });
  }

  function announce(message) { setError(""); setNotice(message); }

  function changeTabFromKey(event) {
    const next = workspaceTabAfterKey(tab, event.key, TABS.map((item) => item.id));
    if (!next) return;
    event.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  function toggleComparison(id) {
    const selected = comparisonIds.includes(id);
    if (!selected && comparisonItems.length >= 3) { setError("Compare up to three sources. Clear one selection first."); return; }
    const next = selected ? comparisonIds.filter((value) => value !== id) : [...comparisonIds, id];
    setComparisonIds(next);
    announce(`${next.length} source${next.length === 1 ? "" : "s"} selected for comparison.`);
  }

  function applyTemplate() {
    const template = COURSE_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    const { id, label, ...fields } = template;
    onChange({ ...current, assignment: { ...current.assignment, ...fields, enabled: true } });
    announce(`${label} preset applied. Review its requirements before using them.`);
  }

  function updateTrailItem(id, patch) {
    if (patch.status) announce(`Source marked ${RESEARCH_ITEM_STATUSES.find((value) => value.id === patch.status)?.label || patch.status}. Requirement progress updated.`);
    onChange({
      ...current,
      trail: current.trail.map((item) => item.id === id ? { ...item, ...patch } : item),
    });
  }

  function removeTrailItem(id) {
    onChange({ ...current, trail: current.trail.filter((item) => item.id !== id) });
    setComparisonIds((ids) => ids.filter((value) => value !== id));
    announce("Saved item removed.");
  }

  function updateSearch(id, resultNote) {
    onChange({
      ...current,
      searchHistory: current.searchHistory.map((item) => item.id === id ? { ...item, resultNote } : item),
    });
  }

  function removeSearch(id) {
    onChange({ ...current, searchHistory: current.searchHistory.filter((item) => item.id !== id) });
    announce("Search removed.");
  }

  function addManualSearch(event) {
    event.preventDefault();
    const query = manualQuery.trim();
    if (!query) return;
    try {
      onChange(addSearchHistoryEntry(current, { query, tool: "Manual note" }));
      setManualQuery("");
      announce("Search added to your history.");
    } catch (cause) {
      setNotice("");
      setError(cause.message || "Could not add this search. Your existing searches were kept.");
    }
  }

  async function copyReview() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(workspaceToMarkdown(current, topic));
      announce("Research summary copied.");
    } catch { setNotice(""); setError("Could not copy the summary. Use Download summary instead."); }
  }

  function downloadReview() {
    try { downloadText("zsr-research-trail.md", workspaceToMarkdown(current, topic)); announce("Markdown download started."); }
    catch { setNotice(""); setError("The download could not start. Try copying the summary."); }
  }

  function downloadWorkspace() {
    try {
      const content = workspaceToJson(current, topic);
      const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "zsr-research-workspace.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      announce("Workspace JSON download started. Keep the file to restore your sources and notes.");
    } catch (cause) { setNotice(""); setError(cause.message || "Could not export this workspace."); }
  }

  async function importWorkspace(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const originalWorkspace = workspace;
    setImporting(true);
    setError("");
    setNotice("");
    try {
      if (file.size > WORKSPACE_MAX_BYTES) throw new Error("Choose a workspace JSON file smaller than 2 MB.");
      const imported = parseWorkspaceImport(await file.text());
      if (latestWorkspaceRef.current !== originalWorkspace) throw new Error("This workspace changed while reading the file. Select the file again to merge into the latest version.");
      const merged = mergeWorkspaceImport(current, imported.workspace);
      onChange(merged.workspace);
      announce(`Imported ${merged.addedItems} saved items and ${merged.addedSearches} searches. ${merged.skippedDuplicates} duplicates skipped. ${merged.keptExistingBrief ? "Your existing brief was kept." : "Imported assignment text stays off for AI requests until you enable it."} Recheck imported metadata in the provider record.`);
    } catch (cause) { setError(cause.message || "Could not import this workspace. Your saved work was kept."); }
    finally { setImporting(false); }
  }

  return (
    <aside
      className="research-workspace-drawer no-print"
      role="dialog"
      aria-modal="false"
      aria-labelledby="research-workspace-title"
    >
      <header className="research-workspace-head">
        <div>
          <h2 id="research-workspace-title">My research</h2>
        </div>
        <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close research workspace">{Icon.close}</button>
      </header>

      <p className="workspace-local-note">{privateMode ? "Private session • cleared when you end the session or reload. Export a copy to keep it." : "Your brief, saved research, and search activity. Saved in this browser."}</p>

      <nav className="research-workspace-tabs" role="tablist" aria-label="Research workspace sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            ref={(element) => { tabRefs.current[item.id] = element; }}
            id={`workspace-tab-${item.id}`}
            type="button"
            role="tab"
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
            onKeyDown={changeTabFromKey}
            aria-selected={tab === item.id}
            aria-controls={`workspace-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div ref={bodyRef} className="research-workspace-body">
        <div role="status" aria-live="polite" aria-atomic="true" className={notice ? "workspace-action-status" : "sr-only"}>{notice}</div>
        {error && <p role="alert" className="workspace-action-error">{error}</p>}
        {(
          <section
            id="workspace-panel-brief"
            hidden={tab !== "brief"}
            className="workspace-section"
            role="tabpanel"
            tabIndex={0}
            aria-labelledby="workspace-tab-brief"
          >
            <div className="workspace-section-head">
              <div>
                <h3 id="workspace-brief-title">Research brief</h3>
              </div>
            </div>
            <p className="workspace-brief-help">Set the requirements for this project. Start with the essentials; add more details when you need them.</p>
            <label className="workspace-toggle workspace-sharing-choice">
                <input
                  type="checkbox"
                  checked={current.assignment.enabled}
                  onChange={(event) => changeAssignment("enabled", event.target.checked)}
                />
                <span><strong>Use this brief in AI requests</strong><small>When checked, these requirements are sent with your next request.</small></span>
            </label>

            <div className="workspace-form-grid workspace-essential-fields">
              <label>
                Source target
                <input inputMode="numeric" maxLength={1000} value={current.assignment.sourceCount} onChange={(event) => changeAssignment("sourceCount", event.target.value)} placeholder="e.g. 6" />
              </label>
              <label>
                Required source types
                <input maxLength={1000} value={current.assignment.sourceTypes} onChange={(event) => changeAssignment("sourceTypes", event.target.value)} placeholder="e.g. Peer-reviewed articles" />
              </label>
            </div>

            <details className="workspace-optional-fields" defaultOpen={Boolean(current.assignment.course || current.assignment.assignmentType || current.assignment.dueDate || current.assignment.dateRange || current.assignment.constraints)}>
              <summary>More assignment details</summary>
              <div className="workspace-form-grid">
                <label>Course or section<input maxLength={1000} value={current.assignment.course} onChange={(event) => changeAssignment("course", event.target.value)} placeholder="e.g. FYS 100" /></label>
                <label>Assignment type<input maxLength={1000} value={current.assignment.assignmentType} onChange={(event) => changeAssignment("assignmentType", event.target.value)} placeholder="e.g. Literature review" /></label>
                <label>Due date<input type="date" value={current.assignment.dueDate} onChange={(event) => changeAssignment("dueDate", event.target.value)} /></label>
                <label>Date expectations<input maxLength={1000} value={current.assignment.dateRange} onChange={(event) => changeAssignment("dateRange", event.target.value)} placeholder="e.g. Published since 2020" /></label>
                <label className="wide">Other constraints<textarea maxLength={4000} value={current.assignment.constraints} onChange={(event) => changeAssignment("constraints", event.target.value)} rows={3} placeholder="Population, geography, methods, citation style..." /></label>
              </div>
            </details>

            <details className="workspace-optional-fields workspace-preset-disclosure">
              <summary>Use a course preset</summary>
              <div className="workspace-template-row">
                <label>
                  Choose a preset
                  <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                    <option value="">Select a course</option>
                    {COURSE_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>{template.label}</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={applyTemplate} disabled={!templateId}>Apply</button>
              </div>
            </details>
          </section>
        )}

        {(
          <section
            id="workspace-panel-trail"
            hidden={tab !== "trail"}
            className="workspace-section"
            role="tabpanel"
            tabIndex={0}
            aria-labelledby="workspace-tab-trail"
          >
            <SourceComparison items={comparisonItems} spec={progress.spec} onClear={() => { setComparisonIds([]); announce("Comparison cleared."); }} />
            <SavedSourcesView items={current.trail} onRemove={onRemoveResearchItem} onUpdate={onUpdateResearchItem} removedItem={removedItem} onUndoRemove={onUndoRemove} renderExtra={(item) => <>
              <label className="workspace-compare-choice"><input type="checkbox" checked={comparisonIds.includes(item.id)} onChange={() => toggleComparison(item.id)} aria-label={`Compare ${item.title}`} disabled={!comparisonIds.includes(item.id) && comparisonItems.length >= 3} />Compare source (up to 3)</label>
              <details className="workspace-item-notes"><summary>Requirements & citation</summary><SavedSourceEvidence item={item} spec={progress.spec} /><label>Citation details<textarea maxLength={4000} rows={2} value={item.citation} onChange={(event) => updateTrailItem(item.id, { citation: event.target.value })} placeholder="Check author, title, date and DOI in the original record." /></label></details>
            </>} />
            {current.trail.some((item) => !isSavedSource(item)) && <details className="workspace-saved-options"><summary>Saved databases & search options ({current.trail.filter((item) => !isSavedSource(item)).length})</summary>
              <ul className="workspace-trail-list">
                {current.trail.filter((item) => !isSavedSource(item)).map((item) => (
                  <li key={item.id}>
                    <div className="workspace-item-head">
                      <div>
                        <span>{isSavedSource(item) ? "Source" : item.kind === "database" ? "Database" : "Search"}</span>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}{Icon.external}</a>
                        ) : <strong>{item.title}</strong>}
                      </div>
                      <button type="button" onClick={() => onRemoveResearchItem ? onRemoveResearchItem(item) : removeTrailItem(item.id)} aria-label={`Unsave ${item.title}`}>{Icon.trash}</button>
                    </div>
                    {item.detail && <p>{item.detail}</p>}
                    <label>
                      Status
                      <select value={item.status} onChange={(event) => updateTrailItem(item.id, { status: event.target.value })}>
                        {RESEARCH_ITEM_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
                      </select>
                    </label>
                    <details className="workspace-item-notes">
                      <summary>Notes &amp; citation{item.notes || item.citation ? " · added" : ""}</summary>
                    <label>
                      Notes
                      <textarea maxLength={4000} rows={2} value={item.notes} onChange={(event) => updateTrailItem(item.id, { notes: event.target.value })} placeholder="Why this may help, evidence to verify, useful pages..." />
                    </label>
                    <label>
                      Citation details
                      <textarea maxLength={4000} rows={2} value={item.citation} onChange={(event) => updateTrailItem(item.id, { citation: event.target.value })} placeholder="Author, title, container, date, DOI or URL..." />
                    </label>
                    </details>
                  </li>
                ))}
              </ul>
            </details>}
          </section>
        )}

        {(
          <section
            id="workspace-panel-history"
            hidden={tab !== "history"}
            className="workspace-section"
            role="tabpanel"
            tabIndex={0}
            aria-labelledby="workspace-tab-history"
          >
            <div className="workspace-section-head">
              <div>
                <h3 id="workspace-history-title">Search activity</h3>
                <span>{current.searchHistory.length} recorded</span>
              </div>
            </div>
            <p className="workspace-brief-help">Search runs preserve the request, resolved criteria, provider outcomes, and time. Opened links and manually recorded searches are separate activities.</p>
            <form className="workspace-manual-search" onSubmit={addManualSearch}>
              <label htmlFor="manual-search-note">Record a search you tried elsewhere</label>
              <input id="manual-search-note" maxLength={4000} value={manualQuery} onChange={(event) => setManualQuery(event.target.value)} placeholder='e.g. "economic sanctions" AND democracy' />
              <button type="submit" disabled={!manualQuery.trim()}>Save search</button>
            </form>
            {!current.searchHistory.length && <EmptyState>No activity yet. Completed Navigator searches will appear here with their criteria.</EmptyState>}
            {[
              { kind: "search-run", label: "Search runs" },
              { kind: "manual-search", label: "Searches recorded manually" },
              { kind: "opened-resource", label: "Opened resources" },
              { kind: "legacy-activity", label: "Earlier activity · type not recorded" },
            ].map(({ kind, label }) => {
              const entries = current.searchHistory.filter((entry) => entry.kind === kind);
              return entries.length ? <section key={kind} aria-label={label}>
                <h4>{label} ({entries.length})</h4>
                <ul className="workspace-history-list">
                  {entries.map((entry) => <li key={entry.id}>
                    <div className="workspace-item-head">
                      <div>
                        <span className="workspace-activity-meta">{entry.tool}{formatDate(entry.usedAt) && <time dateTime={new Date(entry.usedAt).toISOString()}>{formatDate(entry.usedAt)}</time>}</span>
                        {entry.url ? <a href={entry.url} target="_blank" rel="noopener noreferrer"><span className="workspace-query">{entry.query}</span>{Icon.external}</a> : <span className="workspace-query">{entry.query}</span>}
                      </div>
                      <button type="button" onClick={() => removeSearch(entry.id)} aria-label={`Remove activity ${entry.query}`}>{Icon.trash}</button>
                    </div>
                    {kind === "search-run" && <>
                      <p><strong>{entry.resultCount ?? "Unknown"} results</strong> · {entry.providers.map((provider) => `${provider.id}: ${provider.status}`).join("; ") || "Provider status not recorded"}</p>
                      <details>
                        <summary>Request, queries &amp; criteria</summary>
                        <p><strong>Original request:</strong> {entry.originalRequest}</p>
                        {entry.queries.length > 0 ? <ul>{entry.queries.map((query, index) => <li key={index}><strong>{query.provider || "Provider not recorded"}</strong> · {query.dialect || "Dialect not recorded"}: {query.query}</li>)}</ul> : <p>No executed query was reported.</p>}
                        <p>Run outcome: {entry.runStatus || "not recorded"}</p>
                        <p>Release: {entry.releaseId || "not recorded"} · Configuration: {entry.configVersion || "not recorded"}</p>
                        <p>Started: {formatDate(entry.startedAt) || "not recorded"} · Completed: {formatDate(entry.completedAt) || "not recorded"}</p>
                        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: ".8rem" }}>{JSON.stringify(entry.researchSpec, null, 2)}</pre>
                      </details>
                      {onReplaySearch && entry.researchSpec?.topic && <button type="button" className="workspace-replay-search" onClick={() => onReplaySearch(entry)}>Run these criteria again</button>}
                      <p className="workspace-brief-help">Provider indexes change; a new run may return different results.</p>
                    </>}
                    <label>Outcome or next step
                      <input maxLength={4000} value={entry.resultNote || ""} onChange={(event) => updateSearch(entry.id, event.target.value)} placeholder="e.g. Useful results; try narrowing by year" />
                    </label>
                  </li>)}
                </ul>
              </section> : null;
            })}

          </section>
        )}

        {(
          <section
            id="workspace-panel-review"
            hidden={tab !== "review"}
            className="workspace-section"
            role="tabpanel"
            tabIndex={0}
            aria-labelledby="workspace-tab-review"
          >
            <div className="workspace-section-head">
              <div><h3 id="workspace-review-title">Review &amp; share</h3></div>
            </div>
            <p className="workspace-brief-help">Check what you have, then take your research into a paper or a conversation with a librarian.</p>
            <div className="workspace-review-metrics">
              <div><strong>{current.trail.length}</strong><span>saved items</span></div>
              <div><strong>{usableItems}</strong><span>sources to use</span></div>
              <div><strong>{current.searchHistory.length}</strong><span>activity entries</span></div>
            </div>
            {(progress.selected > 0 || progress.target > 0) && <RequirementProgress progress={progress} id="workspace-review-progress" />}
            <div className="workspace-review-block">
              <strong>Your brief</strong>
              {assignmentSummary ? <pre>{assignmentSummary}</pre> : <p>No requirements added yet. Use Brief if your assignment has a source target or other requirements.</p>}
            </div>
            <div className="workspace-portable">
              <h4>Share your research summary</h4>
              <p>Includes your brief, saved items, notes, and search activity. You can review the librarian handoff before sending anything.</p>
              <div className="workspace-review-actions">
                <button type="button" className="primary" onClick={onHandoff}>Prepare librarian handoff</button>
                <button type="button" onClick={copyReview}>{Icon.copy}<span>Copy summary</span></button>
                <button type="button" onClick={downloadReview}>{Icon.download}<span>Download summary</span></button>
              </div>
              <p className="workspace-evidence-note">The summary downloads as a Markdown text file.</p>
            </div>
            <details className="workspace-optional-fields">
              <summary>Back up or restore this project</summary>
              <p className="workspace-evidence-note">{privateMode ? "Private session • cleared when you end the session or reload. Export a copy to keep it." : "Research is saved in this browser, not synced to your library account. Download a backup to keep a copy or move it to another browser."}</p>
              <div className="workspace-portable-actions">
                <button type="button" onClick={downloadWorkspace}>Download backup</button>
                <button type="button" onClick={() => importRef.current?.click()} disabled={importing}>{importing ? "Reading file…" : "Restore backup"}</button>
                <input ref={importRef} type="file" accept=".json,application/json" onChange={importWorkspace} hidden aria-label="Choose a Navigator workspace JSON file" />
              </div>
              <p className="workspace-evidence-note">Use a Navigator JSON backup, up to 2 MB. Restoring adds items, skips duplicates, and keeps an existing brief. Limit: 100 saved items and 100 activity entries.</p>
            </details>
            <p className="workspace-evidence-note"><strong>Before you cite:</strong> open the original source to verify its claims, citation details, and access. AI guidance and source metadata can be incomplete or mistaken.</p>
          </section>
        )}
      </div>
    </aside>
  );
}
