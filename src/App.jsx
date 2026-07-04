import { useEffect, useMemo, useRef, useState } from "react";
import AdminPanel from "./AdminPanel.jsx";
import AssistantMessage from "./AssistantMessage.jsx";
import HandoffModal from "./HandoffModal.jsx";
import { conversationToMarkdown, downloadText } from "./exportPlan.js";
import {
  DEFAULT_MODE_ID,
  DEFAULT_RESPONSE_STYLE_ID,
  RESPONSE_STYLES,
  SEARCH_MODES,
  getResponseStyle,
  getSearchMode,
} from "../config/libraryLinks.js";
import { recommendLibrarianRoutes } from "../config/librarianRoutes.js";

const STORAGE_KEY = "zsr-research-navigator-draft";
const SESSIONS_KEY = "zsr-research-navigator-sessions";
const ACTIVE_SESSION_KEY = "zsr-research-navigator-active-session";
const FOLDERS_KEY = "zsr-research-navigator-folders";
const DEFAULT_FOLDER_ID = "general";

const INITIAL_TOPIC = "The impact of social media on adolescent mental health";
const TRY_PROMPTS = [
  "Help me research a topic",
  "Help me with citations",
  "Help me navigate ZSR",
];

const Icon = {
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
  answerSources: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10a2 2 0 0 1 2 2v4" /><path d="M5 4v16h6" /><path d="M8 8h5" /><path d="M8 12h3" /><circle cx="16" cy="16" r="4" /><path d="m19 19 2 2" /></svg>,
  answerFirst: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16" /><path d="M4 10h12" /><path d="M4 15h9" /><path d="M4 20h6" /></svg>,
  plan: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6" /><path d="M9 13h6" /><path d="m8 17 1.5 1.5L12 16" /></svg>,
  sources: <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></svg>,
};

function makeSession(messages = [], mode = DEFAULT_MODE_ID, responseStyle = DEFAULT_RESPONSE_STYLE_ID) {
  const firstUser = messages.find((m) => m.role === "user")?.content || "New research topic";
  return {
    id: crypto.randomUUID(),
    title: firstUser.slice(0, 64),
    mode,
    responseStyle,
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
    const parsed = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
    return Array.isArray(parsed)
      ? sortSessions(parsed.map((session) => ({
        ...session,
        folderId: session.folderId || DEFAULT_FOLDER_ID,
        pinned: Boolean(session.pinned),
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
    const parsed = JSON.parse(localStorage.getItem(FOLDERS_KEY) || "[]");
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
      <span className="typing-text">Thinking<span className="typing-dots" aria-hidden="true">...</span></span>
      <span className="loading-rotate" aria-hidden="true">Checking ZSR context</span>
    </div>
  );
}

function ModeSelector({ value, onChange, responseStyle, onResponseStyleChange, compact = false }) {
  const active = getSearchMode(value);
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
      <div className="response-style" role="radiogroup" aria-label="Response style">
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

const RESPONSE_STYLE_ICONS = {
  hybrid: Icon.answerSources,
  answer: Icon.answerFirst,
  plan: Icon.plan,
  sources: Icon.sources,
};

function ComposerStyleSwitch({ value, onChange }) {
  return (
    <div className="composer-style-switcher" role="radiogroup" aria-label="Response style">
      {RESPONSE_STYLES.map((style) => {
        const active = value === style.id;
        return (
          <button
            key={style.id}
            type="button"
            className={active ? "active" : ""}
            onClick={(event) => {
              onChange(style.id);
              event.currentTarget.blur();
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

function SessionSidebar({ sessions, activeId, folders, activeFolderId, onFolderChange, onCreateFolder, onDeleteFolder, onOpen, onNew, onTogglePin, onDeleteSession }) {
  const [folderName, setFolderName] = useState("");
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
    setFolderName("");
  }

  return (
    <aside className="session-sidebar no-print" aria-label="Research sessions">
      <button type="button" className="new-topic-btn" onClick={() => onNew(activeFolderId || DEFAULT_FOLDER_ID)}>
        {Icon.plus}
        <span>New topic</span>
      </button>
      <div className="folder-list" aria-label="Session folders">
        <h2>Folders</h2>
        {customFolders.length === 0 ? (
          <p className="folder-empty">No folders yet.</p>
        ) : (
          customFolders.map((folder) => {
            const folderSessions = sortSessions(sessions.filter((session) => (session.folderId || DEFAULT_FOLDER_ID) === folder.id));
            return (
              <section
                key={folder.id}
                className={`folder-group ${activeFolderId === folder.id ? "active" : ""}`}
              >
                <div className={`folder-row ${activeFolderId === folder.id ? "active" : ""}`}>
                  <button
                    type="button"
                    className="folder-select"
                    onClick={() => onFolderChange(folder.id)}
                    title="Select this folder for new chats"
                  >
                    {Icon.folder}
                    <span>{folder.name}</span>
                  </button>
                  <button
                    type="button"
                    className="folder-delete"
                    onClick={() => onDeleteFolder(folder.id)}
                    aria-label={`Delete folder ${folder.name}`}
                    title="Delete folder and move chats outside folders"
                  >
                    {Icon.trash}
                  </button>
                </div>
                <div className="folder-session-list" aria-label={`${folder.name} chats`}>
                  <button type="button" className="folder-new-chat" onClick={() => onNew(folder.id)}>
                    {Icon.plus}
                    <span>New chat here</span>
                  </button>
                  {folderSessions.length === 0 ? (
                    <p className="folder-empty small">No chats yet.</p>
                  ) : (
                    folderSessions.map((session) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        activeId={activeId}
                        onOpen={onOpen}
                        onTogglePin={onTogglePin}
                        onDelete={onDeleteSession}
                        className="nested"
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })
        )}
        <form className="folder-create" onSubmit={submitFolder}>
          <label className="sr-only" htmlFor="folder-name">New folder name</label>
          <input
            id="folder-name"
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder="New folder"
          />
          <button type="submit" aria-label="Create folder">{Icon.plus}</button>
        </form>
      </div>
      <div className="session-list">
        <h2>Chats</h2>
        {unfiledSessions.length === 0 ? (
          <p>No chats outside folders yet.</p>
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

function buildHandoffPayload(messages, input, mode, responseStyle) {
  const assistantTurns = messages.filter((message) => message.role === "assistant");
  const topic = messages.find((message) => message.role === "user")?.content || String(input || "").trim();
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
    searchTerms,
    liveResults,
    matchedResources,
    librarianRoutes,
  };
}

function PilotStatus({ status, onOpenAdmin }) {
  if (!status) return null;
  const privacyText = status.privacy.queryLoggingEnabled
    ? "Query logging on"
    : "Query logging off";
  const integrationText = status.integrations.gemini.configured
    ? "AI key configured"
    : "AI key missing";

  return (
    <section className="pilot-status no-print" aria-label="Pilot readiness status">
      <div>
        <strong>Pilot posture</strong>
        <span>{status.resources.count} curated ZSR resources</span>
        <span>{privacyText}</span>
        <span>{integrationText}</span>
      </div>
      <button type="button" onClick={onOpenAdmin}>Review status</button>
    </section>
  );
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
      question: `Which ${modeLabel.toLowerCase()} lens fits best?`,
      why: "Choosing a lens keeps the research question from becoming too broad.",
      options: ["Psychology/behavior", "Communication/media", "Health outcomes", "Policy/social context", "Not sure yet"],
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
    >
      <div className="planner-head">
        <div>
          <span>Guided Plan {currentIndex + 1}/{totalSteps}</span>
          <h2 id="planner-title">{currentQuestion?.question || "Narrow this before searching"}</h2>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close planner">Close</button>
      </div>
      <p className="planner-topic">{currentQuestion?.why || topic || "New research topic"}</p>
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
  const [input, setInput] = useState(() => localStorage.getItem(STORAGE_KEY) || initialTopicFromUrl());
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState(DEFAULT_MODE_ID);
  const [responseStyle, setResponseStyle] = useState(DEFAULT_RESPONSE_STYLE_ID);
  const [sessions, setSessions] = useState(() => readSessions());
  const [folders, setFolders] = useState(() => readFolders());
  const [activeFolderId, setActiveFolderId] = useState(DEFAULT_FOLDER_ID);
  const [activeSessionId, setActiveSessionId] = useState(() => localStorage.getItem(ACTIVE_SESSION_KEY) || "");
  const [pilotStatus, setPilotStatus] = useState(null);
  const [adminOpen, setAdminOpen] = useState(() => new URLSearchParams(window.location.search).has("admin"));
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [plannerDraft, setPlannerDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const hasConversation = messages.length > 0;
  const activeMode = getSearchMode(mode);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, input);
  }, [input]);

  useEffect(() => {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 60)));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders.filter((folder) => folder.id !== DEFAULT_FOLDER_ID)));
  }, [folders]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSessionId || messages.length > 0) return;
    const session = sessions.find((item) => item.id === activeSessionId);
    if (!session) {
      setActiveSessionId("");
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      return;
    }
    setMode(session.mode || DEFAULT_MODE_ID);
    setResponseStyle(session.responseStyle || DEFAULT_RESPONSE_STYLE_ID);
    setActiveFolderId(session.folderId || DEFAULT_FOLDER_ID);
    setMessages(session.messages || []);
    setInput("");
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/pilot/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) setPilotStatus(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Scroll only when a new question is asked — not while "Thinking" animates or
  // results stream in, so the page doesn't jump under the reader.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.filter((m) => m.role === "user").length]);

  const exportableMessages = useMemo(
    () => messages.filter((m) => m.role === "user" || m.role === "assistant"),
    [messages]
  );

  const handoffPayload = useMemo(
    () => buildHandoffPayload(messages, input, mode, responseStyle),
    [messages, input, mode, responseStyle]
  );

  function saveSession(nextMessages, nextMode = mode, nextResponseStyle = responseStyle, sessionId = activeSessionId) {
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
        messages: nextMessages,
        pinned: Boolean(existing?.pinned),
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      return sortSessions([session, ...current.filter((s) => s.id !== id)]).slice(0, 60);
    });
    return id;
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
    const deletedSession = sessions.find((session) => session.id === sessionId);
    setSessions((current) => current.filter((session) => session.id !== sessionId));
    if (activeSessionId !== sessionId) return;
    const folderId = deletedSession?.folderId || activeFolderId || DEFAULT_FOLDER_ID;
    setActiveFolderId(folderId);
    setActiveSessionId("");
    setMessages([]);
    setInput("");
    setPlannerDraft(null);
    setError("");
    setStreamText("");
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }

  function openSession(id) {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    setActiveSessionId(id);
    setMode(session.mode || DEFAULT_MODE_ID);
    setResponseStyle(session.responseStyle || DEFAULT_RESPONSE_STYLE_ID);
    setActiveFolderId(session.folderId || DEFAULT_FOLDER_ID);
    setMessages(session.messages || []);
    setInput("");
    setError("");
  }

  function startNew(folderId = activeFolderId) {
    const targetFolderId = typeof folderId === "string" && folderId ? folderId : DEFAULT_FOLDER_ID;
    setActiveFolderId(targetFolderId);
    setActiveSessionId("");
    setMessages([]);
    setInput("");
    setMode(DEFAULT_MODE_ID);
    setResponseStyle(DEFAULT_RESPONSE_STYLE_ID);
    setPlannerDraft(null);
    setError("");
    setStreamText("");
  }

  function openPlanner(topicText = input, questions = []) {
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

    const userMessage = options.plannerContext
      ? { role: "user", content, plannerContext: options.plannerContext }
      : { role: "user", content };
    const nextMessages = [...messages, userMessage];
    const sessionId = activeSessionId || crypto.randomUUID();
    saveSession(nextMessages, mode, responseStyle, sessionId);
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);
    setStreamText("");

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          responseStyle,
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.role === "assistant"
              ? (m.reply?.message || m.content || "")
              : (m.plannerContext ? `${m.content}\n\nGuided planner choices sent with this request:\n${m.plannerContext}` : m.content),
          })),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not generate a reply right now.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalPayload = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "delta") setStreamText(event.message || "");
          if (event.type === "done") finalPayload = event;
          if (event.type === "error") throw new Error(event.error || "Could not generate a reply right now.");
        }
      }

      if (!finalPayload) throw new Error("The reply did not finish. Please try again.");
      const assistantMessage = {
        role: "assistant",
        content: finalPayload.reply?.message || "",
        reply: finalPayload.reply,
        matched: finalPayload.matchedResources || [],
        searchTools: finalPayload.searchTools || [],
        liveResults: finalPayload.liveResults || [],
        mode,
        responseStyle,
      };
      const finished = [...nextMessages, assistantMessage];
      setMessages(finished);
      saveSession(finished, mode, responseStyle, sessionId);
    } catch (err) {
      setError(err.message || "Could not generate a reply right now. Please try again.");
      const fallback = [
        ...nextMessages,
        {
          role: "assistant",
          content: "I could not reach the AI service, but you can still search ZSR with the terms below.",
          reply: {
            message: "I could not reach the AI service, but you can still search ZSR with the terms below.",
            search_terms: [
              content,
              `${content} ${activeMode.termSuffixes.slice(0, 2).join(" ")}`,
              `${content} research`,
            ],
            suggested_followups: ["Try a narrower version", "Find source leads", "Get citation help"],
          },
          matched: [],
          searchTools: [],
          liveResults: [],
          mode,
          responseStyle,
        },
      ];
      setMessages(fallback);
      saveSession(fallback, mode, responseStyle, sessionId);
    } finally {
      setLoading(false);
      setStreamText("");
    }
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

  function copyPlan() {
    navigator.clipboard?.writeText(conversationToMarkdown(exportableMessages)).catch(() => {});
  }

  function downloadPlan() {
    downloadText("zsr-research-plan.md", conversationToMarkdown(exportableMessages));
  }

  async function sharePlan() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "ZSR Research Navigator", url }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
  }

  function openAdmin() {
    setAdminOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.set("admin", "1");
    window.history.replaceState(null, "", url);
  }

  function closeAdmin() {
    setAdminOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("admin");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function openPlannerFromAssistant(seed, questions = []) {
    openPlanner(seed || messages.find((message) => message.role === "user")?.content || input, questions);
  }

  if (adminOpen) {
    return (
      <div className="zsr-app has-conversation admin-mode">
        <SessionSidebar
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
            <AdminPanel onClose={closeAdmin} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`zsr-app ${hasConversation ? "has-conversation" : ""}`}>
      <SessionSidebar
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
            <p>Shape a topic into searchable terms, ZSR starting points, live catalog leads, and citation-aware next steps.</p>
          </div>
        </header>

        <section className="top-actions no-print" aria-label="Research actions">
          <a className="tool-icon librarian-icon" href="https://zsr.wfu.edu/ask/" target="_blank" rel="noopener noreferrer" aria-label="Ask a librarian" data-tip="Ask a librarian">
            {Icon.mail}
          </a>
          <button type="button" className="tool-icon" onClick={() => setHandoffOpen(true)} disabled={!handoffPayload.topic} aria-label="Prepare librarian handoff" data-tip="Handoff">{Icon.handoff}</button>
          <button type="button" className="tool-icon" onClick={copyPlan} aria-label="Copy research plan" data-tip="Copy plan">{Icon.copy}</button>
          <button type="button" className="tool-icon" onClick={downloadPlan} aria-label="Download plan" data-tip="Download">{Icon.download}</button>
          <button type="button" className="tool-icon" onClick={() => window.print()} aria-label="Print" data-tip="Print">{Icon.print}</button>
          <button type="button" className="tool-icon" onClick={sharePlan} aria-label="Share" data-tip="Share">{Icon.share}</button>
        </section>
        <PilotStatus status={pilotStatus} onOpenAdmin={openAdmin} />

        <div className="content-wrap">
          {!hasConversation ? (
            <section className="start-panel">
              <ModeSelector
                value={mode}
                onChange={setMode}
                responseStyle={responseStyle}
                onResponseStyleChange={setResponseStyle}
              />
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
                  <button type="submit" disabled={!input.trim() || loading} aria-label="Send topic">{Icon.arrowUp}</button>
                </div>
                <div className="try-prompts" aria-label="Quick start prompts">
                  {TRY_PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => setInput(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </form>
            </section>
          ) : (
            <>
              <ModeSelector
                value={mode}
                onChange={setMode}
                responseStyle={responseStyle}
                onResponseStyleChange={setResponseStyle}
                compact
              />
              <section className="conversation" aria-label="Research conversation">
                {messages.map((message, index) => {
                  if (message.role === "user") {
                    return (
                      <div className="bubble user" key={`${message.role}-${index}`}>
                        <span>Research request</span>
                        <p>{message.content}</p>
                        <PlannerContextSummary context={message.plannerContext} />
                      </div>
                    );
                  }
                  return (
                    <AssistantMessage
                      key={`${message.role}-${index}`}
                      reply={message.reply}
                      matched={message.matched}
                      searchTools={message.searchTools}
                      liveResults={message.liveResults}
                      topic={messages[index - 1]?.content || ""}
                      mode={message.mode || mode}
                      responseStyle={message.responseStyle || responseStyle}
                      isFollowup={index > 1}
                      isLatest={index === messages.length - 1 && !loading}
                      onFollowup={send}
                      onOpenPlanner={(questions) => openPlannerFromAssistant(messages[index - 1]?.content || "", questions)}
                    />
                  );
                })}
                {loading && (streamText ? (
                  <div className="bubble assistant loading-bubble">
                    <p>{streamText}</p>
                    <span className="typing-text">Thinking<span className="typing-dots" aria-hidden="true">...</span></span>
                  </div>
                ) : <LoadingBubble />)}
                {error && <p className="error-note" role="alert">{error}</p>}
                <div ref={scrollRef} />
              </section>
            </>
          )}
        </div>
      </main>

      {hasConversation && (
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
          <ComposerStyleSwitch value={responseStyle} onChange={setResponseStyle} />
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
      )}
      <HandoffModal open={handoffOpen} onClose={() => setHandoffOpen(false)} payload={handoffPayload} />
    </div>
  );
}
