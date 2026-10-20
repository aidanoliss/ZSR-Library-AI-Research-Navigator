import { useEffect, useRef, useState } from "react";
import { CHAT_SOURCE_LIMIT, chatSourceHasAbstract, chatSourceKey, mergeChatSources, normalizeResearchChatSession, proposedChatSearchQuestion, requestResearchChat, researchChatPayload, safeChatSourceUrl } from "./researchChat.js";
import "./researchChat.css";

const STARTERS = [
  ["Help narrow my question", "Help me develop a narrower research question using the attached sources. Distinguish suggestions from what the evidence establishes."],
  ["Help improve my search", "Using the attached sources, suggest what I should look for next and what remains unanswered."],
  ["Discuss my sources", "What do the attached abstracts say that is relevant to my research question, and what can they not establish?"],
];

function Reply({ reply, onSearch, topic }) {
  return <div className="research-chat-reply">
    {reply.message && <p>{reply.message}</p>}
    {reply.blocks.map((block, index) => <section className="research-chat-evidence" key={`${block.sourceId}-${index}`} aria-label={`Evidence from ${block.source.title}`}>
      <span className="research-chat-basis">AI interpretation · abstract only</span>
      <p>{block.text}</p>
      <a href={safeChatSourceUrl(block.source.url) || undefined} target="_blank" rel="noopener noreferrer">{block.source.title}</a>
      <div className="research-chat-quote"><strong>Supporting passage from the abstract</strong><blockquote>{block.quote}</blockquote></div>
      {onSearch && proposedChatSearchQuestion(block) && <button type="button" className="research-chat-search-next" onClick={() => onSearch(proposedChatSearchQuestion(block))}>Use this question in Search</button>}
    </section>)}
    {reply.notice && <p className="research-chat-notice">{reply.notice}</p>}
    {reply.status === "insufficient_evidence" && onSearch && <button type="button" className="research-chat-search-next" onClick={() => onSearch(topic)}>Find more evidence in Search</button>}
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
  const filtered = available.filter((source) => source.title.toLowerCase().includes(sourceFilter.toLowerCase()));
  const update = (patch) => {
    const next = normalizeResearchChatSession({ ...sessionRef.current, ...patch });
    sessionRef.current = next;
    changeRef.current?.(next);
  };
  useEffect(() => {
    return () => { operation.current?.abort(); operation.current = null; };
  }, [sessionKey]);
  useEffect(() => { if (!busy && normalized.messages.length) lastReplyRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [normalized.messages.length, busy]);
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
    <header className="research-chat-heading"><span className="research-chat-eyebrow">Work with your evidence</span><h2 id="research-chat-heading">Research chat</h2><p>Develop a question, improve a search, or discuss sources Navigator has provided. Answers use only the sources you attach here.</p><p className="research-chat-transmission">Your question and attached excerpts are sent to Gemini. Avoid personal or sensitive information.</p></header>
    <div className="research-chat-context">
      <div className="research-chat-context-heading"><strong>Attached sources <span>{selected.length}/{CHAT_SOURCE_LIMIT}</span></strong><button type="button" aria-expanded={selecting} aria-controls="research-chat-source-picker" onClick={() => setSelecting(!selecting)}>{selecting ? "Done" : selected.length ? "Change sources" : "Choose sources"}</button></div>
      {selected.length > 0 ? <ul className="research-chat-chips" aria-label="Sources attached to this conversation">{selected.map((source) => <li key={chatSourceKey(source)}><div><span>{source.title}</span><small>{chatSourceHasAbstract(source) ? "Abstract available" : "Metadata only"}</small></div><button type="button" onClick={() => toggleSource(source)} aria-label={`Remove ${source.title} from chat`}>×</button></li>)}</ul> : <p className="research-chat-attach-help">Choose sources from your search results or saved collection. Research chat cannot use articles it has not been given.</p>}
      {selected.length > 0 && abstractCount === 0 && <p className="research-chat-attach-help"><strong>These records have metadata only.</strong> Chat can identify the records, but cannot establish their findings without abstract evidence.</p>}
      {selecting && <div id="research-chat-source-picker" className="research-chat-source-picker"><label>Find a Navigator source<input type="search" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} placeholder="Filter by title" /></label>{filtered.length ? <ul>{filtered.map((source) => { const checked = normalized.selectedSourceKeys.includes(chatSourceKey(source)); return <li key={chatSourceKey(source)}><label><input type="checkbox" checked={checked} disabled={!checked && selected.length >= CHAT_SOURCE_LIMIT} onChange={() => toggleSource(source)} /><span>{source.title}<small>{chatSourceHasAbstract(source) ? "Abstract available" : "Metadata only"}</small></span></label></li>; })}</ul> : <p>{available.length ? "No titles match this filter." : "No authenticated Navigator records are available yet. Run a search first."}</p>}<small>Attach up to six sources. The server checks that these records came from Navigator.</small></div>}
      {assignmentContext && <details className="research-chat-brief"><summary>Assignment brief · guidance only</summary><label><input type="checkbox" checked={normalized.includeAssignment} onChange={(event) => update({ includeAssignment: event.target.checked })} /> Include this brief as instructions for the conversation</label><p>{assignmentContext}</p><small>The brief is not source evidence.</small></details>}
      {topic && <p className="research-chat-topic"><strong>Research topic:</strong> {topic}</p>}
    </div>
    {!normalized.messages.length && <div className="research-chat-welcome"><h3>Where would you like to start?</h3><div className="research-chat-starters">{STARTERS.map(([label, prompt]) => <button type="button" key={label} onClick={() => { update({ draft: prompt }); inputRef.current?.focus(); }}>{label}<span aria-hidden="true">↗</span></button>)}</div>{!available.length && <div className="research-chat-empty"><strong>Find sources to start the conversation.</strong><p>Search first, then choose “Discuss this source” on a result or attach sources here. For sources from an earlier visit, run the search again to enable chat.</p>{onSearch && <button type="button" onClick={() => onSearch(topic)}>Go to Search</button>}</div>}</div>}
    <div className="research-chat-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Research chat messages" aria-busy={busy}>{normalized.messages.map((message, index) => message.role === "user" ? <div className="research-chat-user" key={`user-${index}`}><span>You</span><p>{message.content}</p></div> : <Reply key={`assistant-${index}`} reply={message.reply} onSearch={onSearch} topic={topic} />)}{busy && <div className="research-chat-thinking" role="status">Checking the attached source evidence…</div>}<div ref={lastReplyRef} /></div>
    <section className="conversation-composer research-chat-composer no-print" aria-label="Ask Research chat"><div className="composer-caption"><strong>{privateMode ? "Private research chat" : "Research chat"}</strong><span>{selected.length ? `${selected.length} attached ${selected.length === 1 ? "source" : "sources"} · abstracts and metadata only` : "Attach a Navigator source to begin"}</span></div><form className="composer-dock" onSubmit={submit}><label className="sr-only" htmlFor="research-chat-question">Question about attached sources</label><textarea ref={inputRef} id="research-chat-question" rows={2} maxLength={2000} value={normalized.draft} onChange={(event) => update({ draft: event.target.value })} placeholder="What can these sources tell me about my question?" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />{busy ? <button type="button" onClick={cancel} aria-label="Stop Research chat">■</button> : <button type="submit" disabled={!normalized.draft.trim() || !selected.length} aria-label="Send Research chat question">↑</button>}</form>{error && <p className="research-chat-error" role="alert">{error}</p>}<p className="composer-footnote">{privateMode ? "Kept in this private session · clears on reload" : "Saved with this research session"} · AI interpretations can be wrong. Check the quoted evidence.</p></section>
  </section>;
}
