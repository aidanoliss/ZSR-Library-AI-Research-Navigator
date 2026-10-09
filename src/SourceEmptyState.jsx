import { fillTemplate, LIBRARY_LINKS } from "../config/libraryLinks.js";
import { emptySourcePresentation } from "./sourcePresentation.js";

export default function SourceEmptyState({ lanes, recovery, directQuery, researchSpec, externalFilters, pending, onRetry, onShowStrategy, onEditRequirements, onTrackSearch }) {
  const state = emptySourcePresentation(lanes);
  const externalSearches = [
    { label: "Search ZSR", template: researchSpec.mode === "scholarly" ? LIBRARY_LINKS.zsrArticleSearch : LIBRARY_LINKS.zsrPrimoSearch },
    { label: "Search Google Scholar", template: LIBRARY_LINKS.googleScholarSearch },
  ];
  return <section className="source-empty-state source-empty-overview" aria-label="Search outcome">
    <div className="source-empty-intro" role="status"><h3>{state.title}</h3>
      {state.requested.length === 1 ? <p>{state.requested[0].message}</p> : <p>{state.explanation}</p>}
      <p><strong>This does not mean relevant sources don’t exist.</strong></p>
    </div>
    {state.requested.length > 1 && <ul className="source-search-outcomes">{state.requested.map((lane) => <li key={lane.label}><strong>{lane.label}</strong><span>{lane.message}</span></li>)}</ul>}
    <div className="source-recovery-plan">
      <strong className="source-next-step">Try next</strong>
      {state.retryable && onRetry && <div><button type="button" className="source-recovery-button" disabled={pending} onClick={() => onRetry({ kind: "retry", query: directQuery, researchSpec, changes: ["Retry the same search; no requirements change."] })}>{pending ? "Searching…" : "Retry source search"}</button><p className="source-action-hint">Keeps your topic and requirements unchanged.</p></div>}
      {!state.retryable && recovery?.kind === "broaden" && onRetry && <div><p>{recovery.explanation}</p><button type="button" className="source-recovery-button" disabled={pending} onClick={() => onRetry(recovery)}>{pending ? "Searching…" : recovery.buttonLabel || "Search with more synonyms"}</button><p className="source-action-hint">Your required concepts and assignment filters stay in place.</p></div>}
      <div className="source-empty-actions">
        {onShowStrategy && <button type="button" className={!state.retryable && recovery?.kind !== "broaden" ? "source-recovery-button" : ""} disabled={pending} onClick={onShowStrategy}>Try different search terms</button>}
        {onEditRequirements && <button type="button" onClick={onEditRequirements}>Review requirements</button>}
      </div>
      {onShowStrategy && <p className="source-action-hint"><strong>Keep the main idea.</strong> Try a synonym or a shorter phrase. Review any date, method, or population limits before choosing to change them.</p>}
    </div>
    <div className="source-empty-alternatives"><strong>Continue your search</strong><div className="source-empty-actions">
      {directQuery && externalSearches.map(({ label, template }) => { const url = fillTemplate(template, directQuery); return <a key={label} href={url} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ query: directQuery, tool: label, url })}>{label}<span aria-hidden="true">↗</span></a>; })}
      <a href={LIBRARY_LINKS.zsrAsk} target="_blank" rel="noopener noreferrer">Ask a ZSR librarian<span aria-hidden="true">↗</span></a>
    </div><p className="source-action-hint">{directQuery ? "Search links carry your topic terms. " : ""}<strong>Apply assignment filters in the search tool.</strong>{externalFilters.length > 0 ? ` ${externalFilters.join(" · ")}.` : ""}</p></div>
    {(recovery?.query || recovery?.preservedRequirements?.length > 0) && <details className="source-recovery-details"><summary>Search details &amp; requirements</summary>{recovery.query && <div className="source-proposed-query"><strong>{recovery.kind === "broaden" ? "Suggested query" : "Topic query"}</strong><code>{recovery.query}</code></div>}{recovery.preservedRequirements?.length > 0 && <p className="source-preserved-requirements"><strong>Requirements kept:</strong> {recovery.preservedRequirements.join(" · ")}</p>}{recovery.changes?.length > 0 && <ul>{recovery.changes.map((change) => <li key={change}>{change}</li>)}</ul>}</details>}
  </section>;
}
