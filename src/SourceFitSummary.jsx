import { sourceFitSummary } from "./sourceFitFeedback.js";
import "./sourceFitFeedback.css";

/**
 * Surface unresolved checks with the same wording used in source
 * recommendations. Open the details to see the metadata basis.
 */
export default function SourceFitSummary({ assessment }) {
  const fit = sourceFitSummary(assessment);
  const preferences = fit.preferences.filter((check) => check.status !== "meets");
  const jointIssue = fit.joint && fit.joint.status !== "meets";
  if (!fit.attention.length && !preferences.length) return null;
  return <section className={`source-fit-compact ${fit.status}`} aria-label="How this source fits your request">
    <span className="source-fit-compact-label">{fit.status === "mismatch" ? "Doesn't match:" : "Check:"}</span>
    {fit.attention.map((check) => <span key={check.id} className={`source-fit-chip ${check.status}`}>{check.message}</span>)}
    {preferences.map((check) => <span key={check.id} className={`source-fit-chip preference ${check.status}`}>{check.label} (preferred) {check.status === "mismatch" ? "differs" : "not confirmed"}</span>)}
    <details className="source-fit-why"><summary>Why?</summary><div>
      <dl>{[...fit.rows, ...fit.preferences].map((check) => <div key={check.id}><dt>{check.label}</dt><dd><span className={`source-fit-status ${check.status}`}>{check.statusLabel}</span> {check.detail}</dd></div>)}</dl>
      {jointIssue && <p>{fit.joint.detail}</p>}
      <p>{fit.summary}</p>
      <small>Automated checks of provider metadata, not full-text verification.</small>
    </div></details>
  </section>;
}
