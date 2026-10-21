import { useEffect, useRef, useState } from "react";
import { CHAT_SOURCE_LIMIT, chatSourceHasAbstract, chatSourceKey, mergeChatSources, normalizeResearchChatSession, proposedChatSearchQuestion, requestResearchChat, researchChatPayload, safeChatSourceUrl } from "./researchChat.js";
import "./researchChat.css";

const STARTERS = [
  ["Plan my essay", "How should I structure my essay?"],
  ["Narrow my question", "Help me develop a narrower research question without assuming the answer."],
  ["Improve my search", "Help me improve my search strategy and find the evidence I still need."],
  ["Discuss the evidence", "What do the attached abstracts say that is relevant to my research question, and what can they not establish?"],
];

function Reply({ reply, onSearch, onPrompt, topic, replyRef }) {
  return <div className="research-chat-reply" ref={replyRef}>
    {reply.mode === "planning" && <span className="research-chat-basis is-planning">Planning guidance · not research findings</span>}
    {reply.message && <p>{reply.message}</p>}
    {reply.guidance?.length > 0 && <div className="research-chat-guidance">{reply.guidance.map((section, index) => <section key={`${section.title}-${index}`}><h3>{section.title}</h3><p>{section.text}</p></section>)}</div>}
    {reply.blocks.map((block, index) => <section className="research-chat-evidence" key={`${block.sourceId}-${index}`} aria-label={`Evidence from ${block.source.title}`}>
      <span className="research-chat-basis">AI interpretation · abstract only</span>
      <p>{block.text}</p>
      <a href={safeChatSourceUrl(block.source.url) || undefined} target="_blank" rel="noopener noreferrer">{block.source.title}</a>
      <div className="research-chat-quote"><strong>Supporting passage from the abstract</strong><blockquote>{block.quote}</blockquote></div>
      {onSearch && proposedChatSearchQuestion(block) && <button type="button" className="research-chat-search-next" onClick={() => onSearch(proposedChatSearchQuestion(block))}>Review this question in Search</button>}
    </section>)}
    {reply.notice && <p className="research-chat-notice">{reply.notice}</p>}
    {!!reply.suggestions?.length && <div className="research-chat-next"><strong>Keep working</strong><div>{reply.suggestions.map((prompt) => <button type="button" key={prompt} onClick={() => onPrompt(prompt)}>{prompt}<span aria-hidden="true">↗</span></button>)}</div></div>}
    {!!reply.searchQuestions?.length && onSearch && <div className="research-chat-next research-chat-searches"><strong>Try in Navigator Search</strong><div>{reply.searchQuestions.map((question) => <button type="button" key={question} onClick={() => onSearch(question)}>{question}<span>Review in Search →</span></button>)}</div></div>}
    {reply.status === "insufficient_evidence" && onSearch && !reply.searchQuestions?.length && <button type="button" className="research-chat-search-next" onClick={() => onSearch(topic)}>Find more evidence in Search</button>}
  </div>;
}

export default function ResearchChat({ session = {}, onSessionChange, sources = [], topic = "", assignmentContext = "", privateMode = false, onSearch, sessionKey = "", requestReply = requestResearchChat }) {
  const normalized = normalizeResearchChatSession(session);
  const sessionRef = useRef(normalized);
  sessionRef.current = normalized;
  const changeRef = useRef(onSessionChange);
  changeRef.current = onSessionChange;
  const operation = useRef(null);
  const lastReplyRef = useRef(null);
  const inputRef = useRef(null);
  const [selecting, setSelecting] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available = mergeChatSources(sources);
  const selected = available.filter((source) => normalized.selectedSourceKeys.includes(chatSourceKey(source)));
  const abstractCount = selected.filter(chatSourceHasAbstract).length;
  const filtered = available.filter((source) => !normalized.selectedSourceKeys.includes(chatSourceKey(source)) && source.title.toLowerCase().includes(sourceFilter.toLowerCase()));
  const update = (patch) => {
    const next = normalizeResearchChatSession({ ...sessionRef.current, ...patch });
    sessionRef.current = next;
    changeRef.current?.(next);
  };
  useEffect(() => {
    return () => { operation.current?.abort(); operation.current = null; };
  }, [sessionKey]);
  useEffect(() => { if (!busy && normalized.messages.length) lastReplyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [normalized.messages.length, busy]);
  function usePrompt(prompt) {
    update({ draft: prompt });
    setError("");
    inputRef.current?.focus();
  }
  function toggleSource(source) {
    const key = chatSourceKey(source);
    const availableKeys = new Set(available.map(chatSourceKey));
    const keys = sessionRef.current.selectedSourceKeys.filter((value) => availableKeys.has(value));
    if (keys.includes(key)) update({ selectedSourceKeys: keys.filter((value) => value !== key) });
    else if (keys.length < CHAT_SOURCE_LIMIT) update({ selectedSourceKeys: [...keys, key] });
  }
  function cancel() {
    operation.current?.abort(); operation.current = null;
    setBusy(false); setError("Reply stopped. Your question is kept below.");
  }
  async function submit(event) {
    event?.preventDefault();
    if (busy) return;
    const before = sessionRef.current;
    let payload;
    try { payload = researchChatPayload({ question: before.draft, session: before, sources: available, topic, assignmentContext }); }
    catch (cause) { setError(cause.message); return; }
    const controller = new AbortController(); operation.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 35000);
    setBusy(true); setError("");
    // Keep the draft until a checked response arrives, so cancellation and retry
    // never discard a student's question or create duplicate unanswered turns.
    try {
      const reply = await requestReply(payload, { signal: controller.signal });
      if (operation.current !== controller || controller.signal.aborted) return;
      update({ messages: [...before.messages, { role: "user", content: payload.question }, { role: "assistant", reply, question: payload.question }], draft: sessionRef.current.draft === before.draft ? "" : sessionRef.current.draft });
    } catch (cause) {
      if (operation.current === controller) setError(controller.signal.reason === "timeout" ? "Research chat took too long. Your question is kept below; try again." : cause.message || "Research chat could not finish. Try again.");
    } finally {
      clearTimeout(timeout);
      if (operation.current === controller) { operation.current = null; setBusy(false); }
    }
  }
  return <section className="research-chat-view" aria-labelledby="research-chat-heading">
    <header className="research-chat-heading"><span className="research-chat-eyebrow">Think through your research</span><h2 id="research-chat-heading">Research chat</h2><p><strong>Plan your essay, refine a question, or build a search.</strong> No sources needed for planning. Claims about research findings use only the Navigator abstracts you attach.</p><p className="research-chat-transmission">Source discussions send your question and attached excerpts to Gemini. Avoid personal or sensitive information.</p></header>
    <div className="research-chat-context">
      <div className="research-chat-context-heading"><div><strong>{selected.length ? `${selected.length} ${selected.length === 1 ? "source" : "sources"} attached` : "Sources are optional for planning"}</strong><p className="research-chat-context-summary">{selected.length ? `${abstractCount} with abstracts${selected.length > abstractCount ? ` · ${selected.length - abstractCount} with citation details only` : ""}` : "Attach sources when you want to discuss findings."}</p></div><button type="button" aria-expanded={selecting} aria-controls="research-chat-source-picker" onClick={() => setSelecting(!selecting)}>{selecting ? "Done" : selected.length ? "Manage sources" : "Attach sources"}</button></div>
      {selected.length > 0 && abstractCount === 0 && <p className="research-chat-attach-help"><strong>No abstract evidence is attached.</strong> We can plan your work, but cannot explain these sources’ findings from their titles.</p>}
      {selecting && <div id="research-chat-source-picker" className="research-chat-source-picker">
        {!!selected.length && <div className="research-chat-selected"><strong>Attached · {selected.length}/{CHAT_SOURCE_LIMIT}</strong><ul className="research-chat-chips" aria-label="Sources attached to this conversation">{selected.map((source) => <li key={chatSourceKey(source)}><div><span>{source.title}</span><small>{chatSourceHasAbstract(source) ? "Abstract available" : "Citation details only · findings unavailable"}</small></div><button type="button" onClick={() => toggleSource(source)} aria-label={`Remove ${source.title} from chat`}>×</button></li>)}</ul></div>}
        <label>Add from Navigator<input type="search" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} placeholder="Search available titles" /></label>
        {filtered.length ? <ul className="research-chat-available" aria-label="Available Navigator sources">{filtered.map((source) => <li key={chatSourceKey(source)}><label><input type="checkbox" checked={false} disabled={selected.length >= CHAT_SOURCE_LIMIT} onChange={() => toggleSource(source)} /><span>{source.title}<small>{chatSourceHasAbstract(source) ? "Abstract available" : "Citation details only · findings unavailable"}</small></span></label></li>)}</ul> : <p className="research-chat-attach-help">{available.length ? sourceFilter ? "No available titles match this filter." : "All available sources are attached." : "No sources available yet. Run a search, then return here to discuss a result."}</p>}
        <small>{selected.length >= CHAT_SOURCE_LIMIT ? "Six sources attached. Remove one to add another." : "Attach up to six sources from your results or saved collection."}</small>
      </div>}
      {assignmentContext && <details className="research-chat-brief"><summary>Assignment brief · guidance only</summary><label><input type="checkbox" checked={normalized.includeAssignment} onChange={(event) => update({ includeAssignment: event.target.checked })} /> Include this brief as instructions for the conversation</label><p>{assignmentContext}</p><small>The brief is not source evidence.</small></details>}
      {topic && <p className="research-chat-topic"><strong>Research topic:</strong> {topic}</p>}
    </div>
    {!normalized.messages.length && <div className="research-chat-welcome"><h3>What would help you move forward?</h3><div className="research-chat-starters">{STARTERS.map(([label, prompt]) => <button type="button" key={label} onClick={() => usePrompt(prompt)}>{label}<span aria-hidden="true">↗</span></button>)}</div>{!available.length && <div className="research-chat-empty"><strong>You can start planning now.</strong><p>For an evidence discussion, search Navigator and choose “Discuss this source” on a result. Sources from an earlier visit may need a fresh search.</p>{onSearch && <button type="button" onClick={() => onSearch(topic)}>Find sources in Search</button>}</div>}</div>}
    <div className="research-chat-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Research chat messages" aria-busy={busy}>{normalized.messages.map((message, index) => message.role === "user" ? <div className="research-chat-user" key={`user-${index}`}><span>You</span><p>{message.content}</p></div> : <Reply key={`assistant-${index}`} reply={message.reply} onSearch={onSearch} onPrompt={usePrompt} topic={topic} replyRef={index === normalized.messages.length - 1 ? lastReplyRef : null} />)}{busy && <div className="research-chat-thinking" role="status">Working on your question…</div>}</div>
    <section className="conversation-composer research-chat-composer no-print" aria-label="Ask Research chat"><div className="composer-caption"><strong>{privateMode ? "Private research chat" : "Research chat"}</strong><span>{selected.length ? `${selected.length} attached ${selected.length === 1 ? "source" : "sources"} · abstracts and metadata only` : "Planning help is available without sources"}</span></div><form className="composer-dock" onSubmit={submit}><label className="sr-only" htmlFor="research-chat-question">Ask for research or planning help</label><textarea ref={inputRef} id="research-chat-question" rows={2} maxLength={2000} value={normalized.draft} onChange={(event) => update({ draft: event.target.value })} placeholder="Ask for an essay outline, a better question, or help with your evidence…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />{busy ? <button type="button" onClick={cancel} aria-label="Stop Research chat">■</button> : <button type="submit" disabled={!normalized.draft.trim()} aria-label="Send Research chat question">↑</button>}</form>{error && <p className="research-chat-error" role="alert">{error}</p>}<p className="composer-footnote">{privateMode ? "Kept in this private session · clears on reload" : "Saved with this research session"} · AI interpretations can be wrong. Check the quoted evidence.</p></section>
  </section>;
}
