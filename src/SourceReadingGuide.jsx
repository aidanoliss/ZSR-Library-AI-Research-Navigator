import { useEffect, useId, useState } from "react";
import { fillTemplate, LIBRARY_LINKS } from "../config/libraryLinks.js";
import { describeSourceRole, readingSteps } from "./sourceLearning.js";

export default function SourceReadingGuide({ source, savedItem, savedEntry, onSaveSourceNotes, onTrackSearch }) {
  const id = useId();
  const [notes, setNotes] = useState(savedEntry?.notes || "");
  const [notice, setNotice] = useState("");
  useEffect(() => { setNotes(savedEntry?.notes || ""); }, [savedEntry?.notes]);
  const role = describeSourceRole(source);
  const scholarUrl = fillTemplate(LIBRARY_LINKS.googleScholarSearch, `"${source.title || ""}"`);
  return <details className="source-reading-guide">
    <summary>Read &amp; evaluate <span>Make your own judgment</span></summary>
    <div className="source-reading-body">
      <p><strong>{role.label}.</strong> {role.basis}</p>
      <ol>{readingSteps(source).map((step) => <li key={step}>{step}</li>)}</ol>
      <a href={scholarUrl} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ query: source.title, tool: "Google Scholar citation trail", url: scholarUrl })}>Find this title in Google Scholar →</a>
      <p className="source-evidence-limit">Use “Cited by” on a matching record. Continue in ZSR and a subject database to reach research beyond open access; these leads are a starting point, not a comprehensive literature search.</p>
      {onSaveSourceNotes && <form onSubmit={(event) => { event.preventDefault(); const success = onSaveSourceNotes(savedItem, notes); setNotice(success === false ? "Could not save. Check the workspace notice and try again." : "Notes saved in My sources on this browser."); }}>
        <label htmlFor={`${id}-notes`}>Your reading notes</label>
        <textarea id={`${id}-notes`} rows={4} maxLength={4000} value={notes} placeholder="Claim I can support…\nPassage + page/section…\nLimits, disagreements, or next source…" onChange={(event) => { setNotes(event.target.value); setNotice(""); }} />
        <div><button type="submit" className="source-action-button" disabled={!notes.trim() && !savedEntry?.notes}>Save notes{savedEntry ? "" : " & source"}</button><span role="status">{notice}</span></div>
        <small>Your notes are saved locally; they are not included in AI requests.</small>
      </form>}
    </div>
  </details>;
}
