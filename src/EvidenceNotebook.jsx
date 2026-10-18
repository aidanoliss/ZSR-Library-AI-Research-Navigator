import { useContext, useId, useState } from "react";
import { ResearchPrivacyContext } from "./researchPrivacy.js";
import { addEvidenceEntry, canConfirmEvidence, EVIDENCE_ENTRY_LIMIT, EVIDENCE_FIELD_LIMITS, normalizeEvidenceEntries, updateEvidenceEntry } from "./evidenceNotebook.js";
import "./evidenceNotebook.css";

export default function EvidenceNotebook({ item, onChange }) {
  const privateMode = useContext(ResearchPrivacyContext);
  const baseId = useId();
  const [notice, setNotice] = useState("");
  const [removed, setRemoved] = useState(null);
  const entries = normalizeEvidenceEntries(item.evidenceEntries);
  const checked = entries.filter((entry) => entry.checkedByStudent).length;
  function update(id, patch) {
    const previous = entries.find((entry) => entry.id === id);
    const next = updateEvidenceEntry(entries, id, patch);
    onChange(next);
    if (patch.checkedByStudent === false) setNotice("Marked as needing your check.");
    else if (previous?.checkedByStudent && !next.find((entry) => entry.id === id)?.checkedByStudent) setNotice("The note changed. Check it against the source again before marking it checked.");
    else if (patch.checkedByStudent === true) setNotice("Marked checked by you. Navigator has not verified this claim or passage.");
  }
  return <details className="evidence-notebook">
    <summary>Evidence notebook{entries.length ? ` · ${entries.length} ${entries.length === 1 ? "note" : "notes"}` : ""}</summary>
    <div className="evidence-notebook-content">
      <p>Connect a claim to a passage you have read. <strong>A citation alone does not establish that a claim is supported.</strong></p>
      <small>{privateMode ? "Kept only in this private session." : "Saved in this browser."} Included in workspace and citation exports; not sent to AI.</small>
      {!!entries.length && <p className="evidence-note-count">{checked} of {entries.length} marked checked by you</p>}
      {entries.map((entry, index) => <fieldset key={entry.id} className="evidence-note">
        <legend>Evidence note {index + 1}</legend>
        <span className="evidence-note-status" data-checked={entry.checkedByStudent}>{entry.checkedByStudent ? "Checked by you · not independently verified" : entry.imported ? "Imported · needs your check" : "Needs your check"}</span>
        {[
          ["claim", "Claim I want to make", "State a specific claim; distinguish your interpretation from the author's finding.", 2],
          ["passage", "Exact passage from the source", "Copy a short passage you have read. Do not reconstruct or generate a quotation.", 3],
          ["location", "Page or section", "For example: p. 14, Results, table 2, or Abstract", 1],
          ["limitations", "Limitations or conflicting evidence", "What does this passage leave uncertain? Does another source disagree?", 2],
        ].map(([key, label, placeholder, rows]) => <label key={key} htmlFor={`${baseId}-${entry.id}-${key}`}>{label}
          <textarea id={`${baseId}-${entry.id}-${key}`} rows={rows} maxLength={EVIDENCE_FIELD_LIMITS[key]} value={entry[key]} placeholder={placeholder} onChange={(event) => update(entry.id, { [key]: event.target.value })} />
        </label>)}
        <label className="evidence-confirm"><input type="checkbox" checked={entry.checkedByStudent} disabled={!canConfirmEvidence(entry)} onChange={(event) => update(entry.id, { checkedByStudent: event.target.checked })} />
          <span>I checked the quotation, its location, and surrounding context in the original source.</span>
        </label>
        {!canConfirmEvidence(entry) && <small>Add a claim, passage, and page or section before marking this checked.</small>}
        <button type="button" className="evidence-remove" onClick={() => { setRemoved({ entry, index }); onChange(entries.filter((value) => value.id !== entry.id)); setNotice(`Evidence note ${index + 1} removed.`); }}>Remove evidence note {index + 1}</button>
      </fieldset>)}
      {removed && <div className="evidence-undo"><span>Evidence note removed.</span><button type="button" disabled={entries.length >= EVIDENCE_ENTRY_LIMIT} onClick={() => { const next = [...entries]; next.splice(Math.min(removed.index, next.length), 0, removed.entry); onChange(normalizeEvidenceEntries(next)); setRemoved(null); setNotice("Evidence note restored."); }}>Undo</button></div>}
      <button type="button" className="evidence-add" disabled={entries.length >= EVIDENCE_ENTRY_LIMIT} onClick={() => { onChange(addEvidenceEntry(entries)); setNotice("Evidence note added. Use the fields above to record your reading."); }}>Add evidence note</button>
      {entries.length >= EVIDENCE_ENTRY_LIMIT && <small>Up to {EVIDENCE_ENTRY_LIMIT} evidence notes per source. Export a backup before removing an older note.</small>}
      <p className="evidence-notice" role="status">{notice}</p>
    </div>
  </details>;
}
