import { useEffect, useMemo, useRef, useState } from "react";
import AssistantMessage from "./AssistantMessage.jsx";
import { conversationToMarkdown, downloadText } from "./exportPlan.js";
import {
  DEFAULT_MODE_ID,
  DEFAULT_RESPONSE_STYLE_ID,
  RESPONSE_STYLES,
  SEARCH_MODES,
  getResponseStyle,
  getSearchMode,
} from "../config/libraryLinks.js";

const STORAGE_KEY = "zsr-research-navigator-draft";
const SESSIONS_KEY = "zsr-research-navigator-sessions";
const ACTIVE_SESSION_KEY = "zsr-research-navigator-active-session";

const INITIAL_TOPIC = "The impact of social media on adolescent mental health";
const TRY_PROMPTS = [
  "The impact of social media on adolescent mental health",
  "Primary sources on the Civil Rights Movement in North Carolina",
  "How does inflation affect small business hiring decisions?",
];

const Icon = {
  plus: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  librarian: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8l8-4 8 4v12" /><path d="M8 20v-7h8v7" /><path d="M9 9h6" /></svg>,
  mail: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>,
  arrowUp: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>,
  copy: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  download: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>,
  print: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5" /><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /></svg>,
  share: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.7 6.8-4.4M8.6 13.3l6.8 4.4" /></svg>,
  send: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7z" /></svg>,
};

function makeSession(messages = [], mode = DEFAULT_MODE_ID, responseStyle = DEFAULT_RESPONSE_STYLE_ID) {
  const firstUser = messages.find((m) => m.role === "user")?.content || "New research topic";
  return {
    id: crypto.randomUUID(),
    title: firstUser.slice(0, 64),
    mode,
    responseStyle,
    messages,
    updatedAt: Date.now(),
  };
}

function readSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

function SessionSidebar({ sessions, activeId, onOpen, onNew }) {
  return (
    <aside className="session-sidebar no-print" aria-label="Research sessions">
      <button type="button" className="new-topic-btn" onClick={onNew}>
        {Icon.plus}
        <span>New topic</span>
      </button>
      <div className="session-list">
        <h2>Sessions</h2>
        {sessions.length === 0 ? (
          <p>No saved sessions yet.</p>
        ) : (
          sessions.map((session) => (
            <button
              type="button"
              key={session.id}
              className={session.id === activeId ? "active" : ""}
              onClick={() => onOpen(session.id)}
            >
              <strong>{session.title}</strong>
              <span>{getSearchMode(session.mode).shortLabel}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

export default function App() {
  const [input, setInput] = useState(() => localStorage.getItem(STORAGE_KEY) || initialTopicFromUrl());
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState(DEFAULT_MODE_ID);
  const [responseStyle, setResponseStyle] = useState(DEFAULT_RESPONSE_STYLE_ID);
  const [sessions, setSessions] = useState(() => readSessions());
  const [activeSessionId, setActiveSessionId] = useState(() => localStorage.getItem(ACTIVE_SESSION_KEY) || "");
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
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 12)));
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
  }, [activeSessionId]);

  // Scroll only when a new question is asked — not while "Thinking" animates or
  // results stream in, so the page doesn't jump under the reader.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.filter((m) => m.role === "user").length]);

  const exportableMessages = useMemo(
    () => messages.filter((m) => m.role === "user" || m.role === "assistant"),
    [messages]
  );

  function saveSession(nextMessages, nextMode = mode, nextResponseStyle = responseStyle) {
    setSessions((current) => {
      const id = activeSessionId || crypto.randomUUID();
      if (!activeSessionId) setActiveSessionId(id);
      const existing = current.find((s) => s.id === id);
      const title = nextMessages.find((m) => m.role === "user")?.content?.slice(0, 64) || existing?.title || "New research topic";
      const session = { id, title, mode: nextMode, responseStyle: nextResponseStyle, messages: nextMessages, updatedAt: Date.now() };
      return [session, ...current.filter((s) => s.id !== id)].slice(0, 12);
    });
  }

  function openSession(id) {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    setActiveSessionId(id);
    setMode(session.mode || DEFAULT_MODE_ID);
    setResponseStyle(session.responseStyle || DEFAULT_RESPONSE_STYLE_ID);
    setMessages(session.messages || []);
    setInput("");
    setError("");
  }

  function startNew() {
    setActiveSessionId("");
    setMessages([]);
    setInput("");
    setMode(DEFAULT_MODE_ID);
    setResponseStyle(DEFAULT_RESPONSE_STYLE_ID);
    setError("");
    setStreamText("");
  }

  async function send(text = input) {
    const content = String(text || "").trim();
    if (!content || loading) return;

    const nextMessages = [...messages, { role: "user", content }];
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
            content: m.role === "assistant" ? (m.reply?.message || m.content || "") : m.content,
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
      saveSession(finished, mode, responseStyle);
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
      saveSession(fallback, mode, responseStyle);
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

  return (
    <div className={`zsr-app ${hasConversation ? "has-conversation" : ""}`}>
      <SessionSidebar sessions={sessions} activeId={activeSessionId} onOpen={openSession} onNew={startNew} />

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
          <button type="button" className="tool-icon" onClick={copyPlan} aria-label="Copy research plan" data-tip="Copy plan">{Icon.copy}</button>
          <button type="button" className="tool-icon" onClick={downloadPlan} aria-label="Download plan" data-tip="Download">{Icon.download}</button>
          <button type="button" className="tool-icon" onClick={() => window.print()} aria-label="Print" data-tip="Print">{Icon.print}</button>
          <button type="button" className="tool-icon" onClick={sharePlan} aria-label="Share" data-tip="Share">{Icon.share}</button>
        </section>

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
                <div className="try-prompts" aria-label="Example research prompts">
                  <span>Try:</span>
                  <div>
                    {TRY_PROMPTS.map((prompt) => (
                      <button key={prompt} type="button" onClick={() => setInput(prompt)}>
                        {prompt}
                      </button>
                    ))}
                  </div>
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
      )}
    </div>
  );
}
