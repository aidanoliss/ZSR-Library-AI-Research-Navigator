import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { ResearchPrivacyContext } from "./researchPrivacy.js";
import { readStoredJSON, writeStoredText } from "./browserStorage.js";
import { createSourceFeedback, feedbackReviewExport, SOURCE_FEEDBACK_REASONS, SOURCE_FEEDBACK_STORAGE_KEY, updateFeedbackQueue, validFeedbackQueue } from "./sourceFitFeedback.js";
import "./sourceFitFeedback.css";

const feedbackChanged = "zsr-source-feedback-changed";
const readQueue = () => readStoredJSON(SOURCE_FEEDBACK_STORAGE_KEY, [], undefined, validFeedbackQueue);

const SourceFeedbackContext = createContext(null);

function useSourceFeedbackState() {
  const privateMode = useContext(ResearchPrivacyContext);
  const [queue, setQueue] = useState(() => privateMode ? [] : readQueue());
  const [storageWarning, setStorageWarning] = useState("");
  const queueRef = useRef(queue);
  useEffect(() => {
    if (privateMode) return;
    const refresh = () => { const next = readQueue(); queueRef.current = next; setQueue(next); };
    window.addEventListener(feedbackChanged, refresh);
    const storageRefresh = event => { if (event.key === SOURCE_FEEDBACK_STORAGE_KEY) refresh(); };
    window.addEventListener("storage", storageRefresh);
    return () => { window.removeEventListener(feedbackChanged, refresh); window.removeEventListener("storage", storageRefresh); };
  }, [privateMode]);
  const update = transform => {
    const current = privateMode ? queueRef.current : storageWarning ? updateFeedbackQueueFromMemory(readQueue(), queueRef.current) : readQueue();
    const next = transform(current);
    queueRef.current = next;
    setQueue(next);
    if (!privateMode) {
      if (writeStoredText(SOURCE_FEEDBACK_STORAGE_KEY, JSON.stringify(next))) { setStorageWarning(""); window.dispatchEvent(new Event(feedbackChanged)); }
      else setStorageWarning("Browser storage is unavailable. Feedback is kept only in this open session; export it before leaving.");
    }
  };
  return { queue, privateMode, storageWarning, save: entry => update(items => updateFeedbackQueue(items, entry)), remove: id => update(items => items.filter(item => item.id !== id)), clear: () => update(() => []) };
}
/** Mount once per privacy session; its keyed parent discards private memory on exit. */
export function SourceFeedbackProvider({ children }) {
  const feedback = useSourceFeedbackState();
  return <SourceFeedbackContext.Provider value={feedback}>{children}</SourceFeedbackContext.Provider>;
}

export function useSourceFeedback() {
  const feedback = useContext(SourceFeedbackContext);
  if (!feedback) throw new Error("Source feedback requires the session feedback provider.");
  return feedback;
}

function updateFeedbackQueueFromMemory(stored, memory) {
  // Preserve unsaved feedback if storage was blocked, without replacing newer entries.
  return memory.reduce((items, item) => items.some(storedItem => storedItem.id === item.id) ? items : updateFeedbackQueue(items, item), stored);
}

export default function SourceFeedback({ source, request, researchSpec, feedback, embedded = false }) {
  const id = useId();
  const key = createSourceFeedback({ source, request, researchSpec, reason: "useful" })?.id;
  const existing = feedback.queue.find(entry => entry.id === key);
  const [reason, setReason] = useState(existing?.reason || "");
  const [note, setNote] = useState(existing?.note || "");
  const [message, setMessage] = useState("");
  const Wrapper = embedded ? "div" : "details";
  return <Wrapper className="source-feedback">
    {!embedded && <summary>Give source feedback{existing ? " · saved" : ""}</summary>}
    <form onSubmit={event => { event.preventDefault(); const entry = createSourceFeedback({ source, request, researchSpec, reason, note }); if (entry) { feedback.save(entry); setMessage(feedback.privateMode ? "Feedback kept for this private session." : "Feedback saved in this browser."); } }}>
      <p>Optional. Record whether this source helps your question. {feedback.privateMode ? "Kept in memory only during this private session." : "Saved in this browser."} Nothing is sent to a server. Export from the feedback review area to share it yourself.</p>
      <label htmlFor={`${id}-reason`}>Your assessment<select id={`${id}-reason`} required value={reason} onChange={event => { setReason(event.target.value); setMessage(""); }}><option value="">Choose a reason</option>{SOURCE_FEEDBACK_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label htmlFor={`${id}-note`}>Note <span>(optional)</span><textarea id={`${id}-note`} value={note} onChange={event => { setNote(event.target.value); setMessage(""); }} maxLength={500} placeholder="For example: this studies schoolchildren, but I need undergraduates." /></label>
      <div className="source-feedback-actions"><button type="submit" disabled={!reason}>{existing ? "Update feedback" : "Save feedback"}</button>{existing && <button type="button" onClick={() => { feedback.remove(existing.id); setReason(""); setNote(""); setMessage("Feedback removed."); }}>Remove feedback</button>}</div>
      {message && <p role="status">{message}</p>}
    </form>
  </Wrapper>;
}

export function SourceFeedbackQueue({ feedback }) {
  const [message, setMessage] = useState("");
  const exportQueue = () => {
    try {
      const blob = new Blob([JSON.stringify(feedbackReviewExport(feedback.queue), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "navigator-source-feedback.json"; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Feedback export downloaded. It has not been sent to anyone.");
    } catch { setMessage("The export could not download. Try again in a browser that allows downloads."); }
  };
  return <details className="source-feedback-review"><summary>Feedback review <span>{feedback.queue.length} saved{feedback.privateMode ? " · private" : ""}</span></summary><div>
    <p>Review your source judgments before sharing them. These are <strong>unreviewed student assessments</strong>, not verified relevance labels. No librarian has been notified.</p>
    {feedback.privateMode && <p>Private feedback disappears when you end the private session or the page reloads. Downloaded files remain on this computer.</p>}
    {feedback.storageWarning && <p role="alert">{feedback.storageWarning}</p>}
    {feedback.queue.length ? <><ul>{feedback.queue.map(entry => <li key={entry.id}><strong>{entry.source.title}</strong><span>{SOURCE_FEEDBACK_REASONS.find(([reason]) => reason === entry.reason)?.[1]}</span><small>Request: {entry.request || "Not recorded"}</small>{entry.note && <p>{entry.note}</p>}<button type="button" onClick={() => feedback.remove(entry.id)} aria-label={`Remove feedback for ${entry.source.title}`}>Remove</button></li>)}</ul>
      <p>The JSON export includes the displayed requests, source titles and links, selected reasons, notes, and recorded search criteria. Share it only if you want a reviewer to receive that information.</p>
      <div className="source-feedback-actions"><button type="button" onClick={exportQueue}>Download feedback for review</button><button type="button" onClick={() => { feedback.clear(); setMessage("Feedback queue cleared."); }}>Clear feedback queue</button></div></> : <p>Use “Give source feedback” on any result to start a review queue.</p>}
    {message && <p role="status">{message}</p>}
  </div></details>;
}
