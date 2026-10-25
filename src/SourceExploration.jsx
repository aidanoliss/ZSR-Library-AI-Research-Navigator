import { useContext, useEffect, useId, useRef, useState } from "react";
import { ResearchChatContext } from "./researchChatContext.js";
import { researchItemKey } from "./researchWorkspace.js";
import { sourceAuthors, sourceJournal } from "./sourceResultView.js";
import { EXPLORATION_RELATIONSHIPS, explorationExcerpt, explorationStatus, requestSourceExploration, sourceExplorationSeed } from "./sourceExploration.js";
import "./sourceExploration.css";

export default function SourceExploration({ source, researchSpec = {}, accessScope = "both", onSaveResearchItem, onRemoveResearchItem, savedResearchItemKeys, onTrackSearch, requestExploration = requestSourceExploration, embedded = false }) {
  const discussSources = useContext(ResearchChatContext);
  const id = useId();
  const [open, setOpen] = useState(embedded);
  const [relationship, setRelationship] = useState("similar");
  const [response, setResponse] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(5);
  const controller = useRef(null);
  const context = JSON.stringify({ seed: sourceExplorationSeed(source), researchSpec, accessScope });
  useEffect(() => {
    controller.current?.abort(); controller.current = null;
    setResponse(null); setError(""); setBusy(false); setShown(5); setOpen(embedded);
    return () => { controller.current?.abort(); controller.current = null; };
  }, [context, embedded]);
  const search = async (kind) => {
    controller.current?.abort();
    const operation = new AbortController(); controller.current = operation;
    setRelationship(kind); setBusy(true); setError(""); setResponse(null); setShown(5);
    const timeout = setTimeout(() => operation.abort("timeout"), 14000);
    try {
      const data = await requestExploration({ seed: sourceExplorationSeed(source), relationship: kind, researchSpec, accessScope, limit: 10 }, { signal: operation.signal });
      if (controller.current !== operation || operation.signal.aborted) return;
      setResponse(data);
      onTrackSearch?.({ kind: "citation-exploration", query: source.title, tool: `${data.coverage?.provider || "Source exploration"} · ${kind}`, researchSpec, exploration: { seed: sourceExplorationSeed(source), relationship: kind, accessScope, coverage: data.coverage }, outcome: data.status, url: data.seed?.openAlexId || data.seed?.url || "" });
    } catch (failure) {
      if (controller.current === operation) setError(operation.signal.reason === "timeout" ? "Source search took too long. Try again." : operation.signal.aborted ? "Source search cancelled." : failure.message || "Source search could not complete. Try again.");
    } finally {
      clearTimeout(timeout);
      if (controller.current === operation) { controller.current = null; setBusy(false); }
    }
  };
  const toggle = () => {
    if (open) { controller.current?.abort(); setOpen(false); }
    else { setOpen(true); if (!response && !busy) search(relationship); }
  };
  const choices = EXPLORATION_RELATIONSHIPS.find((item) => item.id === relationship);
  const results = response?.results || [];
  const status = explorationStatus(response, relationship);
  const scholar = `https://scholar.google.com/scholar?q=${encodeURIComponent(source.title || "")}`;
  const retryable = Boolean(error || ["timeout", "rate_limited", "cancelled"].includes(response?.status) || (response?.status === "unavailable" && relationship !== "citing"));
  return <div className="source-exploration">
    {!embedded && <button type="button" className="source-exploration-toggle" aria-expanded={open} aria-controls={id} onClick={toggle}>Find more like this <span className="disclosure-chevron" aria-hidden="true" /></button>}
    {open && <section id={id} className="source-exploration-panel" aria-label={`Explore connections to ${source.title}`}>
      {!embedded && <h4 className="source-exploration-heading">Explore this source</h4>}
      {embedded && !response && !busy && !error && <p>Choose a connection below to look up related works. A connection does not establish agreement or support for your claim.</p>}
      <div className="source-exploration-options" role="group" aria-label="Connection type">{EXPLORATION_RELATIONSHIPS.map((item) => <button key={item.id} type="button" aria-pressed={relationship === item.id} onClick={() => search(item.id)}>{item.label}</button>)}</div>
      <p className="source-exploration-description">{choices.help} Your search requirements still apply.</p>
      <div role="status" aria-live="polite" className="source-exploration-status">{busy ? "Finding sources…" : error || <><strong>{status.title}</strong>{status.detail && <p>{status.detail}</p>}</>}</div>
      {busy && <button type="button" className="source-action-button" onClick={() => controller.current?.abort()}>Cancel lookup</button>}
      {!busy && retryable && <button type="button" className="source-action-button" onClick={() => search(relationship)}>Try again</button>}
      {!busy && results.length > 0 && <ul className="source-exploration-results">{results.slice(0, shown).map((result) => {
        const item = { ...result, kind: "catalog", sourceRecord: result, detail: [sourceAuthors(result, true), result.date, sourceJournal(result)].filter(Boolean).join(" · ") };
        const excerpt = explorationExcerpt(result);
        const saved = savedResearchItemKeys?.has(researchItemKey(item));
        const url = /^https:\/\//.test(result.url || "") ? result.url : "";
        return <li key={result.citation?.openAlexId || result.doi || result.url}>
          <span className="source-exploration-kind">{result.type || "Source type not supplied"}</span>
          <h5>{url ? <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ kind: "opened-resource", query: result.title, tool: `${result.exploration?.provider || "Source"} exploration`, url })}>{result.title}</a> : result.title}</h5>
          <p className="source-exploration-meta">{item.detail || "Bibliographic details not supplied"}</p>
          {excerpt && <p className="source-exploration-excerpt"><span>From the abstract</span> {excerpt}</p>}
          {!excerpt && <p className="source-exploration-no-abstract">No abstract supplied. Open the source to learn more.</p>}
          {result.sourceAssessment?.checks?.some((check) => check.status !== "meets") && <details><summary>Requirements to verify</summary><ul>{result.sourceAssessment.checks.filter((check) => check.status !== "meets").map((check) => <li key={check.id}><strong>{check.label}:</strong> {check.detail}</li>)}</ul></details>}
          <div className="source-exploration-actions">{url && <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ kind: "opened-resource", query: result.title, tool: "Related source", url })}>Open source <span aria-hidden="true">↗</span></a>}
          {onSaveResearchItem && <button type="button" className="source-action-button" disabled={saved && !onRemoveResearchItem} onClick={() => saved ? onRemoveResearchItem?.(item) : onSaveResearchItem(item)} aria-label={`${saved ? "Unsave" : "Save"} ${result.title}`}>{saved ? "Unsave" : "Save source"}</button>}{discussSources && result.researchChatToken && <button type="button" className="source-action-button" onClick={() => discussSources([result])}>Discuss this source</button>}</div>
        </li>;
      })}</ul>}
      {!busy && results.length > shown && <button type="button" className="source-action-button" onClick={() => setShown(results.length)}>Show {results.length - shown} more sources</button>}
      {!busy && response?.coverage && <details className="source-exploration-coverage"><summary>How these sources were found</summary><p>{response.message}</p><p><strong>{response.coverage.provider || "Provider"} coverage:</strong> {response.coverage.retrievedCount || 0} records retrieved; {response.coverage.eligibleCount || 0} retained after checks.{response.coverage.excludedCount > 0 ? ` ${response.coverage.excludedCount} excluded or merged.` : ""}{response.coverage.failedLookupCount > 0 ? ` ${response.coverage.failedLookupCount} lookups did not complete.` : ""} {response.coverage.sampled ? `${response.coverage.sampled}. ` : ""}Lookup limit: {response.coverage.candidateLimit || 30} records. Provider coverage is incomplete; these are not all related works.</p></details>}
      <a className="source-exploration-scholar" href={scholar} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ kind: "opened-resource", query: source.title, tool: "Google Scholar title search", url: scholar })}>Search this title in Google Scholar</a>
    </section>}
  </div>;
}
