import { sourceFitSummary } from "./sourceFitFeedback.js";
import "./sourceFitFeedback.css";

export default function SourceFitSummary({ assessment }) {
  const fit = sourceFitSummary(assessment);
  return <section className="source-fit-summary" aria-label="How this source fits your request">
    <strong>Fit to your request</strong>
    {fit.rows.length > 0 && <dl>{fit.rows.map(check => <div key={check.id}>
      <dt>{check.label}</dt><dd><span className={`source-fit-status ${check.status}`}>{check.statusLabel}</span>
        <details><summary>Check basis</summary><p>{check.detail}</p></details>
      </dd></div>)}</dl>}
    {fit.preferences.length > 0 && <div className="source-fit-preferences"><strong>Preferences · not required</strong><dl>{fit.preferences.map(check => <div key={check.id}><dt>{check.label}</dt><dd><span className={`source-fit-status ${check.status}`}>{check.statusLabel}</span><details><summary>Check basis</summary><p>{check.detail}</p></details></dd></div>)}</dl></div>}
    <p>{fit.summary}</p>
    {fit.joint && fit.joint.status !== "meets" && <p className="source-fit-joint"><strong>Population and location together:</strong> {fit.joint.detail}</p>}
    <small>Automated checks of provider metadata, not full-text verification.</small>
  </section>;
}
