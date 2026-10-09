import { useEffect, useMemo, useRef, useState } from "react";
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
import "./workspace.css";

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
  { id: "trail", label: "Sources" },
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

export default function ResearchWorkspace({ open, workspace, topic, onChange, onClose, onHandoff, initialTab = "trail", researchSpec = null }) {
  const closeButtonRef = useRef(null);
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
      announce("Review packet copied.");
    } catch { setNotice(""); setError("Could not copy the packet. Use Download Markdown instead."); }
  }

  function downloadReview() {
    try { downloadText("zsr-research-trail.md", workspaceToMarkdown(current, topic)); announce("Markdown download started."); }
    catch { setNotice(""); setError("The download could not start. Try copying the packet."); }
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

      <p className="workspace-local-note">Saved in this browser. Export a backup from Review.</p>

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

      <div className="research-workspace-body">
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
              <label className="workspace-toggle">
                <input
                  type="checkbox"
                  checked={current.assignment.enabled}
                  onChange={(event) => changeAssignment("enabled", event.target.checked)}
                />
                <span>Include in AI requests</span>
              </label>
            </div>

            <p className="workspace-brief-help">Add only the requirements that matter for finding sources. These details are sent to the AI only when the switch above is on.</p>
            {(progress.selected > 0 || progress.target > 0) && <RequirementProgress progress={progress} id="workspace-brief-progress" />}

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
            <div className="workspace-section-head">
              <div>
                <span>{current.trail.length} saved</span>
                <h3 id="workspace-trail-title">My sources and saved searches</h3>
              </div>
            </div>
            {(progress.selected > 0 || progress.target > 0) && <RequirementProgress progress={progress} id="workspace-trail-progress" />}
            <SourceComparison items={comparisonItems} spec={progress.spec} onClear={() => { setComparisonIds([]); announce("Comparison cleared."); }} />
            {current.trail.some(isSavedSource) && <p className="workspace-evidence-note">Select two or three sources to compare. Mark “Use” to include a source in requirement checks.</p>}
            {!current.trail.length ? (
              <EmptyState>Start with a topic, ask for source leads, and choose Save on a result. Your sources, notes, and comparison will appear here. Saved database paths help you search but do not count toward your source target.</EmptyState>
            ) : (
              <ul className="workspace-trail-list">
                {current.trail.map((item) => (
                  <li key={item.id}>
                    <div className="workspace-item-head">
                      <div>
                        <span>{isSavedSource(item) ? "Source" : item.kind}</span>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}{Icon.external}</a>
                        ) : <strong>{item.title}</strong>}
                      </div>
                      <button type="button" onClick={() => removeTrailItem(item.id)} aria-label={`Remove ${item.title}`}>{Icon.trash}</button>
                    </div>
                    {item.detail && <p>{item.detail}</p>}
                    {isSavedSource(item) && <>
                      <label className="workspace-compare-choice"><input type="checkbox" checked={comparisonIds.includes(item.id)} onChange={() => toggleComparison(item.id)} disabled={!comparisonIds.includes(item.id) && comparisonItems.length >= 3} />Compare {item.title}</label>
                      <SavedSourceEvidence item={item} spec={progress.spec} />
                    </>}
                    <label>
                      Status
                      <select value={item.status} onChange={(event) => updateTrailItem(item.id, { status: event.target.value })}>
                        {RESEARCH_ITEM_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
                      </select>
                    </label>
                    <label>
                      Notes
                      <textarea maxLength={4000} rows={2} value={item.notes} onChange={(event) => updateTrailItem(item.id, { notes: event.target.value })} placeholder="Why this may help, evidence to verify, useful pages..." />
                    </label>
                    <label>
                      Citation details
                      <textarea maxLength={4000} rows={2} value={item.citation} onChange={(event) => updateTrailItem(item.id, { citation: event.target.value })} placeholder="Author, title, container, date, DOI or URL..." />
                    </label>
                  </li>
                ))}
              </ul>
            )}
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
                <span>{current.searchHistory.length} recorded</span>
                <h3 id="workspace-history-title">Searches tried</h3>
              </div>
            </div>
            <form className="workspace-manual-search" onSubmit={addManualSearch}>
              <label className="sr-only" htmlFor="manual-search-note">Add a search string</label>
              <input id="manual-search-note" maxLength={4000} value={manualQuery} onChange={(event) => setManualQuery(event.target.value)} placeholder="Add a search you tried" />
              <button type="submit" disabled={!manualQuery.trim()}>Add</button>
            </form>
            {!current.searchHistory.length ? (
              <EmptyState>Searches opened from Navigator links will appear here automatically.</EmptyState>
            ) : (
              <ul className="workspace-history-list">
                {current.searchHistory.map((entry) => (
                  <li key={entry.id}>
                    <div className="workspace-item-head">
                      <div>
                        <span>{entry.tool} {formatDate(entry.usedAt) ? `- ${formatDate(entry.usedAt)}` : ""}</span>
                        {entry.url ? <a href={entry.url} target="_blank" rel="noopener noreferrer"><code>{entry.query}</code>{Icon.external}</a> : <code>{entry.query}</code>}
                      </div>
                      <button type="button" onClick={() => removeSearch(entry.id)} aria-label={`Remove search ${entry.query}`}>{Icon.trash}</button>
                    </div>
                    <label>
                      What happened?
                      <input maxLength={4000} value={entry.resultNote || ""} onChange={(event) => updateSearch(entry.id, event.target.value)} placeholder="Too broad, useful results, no results..." />
                    </label>
                  </li>
                ))}
              </ul>
            )}
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
              <div>
                <span>Librarian-ready summary</span>
                <h3 id="workspace-review-title">Review packet</h3>
              </div>
            </div>
            <div className="workspace-review-metrics">
              <div><strong>{current.trail.length}</strong><span>saved leads</span></div>
              <div><strong>{usableItems}</strong><span>marked use</span></div>
              <div><strong>{current.searchHistory.length}</strong><span>searches tried</span></div>
            </div>
            <div className="workspace-review-block">
              <strong>Assignment brief</strong>
              {assignmentSummary ? <pre>{assignmentSummary}</pre> : <p>Add the assignment constraints a librarian should know.</p>}
            </div>
            <div className="workspace-review-block">
              <strong>Integration status</strong>
              <ul>
                <li>Navigator offers curated ZSR links and source searches when their providers are available. Check each result's provider and access notice.</li>
                <li>Subscription access, full text, and citation details still require confirmation in ZSR.</li>
                <li>No library account, course system, or saved-list sync is implied by this local prototype.</li>
              </ul>
            </div>
            <div className="workspace-portable">
              <h4>Move or back up your research</h4>
              <p>JSON includes your brief, sources, notes, citation details, and search history. Imports add to this chat, skip duplicates, and keep an existing brief. Maximum 100 items, 100 searches, and 2 MB.</p>
              <div className="workspace-portable-actions">
                <button type="button" onClick={downloadWorkspace}>Export workspace JSON</button>
                <button type="button" onClick={() => importRef.current?.click()} disabled={importing}>{importing ? "Reading file…" : "Import workspace JSON"}</button>
                <input ref={importRef} type="file" accept=".json,application/json" onChange={importWorkspace} hidden aria-label="Choose a Navigator workspace JSON file" />
              </div>
            </div>
            <div className="workspace-review-actions">
              <button type="button" onClick={copyReview}>{Icon.copy}<span>Copy packet</span></button>
              <button type="button" onClick={downloadReview}>{Icon.download}<span>Download Markdown</span></button>
              <button type="button" className="primary" onClick={onHandoff}>Ask a librarian</button>
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
