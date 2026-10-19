import { sourceFitSummary } from "./sourceFitFeedback.js";
import "./sourceFitFeedback.css";

/**
 * When every checked requirement is supported, the card's fit label already
 * says so; show nothing extra. Otherwise show one line naming only what needs
 * checking, with the basis for each check one click away.
 */
export default function SourceFitSummary({ assessment }) {
  const fit = sourceFitSummary(assessment);
  const attention = fit.rows.filter((check) => check.status !== "meets");
  const preferences = fit.preferences.filter((check) => check.status !== "meets");
  const jointIssue = fit.joint && fit.joint.status !== "meets";
  if (fit.status === "meets" && !preferences.length && !jointIssue) return null;
  if (!fit.rows.length && !preferences.length && !jointIssue) return null;
  return <section className={`source-fit-compact ${fit.status}`} aria-label="How this source fits your request">
    <span className="source-fit-compact-label">{fit.status === "mismatch" ? "Doesn't match:" : "Check:"}</span>
    {attention.map((check) => <span key={check.id} className={`source-fit-chip ${check.status}`}>{check.label} {check.status === "mismatch" ? "conflicts" : "not confirmed"}</span>)}
    {preferences.map((check) => <span key={check.id} className={`source-fit-chip preference ${check.status}`}>{check.label} (preferred) {check.status === "mismatch" ? "differs" : "not confirmed"}</span>)}
    {jointIssue && <span className="source-fit-chip unverified">Population + location together</span>}
    <details className="source-fit-why"><summary>Why?</summary><div>
      <dl>{[...fit.rows, ...fit.preferences].map((check) => <div key={check.id}><dt>{check.label}</dt><dd><span className={`source-fit-status ${check.status}`}>{check.statusLabel}</span> {check.detail}</dd></div>)}</dl>
      {jointIssue && <p>{fit.joint.detail}</p>}
      <p>{fit.summary}</p>
      <small>Automated checks of provider metadata, not full-text verification.</small>
    </div></details>
  </section>;
}
