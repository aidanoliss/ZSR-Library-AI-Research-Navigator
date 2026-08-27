import { useEffect, useMemo, useRef, useState } from "react";
import { downloadText } from "./exportPlan.js";
import {
  COURSE_TEMPLATES,
  RESEARCH_ITEM_STATUSES,
  assignmentContext,
  normalizeResearchWorkspace,
  workspaceToMarkdown,
} from "./researchWorkspace.js";

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
  { id: "brief", label: "Brief", icon: Icon.brief },
  { id: "trail", label: "Trail", icon: Icon.trail },
  { id: "history", label: "Searches", icon: Icon.history },
  { id: "review", label: "Review", icon: Icon.review },
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

export default function ResearchWorkspace({ open, workspace, topic, onChange, onClose, onHandoff }) {
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [tab, setTab] = useState("brief");
  const [templateId, setTemplateId] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const current = useMemo(() => normalizeResearchWorkspace(workspace), [workspace]);
  const assignmentSummary = assignmentContext(current.assignment);
  const usableItems = current.trail.filter((item) => item.status === "use").length;

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  function changeAssignment(field, value) {
    onChange({ ...current, assignment: { ...current.assignment, [field]: value } });
  }

  function applyTemplate() {
    const template = COURSE_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    const { id, label, ...fields } = template;
    onChange({ ...current, assignment: { ...current.assignment, ...fields, enabled: true } });
  }

  function updateTrailItem(id, patch) {
    onChange({
      ...current,
      trail: current.trail.map((item) => item.id === id ? { ...item, ...patch } : item),
    });
  }

  function removeTrailItem(id) {
    onChange({ ...current, trail: current.trail.filter((item) => item.id !== id) });
  }

  function updateSearch(id, resultNote) {
    onChange({
      ...current,
      searchHistory: current.searchHistory.map((item) => item.id === id ? { ...item, resultNote } : item),
    });
  }

  function removeSearch(id) {
    onChange({ ...current, searchHistory: current.searchHistory.filter((item) => item.id !== id) });
  }

  function addManualSearch(event) {
    event.preventDefault();
    const query = manualQuery.trim();
    if (!query) return;
    onChange({
      ...current,
      searchHistory: [
        {
          id: `search-manual-${Date.now()}`,
          key: `${query.toLowerCase()}|manual`,
          query,
          tool: "Manual note",
          url: "",
          resultNote: "",
          usedAt: Date.now(),
        },
        ...current.searchHistory,
      ].slice(0, 100),
    });
    setManualQuery("");
  }

  async function copyReview() {
    const markdown = workspaceToMarkdown(current, topic);
    await navigator.clipboard?.writeText(markdown).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function downloadReview() {
    downloadText("zsr-research-trail.md", workspaceToMarkdown(current, topic));
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
          <span>Saved with this chat</span>
          <h2 id="research-workspace-title">Research workspace</h2>
        </div>
        <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close research workspace">{Icon.close}</button>
      </header>

      <p className="workspace-local-note">Stored only in this browser. Nothing here is sent to ZSR unless you choose a librarian handoff.</p>

      <nav className="research-workspace-tabs" role="tablist" aria-label="Research workspace sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            id={`workspace-tab-${item.id}`}
            type="button"
            role="tab"
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
            aria-selected={tab === item.id}
            aria-controls={`workspace-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="research-workspace-body">
        {tab === "brief" && (
          <section
            id="workspace-panel-brief"
            className="workspace-section"
            role="tabpanel"
            aria-labelledby="workspace-tab-brief"
          >
            <div className="workspace-section-head">
              <div>
                <span>Assignment constraints</span>
                <h3 id="workspace-brief-title">Research brief</h3>
              </div>
              <label className="workspace-toggle">
                <input
                  type="checkbox"
                  checked={current.assignment.enabled}
                  onChange={(event) => changeAssignment("enabled", event.target.checked)}
                />
                <span>Use in AI requests</span>
              </label>
            </div>

            <div className="workspace-template-row">
              <label>
                Course preset
                <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                  <option value="">Choose a preset</option>
                  {COURSE_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>{template.label}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={applyTemplate} disabled={!templateId}>Apply</button>
            </div>

            <div className="workspace-form-grid">
              <label>
                Course or section
                <input value={current.assignment.course} onChange={(event) => changeAssignment("course", event.target.value)} placeholder="e.g. FYS 100" />
              </label>
              <label>
                Assignment type
                <input value={current.assignment.assignmentType} onChange={(event) => changeAssignment("assignmentType", event.target.value)} placeholder="e.g. Literature review" />
              </label>
              <label>
                Due date
                <input type="date" value={current.assignment.dueDate} onChange={(event) => changeAssignment("dueDate", event.target.value)} />
              </label>
              <label>
                Source target
                <input value={current.assignment.sourceCount} onChange={(event) => changeAssignment("sourceCount", event.target.value)} placeholder="e.g. 6 sources" />
              </label>
              <label className="wide">
                Required source types
                <input value={current.assignment.sourceTypes} onChange={(event) => changeAssignment("sourceTypes", event.target.value)} placeholder="Peer-reviewed articles, books, primary sources..." />
              </label>
              <label className="wide">
                Date expectations
                <input value={current.assignment.dateRange} onChange={(event) => changeAssignment("dateRange", event.target.value)} placeholder="e.g. Last 10 years plus foundational studies" />
              </label>
              <label className="wide">
                Other constraints
                <textarea value={current.assignment.constraints} onChange={(event) => changeAssignment("constraints", event.target.value)} rows={3} placeholder="Population, geography, methods, citation style, instructor requirements..." />
              </label>
            </div>
          </section>
        )}

        {tab === "trail" && (
          <section
            id="workspace-panel-trail"
            className="workspace-section"
            role="tabpanel"
            aria-labelledby="workspace-tab-trail"
          >
            <div className="workspace-section-head">
              <div>
                <span>{current.trail.length} saved</span>
                <h3 id="workspace-trail-title">Research trail</h3>
              </div>
            </div>
            {!current.trail.length ? (
              <EmptyState>Save a ZSR path, catalog lead, or search string from a response to build your trail.</EmptyState>
            ) : (
              <ul className="workspace-trail-list">
                {current.trail.map((item) => (
                  <li key={item.id}>
                    <div className="workspace-item-head">
                      <div>
                        <span>{item.kind}</span>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}{Icon.external}</a>
                        ) : <strong>{item.title}</strong>}
                      </div>
                      <button type="button" onClick={() => removeTrailItem(item.id)} aria-label={`Remove ${item.title}`}>{Icon.trash}</button>
                    </div>
                    {item.detail && <p>{item.detail}</p>}
                    <label>
                      Status
                      <select value={item.status} onChange={(event) => updateTrailItem(item.id, { status: event.target.value })}>
                        {RESEARCH_ITEM_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
                      </select>
                    </label>
                    <label>
                      Notes
                      <textarea rows={2} value={item.notes} onChange={(event) => updateTrailItem(item.id, { notes: event.target.value })} placeholder="Why this may help, evidence to verify, useful pages..." />
                    </label>
                    <label>
                      Citation details
                      <textarea rows={2} value={item.citation} onChange={(event) => updateTrailItem(item.id, { citation: event.target.value })} placeholder="Author, title, container, date, DOI or URL..." />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "history" && (
          <section
            id="workspace-panel-history"
            className="workspace-section"
            role="tabpanel"
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
              <input id="manual-search-note" value={manualQuery} onChange={(event) => setManualQuery(event.target.value)} placeholder="Add a search you tried" />
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
                      <input value={entry.resultNote || ""} onChange={(event) => updateSearch(entry.id, event.target.value)} placeholder="Too broad, useful results, no results..." />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "review" && (
          <section
            id="workspace-panel-review"
            className="workspace-section"
            role="tabpanel"
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
                <li>Live public ZSR discovery metadata and curated ZSR link-outs are available.</li>
                <li>Subscription access, full text, and citation details still require confirmation in ZSR.</li>
                <li>No library account, course system, or saved-list sync is implied by this local prototype.</li>
              </ul>
            </div>
            <div className="workspace-review-actions">
              <button type="button" onClick={copyReview}>{Icon.copy}<span>{copied ? "Copied" : "Copy packet"}</span></button>
              <button type="button" onClick={downloadReview}>{Icon.download}<span>Download</span></button>
              <button type="button" className="primary" onClick={onHandoff}>Ask a librarian</button>
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
