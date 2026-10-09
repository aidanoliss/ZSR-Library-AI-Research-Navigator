import { useEffect, useMemo, useRef, useState } from "react";
import AdminPanel from "./AdminPanel.jsx";
import { allowStorageRetry, readStoredJSON, readStoredText, removeStoredValue, storageReadFailed, writeStoredText } from "./browserStorage.js";
import { inferExplicitModeRequest } from "../config/researchSpec.js";
import { clientFallbackContext } from "./clientFallbackContext.js";
import AssistantMessage from "./AssistantMessage.jsx";
import HandoffModal from "./HandoffModal.jsx";
import ResearchWorkspace from "./ResearchWorkspace.jsx";
import { LocalStudyPanel } from "./ResultsWorkspace.jsx";
import { createSearchMetricsSession } from "./searchMetrics.js";
import { searchRunStatus } from "./resultSearch.js";
import { chatFailureMessage, requestChatReply } from "./chatTransport.js";
import { submittedResearchTopicContext } from "./conversationContext.js";
import { conversationToMarkdown, downloadText } from "./exportPlan.js";
import {
  addResearchItem,
  saveSourceNotes,
  addSearchHistoryEntry,
  assignmentContext,
  createResearchWorkspace,
  normalizeResearchWorkspace,
  researchItemKey,
} from "./researchWorkspace.js";
import {
  DEFAULT_MODE_ID,
  DEFAULT_RESPONSE_STYLE_ID,
  RESPONSE_STYLES,
  SEARCH_MODES,
  LIBRARY_LINKS,
  getResponseStyle,
  getSearchMode,
} from "../config/libraryLinks.js";
import {
  ACCESS_SCOPES,
  DEFAULT_ACCESS_SCOPE_ID,
  getAccessScope,
} from "../config/accessScope.js";
import { buildResearchPlan, buildSearchTermSuggestions } from "../config/researchAgent.js";
import { recommendLibrarianRoutes } from "../config/librarianRoutes.js";
import {
  DEFAULT_SUBJECT_FOCUS_ID,
  SUBJECT_FOCUSES,
  resolveSubjectFocus,
} from "../config/subjectFocus.js";

const STORAGE_KEY = "zsr-research-navigator-draft";
const SESSIONS_KEY = "zsr-research-navigator-sessions";
const ACTIVE_SESSION_KEY = "zsr-research-navigator-active-session";
const FOLDERS_KEY = "zsr-research-navigator-folders";
const DEFAULT_FOLDER_ID = "general";

const INITIAL_TOPIC = "";
const TRY_PROMPTS = [
  "Sanctions and their impact on authoritarian regimes vs democracies",
  "Urban tree canopy and neighborhood summer temperatures",
];

const FALLBACK_SEARCH_TOOLS = [
  {
    id: "zsr-discovery",
    name: "ZSR Article Search",
    search_url_template: LIBRARY_LINKS.zsrArticleSearch,
  },
  {
    id: "google-scholar",
    name: "Google Scholar",
    search_url_template: LIBRARY_LINKS.googleScholarSearch,
  },
];

function refreshedSourceStatus(discovery) {
  const outcomes = Object.entries(discovery?.lanes || {})
    .filter(([, lane]) => lane?.requested)
    .map(([id, lane]) => {
      const label = id === "openAccess" ? "Open-access lookup" : "Library lookup";
      if (lane.outcome === "success") return `${label}: ${lane.resultCount || 0} leads returned`;
      if (lane.outcome === "empty") return `${label}: no leads matched`;
      if (lane.outcome === "timeout") return `${label}: timed out`;
      if (lane.outcome === "rate_limited") return `${label}: rate limited`;
      return `${label}: ${String(lane.outcome || lane.status || "status unavailable").replace(/_/g, " ")}`;
    });
  return outcomes.join(" · ") || "Source lookup status unavailable";
}

const Icon = {
  sidebarClose: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m7-12-4 4 4 4" /></svg>,
  sidebarOpen: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m4-12 4 4-4 4" /></svg>,
  plus: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  folder: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h6l2 2h8v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" /></svg>,
  trash: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>,
  more: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>,
  pin: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6v6l2 7H7l2-7V4z" /><path d="M12 17v5" /><path d="M8 4h8" /></svg>,
  librarian: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8l8-4 8 4v12" /><path d="M8 20v-7h8v7" /><path d="M9 9h6" /></svg>,
  mail: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>,
  arrowUp: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>,
  arrowRight: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>,
  copy: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  download: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>,
  print: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5" /><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /></svg>,
  share: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.7 6.8-4.4M8.6 13.3l6.8 4.4" /></svg>,
  send: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7z" /></svg>,
  handoff: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l1 2h3v14H5V6h3l1-2z" /><path d="M9 12h5" /><path d="M9 16h4" /><path d="M16 12h5" /><path d="m19 10 2 2-2 2" /></svg>,
  admin: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4z" /><path d="M9 12l2 2 4-5" /></svg>,
  workspace: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z" /><path d="M9 8h6M9 12h6M9 16h3" /><path d="m15 16 2 2 3-4" /></svg>,
  answerSources: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10a2 2 0 0 1 2 2v4" /><path d="M5 4v16h6" /><path d="M8 8h5" /><path d="M8 12h3" /><circle cx="16" cy="16" r="4" /><path d="m19 19 2 2" /></svg>,
  answerFirst: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16" /><path d="M4 10h12" /><path d="M4 15h9" /><path d="M4 20h6" /></svg>,
  plan: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6" /><path d="M9 13h6" /><path d="m8 17 1.5 1.5L12 16" /></svg>,
  sources: <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></svg>,
};

function makeSession(messages = [], mode = DEFAULT_MODE_ID, responseStyle = DEFAULT_RESPONSE_STYLE_ID, subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID, accessScope = DEFAULT_ACCESS_SCOPE_ID) {
  const firstUser = messages.find((m) => m.role === "user")?.content || "New research topic";
  return {
    id: crypto.randomUUID(),
    title: firstUser.slice(0, 64),
    mode,
    responseStyle,
    subjectFocusId,
    accessScope: getAccessScope(accessScope).id,
    researchWorkspace: createResearchWorkspace(),
    folderId: DEFAULT_FOLDER_ID,
    messages,
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function sortSessions(items) {
  return [...items].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

function readSessions() {
  try {
    const parsed = readStoredJSON(SESSIONS_KEY, [], undefined, (value) => Array.isArray(value) && value.every((item) => item && typeof item === "object" && !Array.isArray(item)));
    return Array.isArray(parsed)
      ? sortSessions(parsed.map((session) => ({
        ...session,
        folderId: session.folderId || DEFAULT_FOLDER_ID,
        pinned: Boolean(session.pinned),
        subjectFocusId: session.subjectFocusId || DEFAULT_SUBJECT_FOCUS_ID,
        accessScope: getAccessScope(session.accessScope).id,
        researchWorkspace: normalizeResearchWorkspace(session.researchWorkspace),
        messages: Array.isArray(session.messages) ? session.messages : [],
        updatedAt: session.updatedAt || 0,
      })))
      : [];
  } catch {
    return [];
  }
}

function readFolders() {
  try {
    const parsed = readStoredJSON(FOLDERS_KEY, [], undefined, Array.isArray);
    const customFolders = Array.isArray(parsed) ? parsed.filter((folder) => folder?.id && folder?.name) : [];
    return uniqueBy(
      [{ id: DEFAULT_FOLDER_ID, name: "General" }, ...customFolders],
      (folder) => folder.id
    );
  } catch {
    return [{ id: DEFAULT_FOLDER_ID, name: "General" }];
  }
}

function initialTopicFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("topic") || INITIAL_TOPIC;
}

function LoadingBubble() {
  return (
    <div className="bubble assistant loading-bubble" role="status" aria-live="polite">
      <span className="typing-text">Preparing your result<span className="typing-dots" aria-hidden="true">...</span></span>
      <span className="loading-rotate" aria-hidden="true">Checking available source metadata</span>
    </div>
  );
}

function ModeSelector({ value, onChange, accessScope, onAccessScopeChange, responseStyle, onResponseStyleChange, providerStatus, compact = false }) {
  const active = getSearchMode(value);
  const activeAccessScope = getAccessScope(accessScope);
  const activeStyle = getResponseStyle(responseStyle);
  return (
    <section className={`mode-panel ${compact ? "compact" : ""}`} aria-labelledby={compact ? "mode-label-compact" : "mode-label"}>
      <div className="mode-copy">
        <label id={compact ? "mode-label-compact" : "mode-label"} htmlFor={compact ? "research-mode-compact" : "research-mode"}>
          Research mode
        </label>
        {!compact && <p>{active.description}</p>}
      </div>
      <select
        id={compact ? "research-mode-compact" : "research-mode"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {SEARCH_MODES.map((mode) => (
          <option key={mode.id} value={mode.id}>{mode.label}</option>
        ))}
      </select>
      <div className="access-scope-control">
        <div>
          <label htmlFor={compact ? "access-scope-compact" : "access-scope"}>Source access</label>
          {!compact && <p>{activeAccessScope.description}</p>}
        </div>
        <select
          id={compact ? "access-scope-compact" : "access-scope"}
          value={activeAccessScope.id}
          onChange={(event) => onAccessScopeChange(event.target.value)}
        >
          {ACCESS_SCOPES.map((scope) => (
            <option key={scope.id} value={scope.id} disabled={scope.id !== "library" && providerStatus?.lanes?.openAccess?.configured === false}>{scope.label}{scope.id !== "library" && providerStatus?.lanes?.openAccess?.configured === false ? " · unavailable" : ""}</option>
          ))}
        </select>
      </div>
      {providerStatus?.lanes?.openAccess?.configured === false && <p className="muted">Open-access discovery is not configured here. Library results can still include openly available works.</p>}
      <div className="response-style" role="group" aria-label="Response style">
        <div>
          <span>Response style</span>
          {!compact && <p>{activeStyle.description}</p>}
        </div>
        <div className="response-style-options">
          {RESPONSE_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              className={responseStyle === style.id ? "active" : ""}
              onClick={() => onResponseStyleChange(style.id)}
              aria-pressed={responseStyle === style.id}
              title={style.description}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function SubjectFocusControl({ value, detectedFocus, onChange }) {
  const activeFocus = detectedFocus || resolveSubjectFocus(value, "");
  return (
    <section className="subject-focus-panel" aria-labelledby="subject-focus-label">
      <div>
        <label id="subject-focus-label" htmlFor="subject-focus-select">Subject focus</label>
        <p>
          {value === DEFAULT_SUBJECT_FOCUS_ID
            ? `Auto: ${activeFocus.shortLabel || activeFocus.label}`
            : activeFocus.description}
        </p>
      </div>
      <select
        id="subject-focus-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {SUBJECT_FOCUSES.map((focus) => (
          <option key={focus.id} value={focus.id}>{focus.label}</option>
        ))}
      </select>
    </section>
  );
}

const RESPONSE_STYLE_ICONS = {
  hybrid: Icon.answerSources,
  answer: Icon.answerFirst,
  plan: Icon.plan,
  sources: Icon.sources,
};

function ComposerStyleSwitch({ value, onChange }) {
  return (
    <div className="composer-style-switcher" role="group" aria-label="Response style">
      {RESPONSE_STYLES.map((style) => {
        const active = value === style.id;
        return (
          <button
            key={style.id}
            type="button"
            className={active ? "active" : ""}
            onClick={(event) => {
              onChange(style.id);
            }}
            aria-label={`${style.label}: ${style.description}`}
            aria-pressed={active}
            data-tip={style.label}
            title={style.description}
          >
            {RESPONSE_STYLE_ICONS[style.id] || Icon.answerSources}
            <span className="sr-only">{style.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SessionRow({ session, activeId, onOpen, onTogglePin, onDelete, className = "" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const active = session.id === activeId;
  const modeLabel = getSearchMode(session.mode).shortLabel;

  return (
    <div
      className={`session-row ${className} ${active ? "active" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
      }}
    >
      <button
        type="button"
        className={`session-button ${className} ${active ? "active" : ""}`}
        title={session.title}
        onClick={() => onOpen(session.id)}
      >
        <strong>{session.title}</strong>
        <span>{session.pinned ? `Pinned · ${modeLabel}` : modeLabel}</span>
      </button>
      <button
        type="button"
        className="session-menu-trigger"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={`More options for ${session.title}`}
        aria-expanded={menuOpen}
      >
        {Icon.more}
      </button>
      {menuOpen && (
        <div className="session-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onTogglePin(session.id);
              setMenuOpen(false);
            }}
          >
            {Icon.pin}
            <span>{session.pinned ? "Unpin chat" : "Pin chat"}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              onDelete(session.id);
              setMenuOpen(false);
            }}
          >
            {Icon.trash}
            <span>Delete chat</span>
          </button>
        </div>
      )}
    </div>
  );
}

function SessionSidebar({
  expanded,
  onExpandedChange,
  sessions,
  activeId,
  folders,
  activeFolderId,
  onFolderChange,
  onCreateFolder,
  onDeleteFolder,
  onOpen,
  onNew,
  onTogglePin,
  onDeleteSession,
}) {
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const newFolderButton = useRef(null);
  const sidebarToggle = useRef(null);
  const [showRecent, setShowRecent] = useState(false);
  const customFolders = folders.filter((folder) => folder.id !== DEFAULT_FOLDER_ID);
  const customFolderIds = new Set(customFolders.map((folder) => folder.id));
  const unfiledSessions = sortSessions(sessions.filter((session) => {
    const folderId = session.folderId || DEFAULT_FOLDER_ID;
    return folderId === DEFAULT_FOLDER_ID || !customFolderIds.has(folderId);
  }));

  function submitFolder(event) {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    onCreateFolder(name);
    closeFolderForm();
  }

  function closeFolderForm() {
    setFolderName("");
    setCreatingFolder(false);
    newFolderButton.current?.focus();
  }

  return (
    <aside className={`session-sidebar no-print ${expanded ? "is-expanded" : "is-collapsed"}`} aria-label="Research sessions"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented && expanded) {
          event.preventDefault();
          onExpandedChange(false);
          sidebarToggle.current?.focus();
        }
      }}>
      <div className="sidebar-heading">
        {expanded && <span>Research</span>}
        <button type="button" className="sidebar-toggle" ref={sidebarToggle}
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded} aria-controls="research-sidebar-content"
          aria-label={expanded ? "Close sidebar" : "Expand sidebar"}
          title={expanded ? "Close sidebar" : "Expand sidebar"}>
          {expanded ? Icon.sidebarClose : Icon.sidebarOpen}
          <span className="sidebar-toggle-label">{expanded ? "Close sidebar" : "Expand sidebar"}</span>
        </button>
      </div>
      <div id="research-sidebar-content" className="sidebar-content" hidden={!expanded}>
      <button type="button" className="new-topic-btn" onClick={() => onNew(DEFAULT_FOLDER_ID)}>
        {Icon.plus}
        <span>New topic</span>
      </button>
      <details className="folder-list" aria-label="Session folders">
        <summary>Folders <span className="folder-count">{customFolders.length || ""}</span></summary>
        <div className="folder-contents">
          {customFolders.map((folder) => {
            const folderSessions = sortSessions(sessions.filter((session) => (session.folderId || DEFAULT_FOLDER_ID) === folder.id));
            return (
              <details key={folder.id} className={`folder-group ${activeFolderId === folder.id ? "active" : ""}`}>
                <summary className="folder-select" onClick={() => onFolderChange(folder.id)}>
                  {Icon.folder}
                  <span title={folder.name}>{folder.name}</span>
                  <small className="folder-count" aria-label={`${folderSessions.length} topics`}>{folderSessions.length}</small>
                </summary>
                <div className="folder-session-list" aria-label={`${folder.name} topics`}>
                  <button type="button" className="folder-new-chat" onClick={() => onNew(folder.id)}>
                    {Icon.plus}<span>New topic here</span>
                  </button>
                  {folderSessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      activeId={activeId}
                      onOpen={onOpen}
                      onTogglePin={onTogglePin}
                      onDelete={onDeleteSession}
                      className="nested"
                    />
                  ))}
                  <button type="button" className="folder-remove" onClick={() => onDeleteFolder(folder.id)}
                    aria-label={`Remove folder ${folder.name}`} title="Remove folder; keep its topics in Recent research">
                    Remove folder
                  </button>
                </div>
              </details>
            );
          })}
          <button type="button" className="folder-add" ref={newFolderButton}
            aria-expanded={creatingFolder} aria-controls="folder-create-form"
            onClick={() => creatingFolder ? closeFolderForm() : setCreatingFolder(true)}>
            {Icon.plus}<span>New folder</span>
          </button>
          {creatingFolder && <form id="folder-create-form" className="folder-create" onSubmit={submitFolder}>
            <label htmlFor="folder-name">Folder name</label>
            <input id="folder-name" autoFocus maxLength={64} value={folderName}
              onChange={(event) => setFolderName(event.target.value)} placeholder="e.g. History seminar"
              onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeFolderForm(); } }} />
            <div className="folder-create-actions">
              <button type="submit" disabled={!folderName.trim()}>Create</button>
              <button type="button" onClick={closeFolderForm}>Cancel</button>
            </div>
          </form>}
        </div>
      </details>
      <button type="button" className="recent-toggle" aria-expanded={showRecent} aria-controls="recent-research-list" onClick={() => setShowRecent((shown) => !shown)}>
        {showRecent ? "Hide past topics" : "Browse past topics"}
      </button>
      <div className={`session-list ${showRecent ? "recent-open" : ""}`} id="recent-research-list">
        <h2>Recent research</h2>
        {unfiledSessions.length === 0 ? (
          <p>Your research sessions will appear here.</p>
        ) : (
          unfiledSessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              activeId={activeId}
              onOpen={onOpen}
              onTogglePin={onTogglePin}
              onDelete={onDeleteSession}
            />
          ))
        )}
      </div>
      </div>
    </aside>
  );
}

function PlannerContextSummary({ context }) {
  const lines = String(context || "")
    .split("\n")
    .map((line) => line.trim().replace(/^-\s*/, ""))
    .filter(Boolean);
  if (!lines.length) return null;
  return (
    <div className="sent-planner-context">
      <strong>Guided planner choices sent</strong>
      <ul>
        {lines.map((line, index) => (
          <li key={`${line}-${index}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function RequestMetaSummary({ message }) {
  if (!message?.subjectFocusLabel && !message?.assignmentContext) return null;
  return (
    <div className="request-meta-summary">
      {message.subjectFocusLabel && (
        <>
          <span>Subject focus sent</span>
          <strong>{message.subjectFocusLabel}</strong>
          {message.subjectFocusAuto && <em>Auto-detected</em>}
        </>
      )}
      {message.assignmentContext && (
        <details>
          <summary>Assignment brief sent</summary>
          <pre>{message.assignmentContext}</pre>
        </details>
      )}
    </div>
  );
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function buildHandoffPayload(messages, input, mode, responseStyle, subjectFocusId, researchWorkspace) {
  const assistantTurns = messages.filter((message) => message.role === "assistant");
  const topic = messages.find((message) => message.role === "user")?.content || String(input || "").trim();
  const subjectFocus = resolveSubjectFocus(
    subjectFocusId,
    topic || messages.filter((message) => message.role === "user").map((message) => message.content).join(" ")
  );
  const searchTerms = uniqueBy(
    assistantTurns.flatMap((message) => message.reply?.search_terms || []),
    (term) => String(term).toLowerCase()
  ).slice(0, 12);
  const liveResults = uniqueBy(
    assistantTurns.flatMap((message) => message.liveResults || []),
    (result) => result.url || result.title
  ).slice(0, 8);
  const matchedResources = uniqueBy(
    assistantTurns.flatMap((message) => message.matched || []),
    (resource) => resource.id || resource.url
  ).slice(0, 8);
  const librarianRoutes = uniqueBy(
    [
      ...assistantTurns.flatMap((message) => message.reply?.librarian_routes || []),
      ...recommendLibrarianRoutes(topic, mode, matchedResources),
    ],
    (route) => String(route.id || route.label || route.unit).toLowerCase()
  ).slice(0, 3);

  return {
    topic,
    mode: getSearchMode(mode).label,
    modeId: mode,
    responseStyle: getResponseStyle(responseStyle).label,
    subjectFocus: subjectFocus.label,
    subjectFocusId: subjectFocus.id,
    searchTerms,
    liveResults,
    matchedResources,
    librarianRoutes,
    researchWorkspace: normalizeResearchWorkspace(researchWorkspace),
  };
}

function plannerQuestionsFor(topic, modeLabel, providedQuestions = []) {
  const normalized = (providedQuestions || [])
    .filter((item) => item?.question && Array.isArray(item.options) && item.options.length)
    .slice(0, 3)
    .map((item) => ({
      question: item.question,
      why: item.why || "",
      options: item.options.slice(0, 5),
    }));
  if (normalized.length) return normalized;

  return [
    {
      question: "What time period should the search prioritize?",
      why: "Date limits change which databases, filters, and keywords are useful.",
      options: ["Last 5 years", "Last 10 years", "Any time period", "Historical context"],
    },
    {
      question: "What source types should ZSR scan first?",
      why: "The best route changes depending on whether you need articles, books, news, data, or primary sources.",
      options: ["Peer-reviewed articles", "Books/background", "News/current events", "Data/statistics", "Primary sources"],
    },
    {
      question: "How would you like to narrow your topic?",
      why: "Choosing a lens keeps the research question from becoming too broad.",
      options: ["A particular place", "A particular population", "Compare two approaches", "Historical change", "Not sure yet"],
    },
  ];
}

function PlannerModal({ open, topic, modeLabel, providedQuestions, docked = false, onClose, onComplete }) {
  const questions = useMemo(
    () => plannerQuestionsFor(topic, modeLabel, providedQuestions),
    [topic, modeLabel, providedQuestions]
  );
  const [answers, setAnswers] = useState({});
  const [customAnswers, setCustomAnswers] = useState({});
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) {
      setAnswers({});
      setCustomAnswers({});
      setStep(0);
    }
  }, [open, topic]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const currentIndex = Math.min(step, Math.max(questions.length - 1, 0));
  const currentQuestion = questions[currentIndex];
  const currentOptions = (currentQuestion?.options || []).slice(0, 3);
  const selected = answers[currentIndex] || [];
  const customValue = customAnswers[currentIndex] || "";
  const totalSteps = questions.length;

  function choose(index, option) {
    setAnswers((current) => {
      const existing = current[index] || [];
      const next = existing.includes(option)
        ? existing.filter((item) => item !== option)
        : [...existing, option];
      return { ...current, [index]: next };
    });
  }

  function updateCustom(index, value) {
    setCustomAnswers((current) => ({ ...current, [index]: value }));
  }

  function answerLine(question, index) {
    const picked = answers[index] || [];
    const custom = String(customAnswers[index] || "").trim();
    const values = [...picked, custom].filter(Boolean);
    return values.length ? `${question.question}: ${values.join("; ")}` : "";
  }

  function finish() {
    const lines = questions
      .map(answerLine)
      .filter(Boolean);
    onComplete(lines.join("\n"));
  }

  function nextStep() {
    if (currentIndex < totalSteps - 1) {
      setStep((current) => Math.min(current + 1, totalSteps - 1));
      return;
    }
    finish();
  }

  return (
    <section
      className={`planner-modal planner-popover planner-compact no-print ${docked ? "above-composer" : ""}`}
      role="region"
      aria-labelledby="planner-title"
      aria-describedby="planner-description"
      aria-live="polite"
    >
      <div className="planner-head">
        <div>
          <span>Guided Plan {currentIndex + 1}/{totalSteps}</span>
          <h2 id="planner-title">{currentQuestion?.question || "Narrow this before searching"}</h2>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close planner">Close</button>
      </div>
      <p className="planner-topic" id="planner-description">{currentQuestion?.why || topic || "New research topic"}</p>
      <fieldset className="planner-step-options">
        <legend className="sr-only">{currentQuestion?.question}</legend>
        {currentOptions.map((option) => (
          <label key={option} className={`planner-check ${selected.includes(option) ? "selected" : ""}`}>
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => choose(currentIndex, option)}
            />
            <span>{option}</span>
          </label>
        ))}
        <label className={`planner-check planner-custom ${customValue.trim() ? "selected" : ""}`}>
          <input
            type="checkbox"
            checked={Boolean(customValue.trim())}
            onChange={() => {
              if (customValue.trim()) updateCustom(currentIndex, "");
            }}
            aria-label="Use typed option"
          />
          <input
            type="text"
            value={customValue}
            onChange={(event) => updateCustom(currentIndex, event.target.value)}
            placeholder="Something else..."
          />
        </label>
      </fieldset>
      <div className="planner-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => setStep((current) => Math.max(current - 1, 0))}
          disabled={currentIndex === 0}
        >
          Back
        </button>
        <button type="button" className="planner-next" onClick={nextStep} aria-label={currentIndex < totalSteps - 1 ? "Next planning question" : "Use these answers"}>
          {currentIndex < totalSteps - 1 ? "Next" : "Use"}
          {Icon.arrowRight}
        </button>
        <button type="button" className="secondary planner-skip" onClick={() => onComplete("")}>Skip and send</button>
      </div>
    </section>
  );
}

export default function App() {
  const [sidebarExpanded, setSidebarExpanded] = useState(() => window.matchMedia("(min-width: 861px)").matches);
  const [input, setInput] = useState(() => readStoredText(STORAGE_KEY, initialTopicFromUrl()));
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState(DEFAULT_MODE_ID);
  const [responseStyle, setResponseStyle] = useState(DEFAULT_RESPONSE_STYLE_ID);
  const [subjectFocusId, setSubjectFocusId] = useState(DEFAULT_SUBJECT_FOCUS_ID);
  const [accessScope, setAccessScope] = useState(DEFAULT_ACCESS_SCOPE_ID);
  const [providerStatus, setProviderStatus] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/discovery/status", { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((status) => { if (!controller.signal.aborted) setProviderStatus(status); }).catch(() => {});
    return () => controller.abort();
  }, []);
  const [researchWorkspace, setResearchWorkspace] = useState(() => createResearchWorkspace());
  const [researchWorkspaceOpen, setResearchWorkspaceOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState("trail");
  const [sessions, setSessions] = useState(() => readSessions());
  const [folders, setFolders] = useState(() => readFolders());
  const [activeFolderId, setActiveFolderId] = useState(DEFAULT_FOLDER_ID);
  const [activeSessionId, setActiveSessionId] = useState(() => readStoredText(ACTIVE_SESSION_KEY, ""));
  const [adminOpen, setAdminOpen] = useState(() => new URLSearchParams(window.location.search).has("admin"));
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [plannerDraft, setPlannerDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const studyRef = useRef(null);
  if (!studyRef.current) {
    let storage;
    try { storage = window.sessionStorage; } catch { storage = null; }
    studyRef.current = createSearchMetricsSession({ sessionId: "current-tab", storage });
  }
  const [studyEnabled, setStudyEnabled] = useState(() => studyRef.current.isEnabled());
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const requestRef = useRef(null);
  const workspaceRef = useRef(researchWorkspace);
  workspaceRef.current = researchWorkspace;
  const [storageError, setStorageError] = useState(storageReadFailed());
  const [storageRetry, setStorageRetry] = useState(0);
  const [actionNotice, setActionNotice] = useState("");

  const hasConversation = messages.length > 0;
  const currentRequestIndex = Math.max(0, messages.findLastIndex((message) => message.role === "user"));
  const activeMode = getSearchMode(mode);
  const subjectFocusSeed = useMemo(() => submittedResearchTopicContext(messages), [messages]);
  const effectiveSubjectFocus = useMemo(
    () => resolveSubjectFocus(subjectFocusId, subjectFocusSeed),
    [subjectFocusId, subjectFocusSeed]
  );

  useEffect(() => {
    const written = [
      writeStoredText(STORAGE_KEY, input),
      writeStoredText(SESSIONS_KEY, JSON.stringify(sessions)),
      writeStoredText(FOLDERS_KEY, JSON.stringify(folders.filter((folder) => folder.id !== DEFAULT_FOLDER_ID))),
      activeSessionId ? writeStoredText(ACTIVE_SESSION_KEY, activeSessionId) : removeStoredValue(ACTIVE_SESSION_KEY),
    ];
    setStorageError(written.some((ok) => !ok));
  }, [input, sessions, folders, activeSessionId, storageRetry]);

  useEffect(() => () => requestRef.current?.abort(), []);

  function cancelRequest() {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
  }

  function openWorkspace(tab = "trail") {
    setWorkspaceTab(tab);
    setResearchWorkspaceOpen(true);
  }

  useEffect(() => {
    if (!activeSessionId || messages.length > 0) return;
    const session = sessions.find((item) => item.id === activeSessionId);
    if (!session) {
      setActiveSessionId("");
      removeStoredValue(ACTIVE_SESSION_KEY);
      return;
    }
    setMode(session.mode || DEFAULT_MODE_ID);
    setResponseStyle(session.responseStyle || DEFAULT_RESPONSE_STYLE_ID);
    setSubjectFocusId(session.subjectFocusId || DEFAULT_SUBJECT_FOCUS_ID);
    setAccessScope(getAccessScope(session.accessScope).id);
    setResearchWorkspace(normalizeResearchWorkspace(session.researchWorkspace));
    setActiveFolderId(session.folderId || DEFAULT_FOLDER_ID);
    setMessages(session.messages || []);
  }, []);

  // Scroll only when a new question is asked — not while "Thinking" animates or
  // results stream in, so the page doesn't jump under the reader.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.filter((m) => m.role === "user").length]);

  const updatedResultRef = useRef(null);
  useEffect(() => {
    if (!loading && messages.at(-1)?.isCorrectionResult) {
      updatedResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading, messages]);

  const exportableMessages = useMemo(
    () => messages.filter((m) => m.role === "user" || m.role === "assistant"),
    [messages]
  );

  const handoffPayload = useMemo(
    () => buildHandoffPayload(messages, input, mode, responseStyle, subjectFocusId, researchWorkspace),
    [messages, input, mode, responseStyle, subjectFocusId, researchWorkspace]
  );

  const latestResearchSpec = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant" && message.researchSpec)?.researchSpec || null,
    [messages]
  );

  const latestReleaseId = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant" && message.releaseId)?.releaseId || "",
    [messages]
  );

  const librarianReviewPackets = useMemo(
    () => messages.flatMap((message, index) => {
      const researchSpec = message.researchSpec || message.researchPlan?.researchSpec;
      if (message.role !== "assistant" || !researchSpec) return [];
      return [{
        id: `${researchSpec.planHash || message.researchPlan?.planHash || message.releaseId || "plan"}-${index}`,
        createdAt: message.createdAt || null,
        releaseId: message.releaseId || "",
        researchSpec,
        researchPlan: message.researchPlan || null,
        matchedResources: message.matched || [],
        reply: message.reply || {},
      }];
    }),
    [messages]
  );

  const savedResearchItemKeys = useMemo(
    () => new Set(researchWorkspace.trail.map(researchItemKey).filter(Boolean)),
    [researchWorkspace.trail]
  );

  function saveSession(nextMessages, nextMode = mode, nextResponseStyle = responseStyle, sessionId = activeSessionId, nextSubjectFocusId = subjectFocusId, nextResearchWorkspace = researchWorkspace, nextAccessScope = accessScope) {
    const id = sessionId || crypto.randomUUID();
    if (!activeSessionId || activeSessionId !== id) setActiveSessionId(id);
    setSessions((current) => {
      const existing = current.find((s) => s.id === id);
      const title = nextMessages.find((m) => m.role === "user")?.content?.slice(0, 64) || existing?.title || "New research topic";
      const folderId = existing?.folderId || activeFolderId || DEFAULT_FOLDER_ID;
      const session = {
        id,
        title,
        folderId,
        mode: nextMode,
        responseStyle: nextResponseStyle,
        subjectFocusId: nextSubjectFocusId,
        accessScope: getAccessScope(nextAccessScope).id,
        researchWorkspace: normalizeResearchWorkspace(nextResearchWorkspace),
        messages: nextMessages,
        pinned: Boolean(existing?.pinned),
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      return sortSessions([session, ...current.filter((s) => s.id !== id)]);
    });
    return id;
  }

  function changeSubjectFocus(nextSubjectFocusId) {
    setSubjectFocusId(nextSubjectFocusId);
    if (!activeSessionId) return;
    setSessions((current) =>
      sortSessions(current.map((session) =>
        session.id === activeSessionId
          ? { ...session, subjectFocusId: nextSubjectFocusId, updatedAt: Date.now() }
          : session
      ))
    );
  }

  function changeResearchWorkspace(nextWorkspace) {
    const normalized = normalizeResearchWorkspace(nextWorkspace);
    setResearchWorkspace(normalized);
    workspaceRef.current = normalized;
    if (!activeSessionId) {
      saveSession(messages, mode, responseStyle, undefined, subjectFocusId, normalized);
      return;
    }
    setSessions((current) => sortSessions(current.map((session) =>
      session.id === activeSessionId
        ? { ...session, researchWorkspace: normalized, updatedAt: Date.now() }
        : session
    )));
  }

  function saveResearchItem(item) {
    try {
      changeResearchWorkspace(addResearchItem(workspaceRef.current, item));
      setActionNotice(`Saved “${item.title}” to My sources.`);
    } catch (cause) { setActionNotice(cause.message || "Could not save this source. Export your workspace before trying again."); }
  }

  function saveReadingNotes(item, notes) {
    try {
      changeResearchWorkspace(saveSourceNotes(workspaceRef.current, item, notes));
      setActionNotice(`Reading notes saved for “${item.title}”.`);
      return true;
    } catch (cause) { setActionNotice(cause.message || "Could not save reading notes."); return false; }
  }

  function trackSearch(entry) {
    try { changeResearchWorkspace(addSearchHistoryEntry(workspaceRef.current, entry)); }
    catch (cause) { setActionNotice(cause.message || "Could not save this search to the workspace."); }
  }

  function createFolder(name) {
    const clean = String(name || "").trim();
    if (!clean) return;
    const id = `folder-${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || crypto.randomUUID()}`;
    setFolders((current) => {
      if (current.some((folder) => folder.id === id || folder.name.toLowerCase() === clean.toLowerCase())) return current;
      return [...current, { id, name: clean }];
    });
    setActiveFolderId(id);
  }

  function deleteFolder(folderId) {
    if (!folderId || folderId === DEFAULT_FOLDER_ID) return;
    setFolders((current) => current.filter((folder) => folder.id !== folderId));
    setSessions((current) =>
      sortSessions(current.map((session) =>
        (session.folderId || DEFAULT_FOLDER_ID) === folderId
          ? { ...session, folderId: DEFAULT_FOLDER_ID }
          : session
      ))
    );
    if (activeFolderId === folderId) setActiveFolderId(DEFAULT_FOLDER_ID);
  }

  function togglePinSession(sessionId) {
    setSessions((current) =>
      sortSessions(current.map((session) =>
        session.id === sessionId
          ? { ...session, pinned: !session.pinned, updatedAt: Date.now() }
          : session
      ))
    );
  }

  function deleteSession(sessionId) {
    if (activeSessionId === sessionId) cancelRequest();
    const deletedSession = sessions.find((session) => session.id === sessionId);
    setSessions((current) => current.filter((session) => session.id !== sessionId));
    if (activeSessionId !== sessionId) return;
    const folderId = deletedSession?.folderId || activeFolderId || DEFAULT_FOLDER_ID;
    setActiveFolderId(folderId);
    setActiveSessionId("");
    setMessages([]);
    setInput("");
    setSubjectFocusId(DEFAULT_SUBJECT_FOCUS_ID);
    setAccessScope(DEFAULT_ACCESS_SCOPE_ID);
    setResearchWorkspace(createResearchWorkspace());
    setResearchWorkspaceOpen(false);
    setPlannerDraft(null);
    setError("");
    removeStoredValue(ACTIVE_SESSION_KEY);
  }

  function openSession(id) {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    cancelRequest();
    setActiveSessionId(id);
    setMode(session.mode || DEFAULT_MODE_ID);
    setResponseStyle(session.responseStyle || DEFAULT_RESPONSE_STYLE_ID);
    setSubjectFocusId(session.subjectFocusId || DEFAULT_SUBJECT_FOCUS_ID);
    setAccessScope(getAccessScope(session.accessScope).id);
    setResearchWorkspace(normalizeResearchWorkspace(session.researchWorkspace));
    setActiveFolderId(session.folderId || DEFAULT_FOLDER_ID);
    setMessages(session.messages || []);
    setInput("");
    setError("");
  }

  function startNew(folderId = activeFolderId) {
    cancelRequest();
    const targetFolderId = typeof folderId === "string" && folderId ? folderId : DEFAULT_FOLDER_ID;
    setActiveFolderId(targetFolderId);
    setActiveSessionId("");
    setMessages([]);
    setInput("");
    setMode(DEFAULT_MODE_ID);
    setResponseStyle(DEFAULT_RESPONSE_STYLE_ID);
    setSubjectFocusId(DEFAULT_SUBJECT_FOCUS_ID);
    setAccessScope(DEFAULT_ACCESS_SCOPE_ID);
    setResearchWorkspace(createResearchWorkspace());
    setResearchWorkspaceOpen(false);
    setPlannerDraft(null);
    setError("");
  }

  function openPlanner(topicText = input, questions = []) {
    setFollowupOpen(true);
    const content = String(topicText || input || "").trim();
    if (!content) return;
    setPlannerDraft({ topic: content, questions });
  }

  function closePlanner() {
    setPlannerDraft(null);
  }

  function completePlanner(plannerContext) {
    const topicText = plannerDraft?.topic || input;
    setPlannerDraft(null);
    send(topicText, { skipPlanner: true, plannerContext });
  }

  async function send(text = input, options = {}) {
    const content = String(text || "").trim();
    if (!content || loading) return;
    if (!options.skipPlanner && responseStyle === "plan") {
      setPlannerDraft({ topic: content, questions: options.questions || [] });
      return;
    }

    const searchMetricId = crypto.randomUUID();
    studyRef.current.record("search_started", { searchId: searchMetricId, accessScope });
    setFollowupOpen(false);
    const requestMode = options.modeOverride || options.mode || inferExplicitModeRequest(content, mode);
    const controller = new AbortController();
    controller.signal.addEventListener("abort", () => studyRef.current.record("search_finished", { searchId: searchMetricId, resultCount: 0, status: "cancelled" }), { once: true });
    requestRef.current = controller;
    if (requestMode !== mode) setMode(requestMode);
    const focusText = options.researchSpec?.topic || submittedResearchTopicContext([...messages, { role: "user", content }]);
    const requestFocus = resolveSubjectFocus(subjectFocusId, focusText);
    const requestAssignmentContext = assignmentContext(researchWorkspace.assignment);
    const userMessage = options.plannerContext
      ? { role: "user", content, plannerContext: options.plannerContext }
      : { role: "user", content };
    const isCorrection = Number.isInteger(options.correctionOfIndex) && messages[options.correctionOfIndex]?.role === "assistant";
    if (isCorrection) {
      userMessage.isCorrectionRequest = true;
      userMessage.displayContent = `Updated search: ${(options.correctionChanges || []).map((change) => `${change.label}: ${change.after}`).join("; ") || "corrected search brief"}`;
    }
    userMessage.subjectFocusId = requestFocus.id;
    userMessage.subjectFocusLabel = requestFocus.label;
    userMessage.subjectFocusAuto = subjectFocusId === DEFAULT_SUBJECT_FOCUS_ID;
    if (requestAssignmentContext) userMessage.assignmentContext = requestAssignmentContext;
    const nextMessages = [
      ...messages.map((message, index) => isCorrection && index === options.correctionOfIndex ? { ...message, supersededByCorrection: true } : message),
      userMessage,
    ];
    const sessionId = activeSessionId || crypto.randomUUID();
    saveSession(nextMessages, requestMode, responseStyle, sessionId);
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);
    const assistantCreatedAt = Date.now();
    function presentPayload(finalPayload, guidancePending = false) {
      const assistantMessage = {
        searchMetricId,
        guidancePending,
        guidanceUnavailable: Boolean(finalPayload.guidanceUnavailable),
        role: "assistant",
        content: finalPayload.reply?.message || "",
        reply: finalPayload.reply,
        matched: finalPayload.matchedResources || [],
        searchTools: finalPayload.searchTools || [],
        liveResults: finalPayload.liveResults || [],
        sourceDiscovery: finalPayload.sourceDiscovery || null,
        researchSpec:
          finalPayload.researchSpec ||
          finalPayload.reply?.researchSpec ||
          finalPayload.reply?.research_spec ||
          null,
        releaseId:
          finalPayload.releaseId ||
          finalPayload.release_id ||
          finalPayload.reply?.releaseId ||
          finalPayload.reply?.release_id ||
          "",
        researchPlan:
          finalPayload.researchPlan ||
          finalPayload.plan ||
          finalPayload.planSummary ||
          finalPayload.reply?.research_plan ||
          null,
        createdAt: assistantCreatedAt,
        mode: requestMode,
        responseStyle,
        subjectFocusId: requestFocus.id,
        subjectFocusLabel: requestFocus.label,
        subjectFocusAuto: subjectFocusId === DEFAULT_SUBJECT_FOCUS_ID,
        accessScope,
        ...(isCorrection ? { isCorrectionResult: true, correctionChanges: options.correctionChanges || [] } : {}),
      };
      const finished = [...nextMessages, assistantMessage];
      setMessages(finished);
      saveSession(finished, requestMode, responseStyle, sessionId, subjectFocusId, workspaceRef.current);
    }

    try {
      const requestPayload = {
        mode: requestMode,
        accessScope,
        responseStyle,
        subjectFocusId,
        assignmentContext: requestAssignmentContext,
        plannerContext: options.plannerContext || "",
        ...((options.previousResearchSpec || latestResearchSpec) ? { previousResearchSpec: options.previousResearchSpec || latestResearchSpec } : {}),
        ...(options.researchSpec ? { researchSpec: options.researchSpec } : {}),
        messages: nextMessages.map((m) => ({
          role: m.role,
          content: m.role === "assistant"
            ? (m.reply?.message || m.content || "")
            : m.content,
        })),
      };
      const finalPayload = await requestChatReply(requestPayload, {
        signal: controller.signal,
        onSources: (payload) => {
          if (!controller.signal.aborted && requestRef.current === controller) presentPayload(payload, true);
        },
      });
      if (controller.signal.aborted || requestRef.current !== controller) return;
      studyRef.current.record("search_finished", { searchId: searchMetricId, resultCount: (finalPayload.liveResults || []).length, status: searchRunStatus(finalPayload) });
      presentPayload(finalPayload);
    } catch (err) {
      if (controller.signal.aborted || requestRef.current !== controller) return;
      setError("");
      studyRef.current.record("search_finished", { searchId: searchMetricId, resultCount: 0, status: "error" });
      const failureMessage = chatFailureMessage(err);
      const deterministicFallbackPlan = buildResearchPlan(
        focusText,
        5,
        requestFocus.selectedId || requestFocus.id,
        requestMode,
        clientFallbackContext({
          assignmentContext: requestAssignmentContext,
          plannerContext: options.plannerContext || "",
          researchSpec: options.researchSpec,
          previousResearchSpec: options.previousResearchSpec || latestResearchSpec,
          latestUserText: content,
          hasPriorTopic: messages.some((message) => message.role === "user"),
        })
      );
      const fallback = [
        ...nextMessages,
        {
          role: "assistant",
          content: failureMessage,
          reply: {
            message: failureMessage,
            ...(["hybrid", "sources"].includes(responseStyle)
              ? {
                  source_notice: "The AI answer was interrupted. The named database routes and locally generated searches below may or may not be fully relevant; verify every result you open.",
                }
              : {}),
            search_terms: deterministicFallbackPlan.searchTerms || buildSearchTermSuggestions(focusText, [], requestFocus.selectedId || requestFocus.id, 6),
            suggested_followups: ["Try a narrower version", "Find source leads", "Get citation help"],
          },
          matched: deterministicFallbackPlan.recommendations || [],
          searchTools: FALLBACK_SEARCH_TOOLS,
          liveResults: [],
          researchSpec: {
            ...deterministicFallbackPlan.researchSpec,
            planHash: deterministicFallbackPlan.planHash,
            configVersion: deterministicFallbackPlan.configVersion,
          },
          researchPlan: deterministicFallbackPlan,
          mode: requestMode,
          responseStyle,
          subjectFocusId: requestFocus.id,
          subjectFocusLabel: requestFocus.label,
          subjectFocusAuto: subjectFocusId === DEFAULT_SUBJECT_FOCUS_ID,
          ...(isCorrection ? { isCorrectionResult: true, correctionFailed: true, correctionChanges: options.correctionChanges || [] } : {}),
        },
      ];
      setMessages(fallback);
      saveSession(fallback, requestMode, responseStyle, sessionId, subjectFocusId, workspaceRef.current);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  function rerunInterpretation(prompt, options = {}) {
    return send(prompt, {
      skipPlanner: true,
      modeOverride: options.modeOverride || options.mode || mode,
      researchSpec: options.researchSpec,
      correctionOfIndex: options.correctionOfIndex,
      correctionChanges: options.changes,
    });
  }

  // Grow the textarea with its content (capped via CSS max-height) instead of a
  // manual drag handle.
  function autoGrow(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleInputChange(event) {
    setInput(event.target.value);
    autoGrow(event.target);
  }

  // Reset the height once the field is cleared (e.g. after sending).
  useEffect(() => {
    if (input === "" && inputRef.current) inputRef.current.style.height = "auto";
  }, [input]);

  function handleTextareaKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.nativeEvent?.isComposing) {
      return;
    }
    event.preventDefault();
    send();
  }

  async function copyPlan() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(conversationToMarkdown(exportableMessages));
      setActionNotice("Research plan copied.");
    } catch {
      setActionNotice("The plan could not be copied. Use Download plan instead.");
    }
  }

  function downloadPlan() {
    downloadText("zsr-research-plan.md", conversationToMarkdown(exportableMessages));
  }

  async function sharePlan() {
    const url = `${window.location.origin}${window.location.pathname}`;
    try {
      if (navigator.share) await navigator.share({ title: "ZSR Research Navigator", url });
      else {
        if (!navigator.clipboard) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(url);
        setActionNotice("Navigator link copied. Your private research is not included.");
      }
    } catch (error) {
      if (error.name !== "AbortError") setActionNotice("The Navigator link could not be shared. Copy the address from your browser.");
    }
  }

  function closeAdmin() {
    setAdminOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("admin");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function openPlannerFromAssistant(seed, questions = []) {
    openPlanner(seed || submittedResearchTopicContext(messages) || input, questions);
  }

  function renderConversationMessage(message, index) {
    if (message.role === "user") {
      const next = messages[index + 1];
      const shownInSearch = index === currentRequestIndex && next?.role === "assistant";
      const originalTopic = next?.researchSpec?.topic || next?.researchPlan?.researchSpec?.topic;
      if (shownInSearch && (originalTopic === message.content || message.isCorrectionRequest) && !message.assignmentContext && !message.plannerContext) return null;
      const request = <div className="bubble user"><span>Research request</span><p>{message.displayContent || message.content}</p>{message.assignmentContext && <RequestMetaSummary message={{ assignmentContext: message.assignmentContext }} />}<PlannerContextSummary context={message.plannerContext} /></div>;
      return shownInSearch ? <details className="request-context" key={`${message.role}-${index}`}><summary>Request details</summary>{request}</details> : <div key={`${message.role}-${index}`}>{request}</div>;
    }
                  const assistant = (
                    <AssistantMessage
                      key={`${message.role}-${index}`}
                      reply={message.reply}
                      matched={message.matched}
                      searchTools={message.searchTools}
                      liveResults={message.liveResults}
                      sourceDiscovery={message.sourceDiscovery}
                      topic={message.isCorrectionResult ? message.researchSpec?.topic || submittedResearchTopicContext(messages, index) : submittedResearchTopicContext(messages, index)}
                      mode={message.mode || mode}
                      responseStyle={message.responseStyle || responseStyle}
                      subjectFocusId={message.subjectFocusId || messages[index - 1]?.subjectFocusId || effectiveSubjectFocus.id}
                      researchSpec={message.researchSpec || message.reply?.researchSpec || message.reply?.research_spec}
                      researchPlan={message.researchPlan}
                      releaseId={message.releaseId || message.reply?.releaseId || message.reply?.release_id}
                      isFollowup={index > 1 && !message.isCorrectionResult}
                      isLatest={index === messages.length - 1 && !loading}
                      isRefreshing={loading && index === messages.length - 2 && messages.at(-1)?.isCorrectionRequest}
                      onFollowup={send}
                      onRerunInterpretation={index === messages.length - 1 && !loading
                        ? (prompt, options) => rerunInterpretation(prompt, { ...options, correctionOfIndex: index })
                        : null}
                      onOpenPlanner={(questions) => openPlannerFromAssistant(submittedResearchTopicContext(messages, index), questions)}
                      onSaveResearchItem={saveResearchItem}
                      onSaveSourceNotes={saveReadingNotes}
                      onTrackSearch={trackSearch}
                      savedResearchItemKeys={savedResearchItemKeys}
                      savedItems={researchWorkspace.trail}
                      onOpenSavedSources={() => openWorkspace("trail")}
                      studyEnabled={studyEnabled}
                      onSourceEvent={(type, detail) => { if (message.searchMetricId) studyRef.current.record(type, { ...detail, searchId: message.searchMetricId }); }}
                    />
                  );
                  if (message.supersededByCorrection) {
                    return <details className="previous-search-result" key={`${message.role}-${index}`}>
                      <summary>Previous search result — before corrections</summary>
                      {assistant}
                    </details>;
                  }
                  return <div key={`${message.role}-${index}`} ref={message.isCorrectionResult && index === messages.length - 1 ? updatedResultRef : null} className={message.isCorrectionResult ? "updated-search-result" : ""}>
                    {loading && message.guidancePending && <p className="source-guidance-status" role="status"><strong>Search results are ready.</strong> Checking optional abstract passages. You can open and save sources now.</p>}
                    {message.guidanceUnavailable && <p className="source-guidance-status" role="status">Source results were preserved. Optional abstract selection could not finish.</p>}
                    {message.isCorrectionResult && <div className="correction-result-status" role="status">
                      <strong>{message.correctionFailed ? "Search refresh could not complete" : "Search updated"}</strong>
                      <span>{message.correctionFailed
                        ? "The suggestions below are local fallbacks; source leads were not refreshed. Try again when the service is available."
                        : refreshedSourceStatus(message.sourceDiscovery)}</span>
                      {!message.correctionFailed && <details><summary>What changed</summary><p>{(message.correctionChanges || []).map((change) => `${change.label}: ${change.after}`).join("; ") || "Corrected search brief"}. Search terms and database routes were rebuilt. Matching source leads may repeat after a correction.</p></details>}
                    </div>}
                    {assistant}
                  </div>;

  }

  if (adminOpen) {
    return (
      <div className={`zsr-app has-conversation admin-mode ${sidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}>
        <SessionSidebar
          expanded={sidebarExpanded}
          onExpandedChange={setSidebarExpanded}
          sessions={sessions}
          activeId={activeSessionId}
          folders={folders}
          activeFolderId={activeFolderId}
          onFolderChange={setActiveFolderId}
          onCreateFolder={createFolder}
          onDeleteFolder={deleteFolder}
          onOpen={openSession}
          onNew={startNew}
          onTogglePin={togglePinSession}
          onDeleteSession={deleteSession}
        />
        <main className="zsr-main">
          <header className="zsr-hero">
            <div className="hero-bg" aria-hidden="true" />
            <div className="hero-content">
              <p className="prototype-status">Prototype for ZSR Library research workflows</p>
              <h1><span className="title-zsr">ZSR</span> Research Navigator</h1>
              <p>Review pilot readiness, privacy posture, integration status, and librarian handoff demand.</p>
            </div>
          </header>
          <div className="content-wrap">
            <AdminPanel onClose={closeAdmin} reviewPackets={librarianReviewPackets} releaseId={latestReleaseId} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`zsr-app ${hasConversation ? "has-conversation" : ""} ${sidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}>
      <SessionSidebar
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
        sessions={sessions}
        activeId={activeSessionId}
        folders={folders}
        activeFolderId={activeFolderId}
        onFolderChange={setActiveFolderId}
        onCreateFolder={createFolder}
        onDeleteFolder={deleteFolder}
        onOpen={openSession}
        onNew={startNew}
        onTogglePin={togglePinSession}
        onDeleteSession={deleteSession}
      />

      <a className="skip-link" href="#research-main">Skip to research</a>
      <main className="zsr-main" id="research-main" tabIndex={-1}>
        <header className="zsr-hero">
          <div className="hero-bg" aria-hidden="true" />
          <div className="hero-content">
            <p className="prototype-status">
              Prototype for ZSR Library research workflows
            </p>
            <h1><span className="title-zsr">ZSR</span> Research Navigator</h1>
            <p>Find a starting point. Build a search. Keep the sources that matter.</p>
          </div>
        </header>

        <nav className="research-toolbar no-print" aria-label="Research actions">
          <button type="button" onClick={() => openWorkspace("trail")}>{Icon.workspace} My sources <span>{researchWorkspace.trail.filter((item) => item.kind !== "search" && item.kind !== "database").length}</span></button>
          <button type="button" onClick={() => openWorkspace("brief")}>Assignment requirements</button>
          <a href={LIBRARY_LINKS.zsrAsk} target="_blank" rel="noopener noreferrer">Ask a librarian</a>
          <details className="research-export-menu">
            <summary>Export &amp; share</summary>
            <div>
              <button type="button" onClick={copyPlan} disabled={!hasConversation}>Copy research plan</button>
              <button type="button" onClick={downloadPlan} disabled={!hasConversation}>Download plan</button>
              <button type="button" onClick={() => window.print()} disabled={!hasConversation}>Print plan</button>
              <button type="button" onClick={() => setHandoffOpen(true)} disabled={!handoffPayload.topic}>Prepare librarian handoff</button>
              <button type="button" onClick={sharePlan}>Share Navigator link</button>
              <p>Share Navigator sends the app link. Export your plan or My sources to share your research.</p>
              <LocalStudyPanel enabled={studyEnabled} onToggle={(enabled) => { enabled ? studyRef.current.start() : studyRef.current.stop(); setStudyEnabled(enabled); setActionNotice(enabled ? "Local review recording is on. Run a search, then mark a checked source useful." : "Local review recording stopped."); }} onExport={() => downloadText("zsr-usability-session.json", studyRef.current.exportJson())} onClear={() => { studyRef.current.clear(); setStudyEnabled(false); setActionNotice("Local review session cleared."); }} />
            </div>
          </details>
        </nav>
        {storageError && <div className="storage-warning" role="alert">
          <strong>Your latest changes could not be saved in this browser.</strong>
          <p>Keep this tab open and export My sources before reloading. If stored data could not be read, retrying will replace it with the research currently visible here.</p>
          <button type="button" onClick={() => openWorkspace("review")}>Export My sources</button>
          <button type="button" onClick={() => { allowStorageRetry(); setStorageRetry((value) => value + 1); }}>Retry saving</button>
        </div>}
        <div className="action-status no-print" role="status" aria-live="polite">{actionNotice}</div>
        <div className="content-wrap">
          {!hasConversation ? (
            <section className="start-panel">
              <div className="start-intro">
                <h2>What are you researching?</h2>
                <p>Start with a topic or research question. No setup is required; you can change the source type later.</p>
                <ol className="start-steps" aria-label="How this works">
                  <li><strong>1</strong><span>Enter your topic</span></li>
                  <li><strong>2</strong><span>Check and edit the search</span></li>
                  <li><strong>3</strong><span>Open and verify sources</span></li>
                </ol>
              </div>
              <form
                className="topic-card"
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <PlannerModal
                  open={Boolean(plannerDraft)}
                  topic={plannerDraft?.topic || ""}
                  modeLabel={getSearchMode(mode).label}
                  providedQuestions={plannerDraft?.questions || []}
                  onClose={closePlanner}
                  onComplete={completePlanner}
                />
                <label className="sr-only" htmlFor="topic-input">Research topic</label>
                <div className="topic-input-row">
                  <textarea
                    id="topic-input"
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="e.g. Renewable energy policy in the EU..."
                    rows={1}
                  />
                  <button type="submit" disabled={!input.trim() || loading} aria-label="Send topic">Start research {Icon.arrowRight}</button>
                </div>
                <div className="try-prompts" aria-label="Quick start prompts">
                  <span>Try an example:</span>
                  {TRY_PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => setInput(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </form>
              <p className="entry-privacy">Your request goes to an AI service. Avoid personal or sensitive information. Saved research stays in this browser.</p>
              <details className="search-options">
                <summary>Optional search settings <span>{activeMode.shortLabel} · {getAccessScope(accessScope).label}</span></summary>
                <ModeSelector providerStatus={providerStatus} value={mode} onChange={setMode} accessScope={accessScope} onAccessScopeChange={setAccessScope} responseStyle={responseStyle} onResponseStyleChange={setResponseStyle} />
                <SubjectFocusControl value={subjectFocusId} detectedFocus={effectiveSubjectFocus} onChange={changeSubjectFocus} />
              </details>
            </section>
          ) : (
            <>
              <details className="search-options conversation-options">
                <summary>Search preferences <span>{activeMode.shortLabel} · {getAccessScope(accessScope).label}</span></summary>
                <ModeSelector providerStatus={providerStatus} value={mode} onChange={setMode} accessScope={accessScope} onAccessScopeChange={setAccessScope} responseStyle={responseStyle} onResponseStyleChange={setResponseStyle} compact />
                <SubjectFocusControl value={subjectFocusId} detectedFocus={effectiveSubjectFocus} onChange={changeSubjectFocus} />
              </details>
              <section className="conversation" aria-label="Research results" aria-busy={loading}>
                {messages.slice(currentRequestIndex).map((message, index) => renderConversationMessage(message, index + currentRequestIndex))}
                {currentRequestIndex > 0 && <details className="previous-conversation"><summary>Previous searches and replies</summary>{messages.slice(0, currentRequestIndex).map((message, index) => renderConversationMessage(message, index))}</details>}
                {loading && messages.at(-1)?.isCorrectionRequest && <p className="refresh-request-status" role="status">Refreshing search terms, database routes, and source leads from the corrected brief…</p>}
                {loading && <LoadingBubble />}
                {error && <p className="error-note" role="alert">{error}</p>}
                <div ref={scrollRef} />
              </section>
            </>
          )}
        </div>
      </main>

      {hasConversation && (
        <details className="followup-panel no-print" open={followupOpen || Boolean(plannerDraft)} onToggle={(event) => setFollowupOpen(event.currentTarget.open)}>
        <summary>Ask a follow-up</summary>
        <form
          className="composer-dock no-print"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <PlannerModal
            open={Boolean(plannerDraft)}
            topic={plannerDraft?.topic || ""}
            modeLabel={getSearchMode(mode).label}
            providedQuestions={plannerDraft?.questions || []}
            docked
            onClose={closePlanner}
            onComplete={completePlanner}
          />
          <label className="sr-only" htmlFor="followup-input">Ask a follow-up or refine your topic</label>

          <textarea
            id="followup-input"
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Ask a follow-up or refine your topic"
            rows={1}
          />
          <button type="submit" disabled={!input.trim() || loading} aria-label="Send follow-up">
            {Icon.arrowUp}
          </button>
        </form>
        </details>
      )}
      <HandoffModal open={handoffOpen} onClose={() => setHandoffOpen(false)} payload={handoffPayload} />
      <ResearchWorkspace
        open={researchWorkspaceOpen}
        workspace={researchWorkspace}
        topic={handoffPayload.topic}
        initialTab={workspaceTab}
        researchSpec={latestResearchSpec}
        onChange={changeResearchWorkspace}
        onClose={() => setResearchWorkspaceOpen(false)}
        onHandoff={() => {
          setResearchWorkspaceOpen(false);
          setHandoffOpen(true);
        }}
      />
    </div>
  );
}
