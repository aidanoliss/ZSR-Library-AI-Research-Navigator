import { useEffect, useRef, useState } from "react";
import { CHAT_SOURCE_LIMIT, chatSourceHasAbstract, chatSourceIsExpired, chatSourceKey, mergeChatSources, normalizeResearchChatSession, proposedChatSearchQuestion, requestResearchChat, researchChatPayload, researchChatReplyToText, safeChatSourceUrl } from "./researchChat.js";
import { NAVIGATOR_ATTRIBUTION, NAVIGATOR_PROTOTYPE_NOTICE } from "../config/navigatorAttribution.js";
import "./researchChat.css";

const EVIDENCE_STARTER = "What do the attached abstracts say that is relevant to my research question, and what remains uncertain?";
const CHAT_INTENTS = [
  ["planning", "Plan my research"],
  ["evidence", "Discuss attached abstracts"],
];

const STARTERS = [
  ["Not sure where to start", "I'm not sure where to start with my research. Help me choose a first step and ask what you need to know."],
  ["Narrow a topic", "Help me turn my interests into a focused, open research question. Ask me about the scope before assuming the answer."],
  ["Plan an assignment", "Help me plan my research assignment. What do you need to know about its requirements and my progress?"],
  ["Read scholarly work", "How should I approach reading a scholarly article? Help me decide what to look for and check my understanding."],
];

function Reply({ reply, onSearch, onPrompt, topic, replyRef }) {
  const [copyState, setCopyState] = useState("");
  const followsEvidence = reply.mode === "evidence" && reply.blocks.length > 0;
  async function copyReply() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(researchChatReplyToText(reply));
      setCopyState("Response copied with its source details and attribution.");
    } catch { setCopyState("Could not copy. Select the response text and copy it manually."); }
  }
  return <div className="research-chat-reply" ref={replyRef}>
    {reply.mode === "coaching" && <span className="research-chat-basis is-coaching">{reply.coachingOrigin === "fallback" ? "Research planning starter" : "AI research coaching"}</span>}
    {reply.mode === "planning" && <span className="research-chat-basis is-planning">Planning guidance · not research findings</span>}
    {reply.message && <p>{reply.message}</p>}
    {!!reply.coaching?.length && <div className="research-chat-coaching">{reply.coaching.map((part, index) => <div key={`${part.kind}-${index}`}>{part.kind === "explanation" && <small className="research-chat-guide-note">Navigator's research guide note · paraphrased guidance</small>}<p className={part.kind === "question" ? "research-chat-coach-question" : ""}>{part.text}</p></div>)}</div>}
    {!!reply.guideReferences?.length && <details className="research-chat-guide-references"><summary>Research guides for this conversation <span>({reply.guideReferences.length})</span></summary><p>These guides support research methods. They do not establish findings about your topic or verify the AI's interpretation.</p><ul>{reply.guideReferences.map((guide) => <li key={guide.id}><a href={guide.url} target="_blank" rel="noopener noreferrer">{guide.title}<span aria-hidden="true"> ↗</span></a></li>)}</ul></details>}
    {!!reply.supportLinks?.length && <ul className="research-chat-support-links" aria-label="Official ZSR resources">{reply.supportLinks.map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<span aria-hidden="true"> ↗</span></a></li>)}</ul>}
    {reply.guidance?.length > 0 && <div className="research-chat-guidance">{reply.guidance.map((section, index) => <section key={`${section.title}-${index}`}><h3>{section.title}</h3><p>{section.text}</p></section>)}</div>}
    {!!reply.blocks.length && <section className="research-chat-support" aria-label="What the passage supports">
      <h3>What the passage supports</h3>
      {reply.blocks.map((block, index) => <section className="research-chat-evidence" key={`${block.sourceId}-${index}`} aria-label={`Evidence from ${block.source.title}`}>
        {block.presentation === "interpretation" && <>
          <span className="research-chat-basis">Earlier AI interpretation · check against the abstract</span>
          <p>{block.text}</p>
        </>}
        <a href={safeChatSourceUrl(block.source.url) || undefined} target="_blank" rel="noopener noreferrer">{block.source.title}</a>
        <div className="research-chat-quote"><strong>Passage from the abstract</strong><blockquote>{block.quote}</blockquote></div>
        {proposedChatSearchQuestion(block) && <>
          {block.question && <p><strong>Question to explore</strong><br />{block.question}</p>}
          {onSearch && <button type="button" className="research-chat-search-next" onClick={() => onSearch(proposedChatSearchQuestion(block))}>Review this question in Search</button>}
        </>}
      </section>)}
    </section>}
    {reply.limitations && <section className="research-chat-limitations" aria-label="What remains uncertain">
      <h3>What remains uncertain</h3>
      <p>{reply.limitations}</p>
      {reply.blocks.filter((block) => block.limitationQuote).map((block, index) => <div className="research-chat-quote" key={`${block.sourceId}-limit-${index}`}>
        <strong>Limitation reported in the abstract</strong>
        <blockquote>{block.limitationQuote}</blockquote>
        <a href={safeChatSourceUrl(block.source.url) || undefined} target="_blank" rel="noopener noreferrer">{block.source.title}</a>
      </div>)}
    </section>}
    {reply.notice && <p className="research-chat-notice">{reply.notice}</p>}
    {!!reply.suggestions?.length && <div className="research-chat-next">
      <strong>{followsEvidence ? "Explore the evidence" : "Continue planning"}</strong>
      <div>{reply.suggestions.map((prompt) => <button type="button" key={prompt} onClick={() => onPrompt(prompt, followsEvidence ? "evidence" : "planning")}>{prompt}<span aria-hidden="true">↗</span></button>)}</div>
    </div>}
    {!!reply.searchQuestions?.length && onSearch && <div className="research-chat-next research-chat-searches"><strong>Try in Navigator Search</strong><div>{reply.searchQuestions.map((question) => <button type="button" key={question} onClick={() => onSearch(question)}>{question}<span>Review in Search →</span></button>)}</div></div>}
    {reply.status === "insufficient_evidence" && onSearch && !reply.searchQuestions?.length && <button type="button" className="research-chat-search-next" onClick={() => onSearch(topic)}>Find more evidence in Search</button>}
    <footer className="research-chat-response-footer"><p>{NAVIGATOR_ATTRIBUTION}</p><button type="button" onClick={copyReply} className="no-print">Copy response</button>{copyState && <span role="status" className="research-chat-copy-status">{copyState}</span>}</footer>
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
  const sourcePickerButtonRef = useRef(null);
  const [expiredTokens, setExpiredTokens] = useState(() => new Set());
  const [selecting, setSelecting] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available = mergeChatSources(sources);
  const selected = available.filter((source) => normalized.selectedSourceKeys.includes(chatSourceKey(source)));
  const isExpired = (source) => chatSourceIsExpired(source) || expiredTokens.has(source.researchChatToken);
  const expired = selected.filter(isExpired);
  const abstractCount = selected.filter((source) => !isExpired(source) && chatSourceHasAbstract(source)).length;
  const metadataCount = selected.length - expired.length - abstractCount;
  const isEvidence = normalized.intent === "evidence";
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
  function usePrompt(prompt, intent = sessionRef.current.intent) {
    update({ draft: prompt, intent });
    setError("");
    inputRef.current?.focus();
  }
  function chooseIntent(intent) {
    update({ intent });
    setError("");
  }
  function manageSources() {
    setSelecting(true);
    sourcePickerButtonRef.current?.focus();
  }
  function toggleSource(source) {
    const key = chatSourceKey(source);
    const availableKeys = new Set(available.map(chatSourceKey));
    const keys = sessionRef.current.selectedSourceKeys.filter((value) => availableKeys.has(value));
    if (keys.includes(key)) update({ selectedSourceKeys: keys.filter((value) => value !== key) });
    else if (keys.length < CHAT_SOURCE_LIMIT && !isExpired(source)) update({ selectedSourceKeys: [...keys, key] });
    setError("");
  }
  function cancel() {
    operation.current?.abort(); operation.current = null;
    setBusy(false); setError("Reply stopped. Your question is kept below.");
  }
  async function submit(event) {
    event?.preventDefault();
    if (busy) return;
    const before = sessionRef.current;
    if (before.intent === "evidence") {
      const chosen = available.filter((source) => before.selectedSourceKeys.includes(chatSourceKey(source)));
      if (chosen.some(isExpired)) {
        setError("Remove or refresh expired attachments to send your question.");
        return;
      }
      if (!chosen.some(chatSourceHasAbstract)) {
        setError("Attach a source with an abstract to discuss its findings.");
        return;
      }
    }
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
      if (reply.status === "attachments_need_refresh") {
        const expiredIds = new Set(reply.expiredSourceIds);
        setExpiredTokens((prior) => new Set([...prior, ...selected
          .filter((source) => expiredIds.has(chatSourceKey(source)))
          .map((source) => source.researchChatToken)]));
        setError(reply.message);
        return;
      }
      update({ messages: [...before.messages, { role: "user", content: payload.question }, { role: "assistant", reply, question: payload.question }], draft: sessionRef.current.draft === before.draft ? "" : sessionRef.current.draft });
    } catch (cause) {
      if (operation.current === controller) setError(controller.signal.reason === "timeout" ? "Research chat took too long. Your question is kept below; try again." : cause.message || "Research chat could not finish. Try again.");
    } finally {
      clearTimeout(timeout);
      if (operation.current === controller) { operation.current = null; setBusy(false); }
    }
  }
  return <section className="research-chat-view" aria-labelledby="research-chat-heading">
    <header className="research-chat-heading">
      <h2 id="research-chat-heading">Research chat</h2>
      <p>Plan a search, develop an assignment, or discuss source abstracts.</p>
      <p className="research-chat-transmission">Questions go to Gemini. Avoid personal or sensitive information.</p>
      <details className="research-chat-transmission">
        <summary>What chat shares</summary>
        <p>Chat sends your question, recent conversation, research topic, and enabled assignment brief. Abstract discussion also sends selected excerpts.</p>
        <p>{NAVIGATOR_PROTOTYPE_NOTICE}</p>
      </details>
    </header>
    <div className="research-chat-context">
      <div className="research-chat-context-heading">
        <div>
          <strong>{selected.length ? `${selected.length} ${selected.length === 1 ? "source" : "sources"} attached` : "Sources for abstract discussion"}</strong>
          <p className="research-chat-context-summary">
            {selected.length ? [
              `${abstractCount} usable ${abstractCount === 1 ? "abstract" : "abstracts"}`,
              metadataCount ? `${metadataCount} citation only` : "",
              expired.length ? `${expired.length} expired` : "",
            ].filter(Boolean).join(" · ") : "You can plan research without attaching sources."}
          </p>
        </div>
        <button type="button" ref={sourcePickerButtonRef} aria-expanded={selecting} aria-controls="research-chat-source-picker" onClick={() => setSelecting(!selecting)}>
          {selecting ? "Done" : selected.length ? "Manage sources" : "Attach sources"}
        </button>
      </div>
      {isEvidence && expired.length > 0 && <div className="research-chat-expired" aria-label="Expired attachments">
        <p><strong>Expired attachments</strong> Remove these records or find them again in Search. Your question stays here.</p>
        <ul>{expired.map((source) => <li key={chatSourceKey(source)}>
          <span>{source.title}</span>
          <div>
            <button type="button" onClick={() => toggleSource(source)} aria-label={`Remove ${source.title} from chat`}>Remove</button>
            {onSearch && <button type="button" onClick={() => onSearch(
              source.title.length <= 300 ? `Find the ${source.type === "book" ? "book" : "article"} titled “${source.title}”` : source.title
            )}>Find this source again</button>}
          </div>
        </li>)}</ul>
      </div>}
      {isEvidence && selected.length > 0 && !expired.length && abstractCount === 0 && <p className="research-chat-attach-help">These records have citation details. Attach an abstract to discuss findings.</p>}
      {selecting && <div id="research-chat-source-picker" className="research-chat-source-picker">
        {!!selected.length && <div className="research-chat-selected">
          <strong>Attached · {selected.length}/{CHAT_SOURCE_LIMIT}</strong>
          <ul className="research-chat-chips" aria-label="Sources attached to this conversation">
            {selected.map((source) => <li key={chatSourceKey(source)}>
              <div><span>{source.title}</span><small>{isExpired(source) ? "Expired · needs a fresh search" : chatSourceHasAbstract(source) ? "Abstract available" : "Citation details only"}</small></div>
              {(!isEvidence || !isExpired(source)) && <button type="button" onClick={() => toggleSource(source)} aria-label={`Remove ${source.title} from chat`}>×</button>}
            </li>)}
          </ul>
        </div>}
        <label>Add from Navigator<input type="search" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} placeholder="Search available titles" /></label>
        {filtered.length ? <ul className="research-chat-available" aria-label="Available Navigator sources">
          {filtered.map((source) => <li key={chatSourceKey(source)}>
            <label>
              <input type="checkbox" checked={false} disabled={selected.length >= CHAT_SOURCE_LIMIT || isExpired(source)} onChange={() => toggleSource(source)} />
              <span>{source.title}<small>{isExpired(source) ? "Expired · needs a fresh search" : chatSourceHasAbstract(source) ? "Abstract available" : "Citation details only"}</small></span>
            </label>
          </li>)}
        </ul> : <p className="research-chat-attach-help">{available.length ? sourceFilter ? "No available titles match this filter." : "All available sources are attached." : "Run a search to find records with abstracts."}</p>}
        <small>{selected.length >= CHAT_SOURCE_LIMIT ? "Six sources attached. Remove one to add another." : "Attach up to six sources from your results or saved collection."}</small>
      </div>}
      {assignmentContext && <details className="research-chat-brief"><summary>Assignment brief · guidance only</summary><label><input type="checkbox" checked={normalized.includeAssignment} onChange={(event) => update({ includeAssignment: event.target.checked })} /> Include this brief as instructions for the conversation</label><p>{assignmentContext}</p><small>The brief is not source evidence.</small></details>}
      {topic && <p className="research-chat-topic"><strong>Research topic:</strong> {topic}</p>}
    </div>
    {!normalized.messages.length && <div className="research-chat-welcome">
      <h3>{isEvidence ? "Start with the evidence" : "What would help you move forward?"}</h3>
      <div className="research-chat-starters">
        {isEvidence
          ? <button type="button" onClick={() => usePrompt(EVIDENCE_STARTER, "evidence")}>What do these abstracts support?<span aria-hidden="true">↗</span></button>
          : STARTERS.map(([label, prompt]) => <button type="button" key={label} onClick={() => usePrompt(prompt, "planning")}>{label}<span aria-hidden="true">↗</span></button>)}
      </div>
    </div>}
    <div className="research-chat-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Research chat messages" aria-busy={busy}>{normalized.messages.map((message, index) => message.role === "user" ? <div className="research-chat-user" key={`user-${index}`}><span>You</span><p>{message.content}</p></div> : <Reply key={`assistant-${index}`} reply={message.reply} onSearch={onSearch} onPrompt={usePrompt} topic={topic} replyRef={index === normalized.messages.length - 1 ? lastReplyRef : null} />)}{busy && <div className="research-chat-thinking" role="status">Working on your question…</div>}</div>
    <section className="conversation-composer research-chat-composer no-print" aria-label="Ask Research chat">
      <div className="research-chat-intent" role="group" aria-label="Research chat activity">
        {CHAT_INTENTS.map(([intent, label]) => <button type="button" key={intent} aria-pressed={normalized.intent === intent} disabled={busy} onClick={() => chooseIntent(intent)}>{label}</button>)}
      </div>
      <div className="composer-caption" id="research-chat-composer-help">
        {isEvidence
          ? <><span>{abstractCount ? `${abstractCount} attached ${abstractCount === 1 ? "abstract" : "abstracts"}` : "Attach an abstract to discuss findings."}</span>
            {(!!expired.length || !abstractCount) && <button type="button" className="research-chat-manage-inline" onClick={manageSources}>{expired.length ? "Review expired sources" : "Attach sources"}</button>}</>
          : <span>Ask for help with a topic, assignment, or search.</span>}
      </div>
      <form className="composer-dock" onSubmit={submit}>
        <label className="sr-only" htmlFor="research-chat-question">{isEvidence ? "Ask about attached abstracts" : "Ask for research planning help"}</label>
        <textarea ref={inputRef} id="research-chat-question" aria-describedby="research-chat-composer-help" rows={2} maxLength={2000} value={normalized.draft}
          onChange={(event) => update({ draft: event.target.value })}
          placeholder={isEvidence ? "What do you want to check in these abstracts?" : "Tell me what you're researching or where you're stuck…"}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }}
        />
        {busy ? <button type="button" onClick={cancel} aria-label="Stop Research chat">■</button>
          : <button type="submit" disabled={!normalized.draft.trim() || (isEvidence && (!abstractCount || expired.length > 0))} aria-label="Send Research chat question">↑</button>}
      </form>
      {error && <p className="research-chat-error" role="alert">{error}</p>}
      <p className="composer-footnote">{privateMode ? "Private session · clears on reload" : "Saved with this research session"} · Check AI guidance against the source.</p>
    </section>
  </section>;
}
