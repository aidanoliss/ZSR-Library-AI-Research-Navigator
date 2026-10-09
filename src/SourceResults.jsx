import { useId, useState } from "react";
import { buildAccessLinks, extractDoi, extractPmid, LIBRARY_LINKS } from "../config/libraryLinks.js";
import { researchSpecQuery } from "../config/researchSpec.js";
import { sourceRequirementFilters } from "../config/sourceRequirements.js";
import { buildSearchRecovery } from "../config/searchRecovery.js";
import { assessSourceRequirements, sourcePublicationYear } from "./sourceAssessment.js";
import { researchItemKey } from "./researchWorkspace.js";
import { downloadRis } from "./ris.js";
import { filterSourceResults, paginateSourceLanes, shortSourceExcerpt, sourceAuthors, sourceJournal, sourceResultLanes, sourceTypeKey, sourceTypeLabel, sourceTypeOptions } from "./sourceResultView.js";
import SourceReadingGuide from "./SourceReadingGuide.jsx";
import SourceThumbnail from "./SourceThumbnail.jsx";
import SourceEmptyState from "./SourceEmptyState.jsx";
import { SOURCE_OUTCOME_MESSAGES as OUTCOME_MESSAGES, RETRY_SOURCE_OUTCOMES as RETRY_OUTCOMES, sourceLaneOutcome } from "./sourcePresentation.js";
import { describeSourceRole, evidenceNotesForSource } from "./sourceLearning.js";
import { evidencePassageContext } from "../config/evidencePassages.js";
import "./sourceResults.css";

const Icons = {
  external: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></svg>,
  save: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z" /></svg>,
  check: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>,
};

function sourceIds(result) {
  const text = [result.doi, result.pmid, result.description, ...(result.detailPoints || [])].filter(Boolean).join(" ");
  return { doi: result.doi || extractDoi(text), pmid: result.pmid || extractPmid(text) };
}

function safeSourceUrl(url) {
  return /^https?:\/\//i.test(String(url || "")) ? url : "";
}

function SourceRow({ result, researchSpec, onSaveResearchItem, onTrackSearch, savedResearchItemKeys, onSourceEvent, studyEnabled = false, evidenceNotes = [], savedItems = [], onSaveSourceNotes }) {
  const [markedUseful, setMarkedUseful] = useState(false);
  const isOpenAccess = result.accessScope === "open-access";
  const ids = sourceIds(result);
  const assessment = result.sourceAssessment || assessSourceRequirements(result, researchSpec);
  const year = sourcePublicationYear(result);
  const journal = sourceJournal(result);
  const metadata = [sourceAuthors(result, true), year || "Year not supplied", journal].filter(Boolean).join(" · ");
  const fit = result.matchExplanation;
  const role = describeSourceRole(result);
  const groundedNotes = evidenceNotesForSource(result, evidenceNotes);
  const sourceUrl = safeSourceUrl(result.fulfillment?.recordUrl || (isOpenAccess && (result.openAccess?.landingPageUrl || result.openAccess?.pdfUrl)) || result.url);
  const savedItem = { ...result, sourceRecord: result, sourceAssessment: assessment, kind: "catalog", title: result.title, url: result.url, detail: metadata || result.description || "Source metadata lead" };
  const saved = savedResearchItemKeys?.has(researchItemKey(savedItem));
  const savedEntry = savedItems.find((entry) => researchItemKey(entry) === researchItemKey(savedItem));
  const sourceId = result.doi || result.url || researchItemKey(savedItem);
  const openSource = () => {
    onTrackSearch?.({ query: result.title, tool: isOpenAccess ? "Reported open-access location" : result.sourceProvider || "Source record", url: sourceUrl });
    onSourceEvent?.("source_opened", { sourceId });
  };
  const links = [
    ...(safeSourceUrl(result.url) && result.url !== sourceUrl ? [{ label: "Provider record", url: result.url }] : []),
    ...(safeSourceUrl(result.fulfillment?.requestUrl) ? [{ label: result.fulfillment.requestLabel || "Request through ZSR Delivers", url: result.fulfillment.requestUrl }] : []),
    ...(result.accessLinks || []),
    ...buildAccessLinks({ title: result.title, ...ids }),
  ].filter((link, index, all) => safeSourceUrl(link.url) && link.url !== sourceUrl && all.findIndex((item) => item.url === link.url) === index);
  const excerpt = shortSourceExcerpt(result.abstractExcerpt);
  const incompleteChecks = assessment.checks.filter((check) => check.status !== "meets");

  return <li className="source-result-row">
    <div className="source-result-heading"><SourceThumbnail source={result} /><div className="source-result-heading-text"><div className="source-result-kicker">
      <span title={role.basis}>{role.label}{role.inferred ? " · inferred" : ""}</span>
      {fit?.label && <span className={`source-fit-label fit-${fit.category || "background"}`} title="Interpretation based on title and abstract metadata; open the record to confirm.">{fit.label}</span>}
    </div>
    <h4 className="source-result-title">{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" onClick={openSource}>{result.title || "Untitled source"}</a> : result.title || "Untitled source"}</h4>
    <p className="source-result-meta">{metadata}</p></div></div>
    {excerpt ? <p className="source-result-excerpt"><strong className="source-excerpt-label">Provider abstract</strong>{excerpt}</p> : <p className="source-no-abstract">No abstract supplied by the provider.</p>}
    {groundedNotes.length > 0 && <details className="source-evidence-notes"><summary>AI-selected evidence passage <span>Abstract only</span></summary><div>
      <p className="source-evidence-limit"><strong>AI selected this passage from the provider abstract.</strong> Selection does not establish relevance or support for your claim; check the context in the full text. No full text was retrieved.</p>
      {groundedNotes.map((note, index) => <div className="source-evidence-note" key={index}><blockquote><span>Provider abstract passage</span>{note.quote}</blockquote><p><strong>Surrounding abstract context:</strong> {evidencePassageContext(result.evidenceExcerpt, note.quote)}</p></div>)}
    </div></details>}
    {result.fulfillment && <p className="source-book-location"><strong>{result.fulfillment.statusLabel || "Check availability"}</strong>{result.fulfillment.location && <span>{result.fulfillment.location}</span>}{result.fulfillment.callNumber && <span>Call number: {result.fulfillment.callNumber}</span>}</p>}
    {incompleteChecks.length > 0 && <p className="source-check-summary"><strong>{incompleteChecks.some((check) => check.status === "mismatch") ? "Some assignment requirements do not match." : "Some assignment requirements need verification."}</strong> See Details.</p>}
    <div className="source-row-actions">
      {sourceUrl && <a className="source-open-button" href={sourceUrl} target="_blank" rel="noopener noreferrer" onClick={openSource}>Open source {Icons.external}</a>}
      {onSaveResearchItem && <button type="button" className={`source-action-button ${saved ? "is-saved" : ""}`} disabled={saved} onClick={() => { onSaveResearchItem(savedItem); onSourceEvent?.("source_saved", { sourceId }); }} aria-label={`${saved ? "Saved" : "Save"} ${result.title || "source"}`}>{saved ? Icons.check : Icons.save}{saved ? "Saved" : "Save"}</button>}
      <button type="button" className="source-action-button" onClick={() => { if (downloadRis([result], { filename: result.title || "research-source" })) onSourceEvent?.("exported", { sourceId }); }} aria-label={`Download RIS citation for ${result.title || "this source"}`} title="Download citation (.ris)">Cite</button>
    </div>
    {studyEnabled && <button type="button" className="source-study-useful" disabled={markedUseful} onClick={() => { setMarkedUseful(true); onSourceEvent?.("source_marked_useful", { sourceId }); }}>{markedUseful ? "Marked useful" : "Useful for my question"}</button>}
    <SourceReadingGuide source={result} savedItem={savedItem} savedEntry={savedEntry} onSaveSourceNotes={onSaveSourceNotes} onTrackSearch={onTrackSearch} />
    <details className="source-record-details"><summary>Details <span>Metadata, requirements & access</span></summary><div className="source-record-details-body">
      <dl className="source-metadata-list">
        <div><dt>Source role</dt><dd>{role.basis}</dd></div>
        <div><dt>Provider</dt><dd>{(result.metadataSources || []).length ? result.metadataSources.join("; ") : result.sourceProvider || "Not recorded"}</dd></div>
        {sourceAuthors(result) && <div><dt>Authors</dt><dd>{sourceAuthors(result)}</dd></div>}
        {journal && <div><dt>Publication</dt><dd>{journal}</dd></div>}
        {result.publisher && <div><dt>Publisher</dt><dd>{result.publisher}</dd></div>}
        {[['volume', 'Volume'], ['issue', 'Issue'], ['pages', 'Pages'], ['isbn', 'ISBN'], ['issn', 'ISSN']].filter(([key]) => result[key]).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{Array.isArray(result[key]) ? result[key].join('; ') : result[key]}</dd></div>)}
        {ids.doi && <div><dt>DOI</dt><dd>{ids.doi}</dd></div>}
        {ids.pmid && <div><dt>PMID</dt><dd>{ids.pmid}</dd></div>}
        <div><dt>Published</dt><dd>{year || "Not supplied"}</dd></div>
      </dl>
      {fit?.explanation && <div className="source-fit-details"><strong>Why this appeared</strong><p>{fit.explanation}</p>{fit.evidence?.length > 0 && <ul>{fit.evidence.map((evidence, index) => <li key={index}>{evidence.field === "title" ? "Title" : evidence.field === "abstract" ? "Abstract" : evidence.field || "Metadata"} contains “{evidence.term}”{evidence.concept && evidence.concept !== evidence.term ? ` (${evidence.concept})` : ""}.</li>)}</ul>}<p className="source-evidence-limit">Topic fit is an automated interpretation of metadata, not confirmation that the work answers your question.</p></div>}
      {assessment.checks.length > 0 && <div className="source-requirements"><strong>Assignment requirements</strong><ul>{assessment.checks.map((check) => <li key={check.id}><span className={`source-check-status ${check.status}`}>{check.status === "meets" ? "Matches metadata" : check.status === "mismatch" ? "Does not match" : "Needs checking"}</span><span><strong>{check.label}</strong> — {check.detail}</span></li>)}</ul></div>}
      {(result.abstractText || result.abstractExcerpt) && <div className="source-full-abstract"><strong>Provider-supplied abstract{!result.abstractText || result.abstractTruncated ? " excerpt" : ""}</strong><p>{result.abstractText || result.abstractExcerpt}</p><small>{result.abstractSource || result.sourceProvider || "Provider metadata"} · not AI-generated. No full article text was retrieved.</small></div>}
      {(isOpenAccess || result.openAccess || result.accessLinks?.some((link) => link.accessScope === "open-access")) && <p>OpenAlex reports an open-access location{result.openAccess?.version ? ` (${result.openAccess.version})` : ""}.{result.openAccess?.license ? ` Reported license: ${result.openAccess.license}.` : " No reuse license was supplied."} Confirm access, version, and reuse terms in the linked record.</p>}
      {!isOpenAccess && <p>Metadata does not confirm Wake Forest access. Check availability through ZSR.</p>}
      <p>Cite downloads provider metadata as an RIS file for Zotero and other citation managers. Verify missing fields and formatting with the <a href={LIBRARY_LINKS.zsrCitationGuide} target="_blank" rel="noopener noreferrer">ZSR citation guide</a>.</p>
      {result.fulfillment && <p>Availability can change. Confirm the location in ZSR before visiting or requesting.</p>}
      {links.length > 0 && <div className="source-secondary-links" aria-label="Additional access options">{links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ query: result.title, tool: link.label, url: link.url })}>{link.label}{Icons.external}</a>)}</div>}
    </div></details>
  </li>;
}

export default function SourceResults({ liveResults = [], sourceDiscovery = null, researchSpec = {}, compact = false, followup = false, onSaveResearchItem, onTrackSearch, savedResearchItemKeys, onRerunInterpretation, onShowStrategy, onEditRequirements, onSourceEvent, studyEnabled = false, evidenceNotes = [], evidenceNotice = "", savedItems = [], onSaveSourceNotes }) {
  const filterId = useId();
  const [filters, setFilters] = useState({ type: "all", from: "", to: "", sort: "relevance" });
  const [retryPending, setRetryPending] = useState(false);
  const [retryError, setRetryError] = useState("");
  const lanes = sourceResultLanes(liveResults, sourceDiscovery);
  const allResults = lanes.flatMap((lane) => lane.results);
  const shownCount = filterSourceResults(allResults, filters).length;
  const localFiltersApplied = filters.type !== "all" || Boolean(filters.from || filters.to);
  const invalidYears = Boolean((filters.from && !/^\d{4}$/.test(filters.from)) || (filters.to && !/^\d{4}$/.test(filters.to)) || (filters.from && filters.to && Number(filters.from) > Number(filters.to)));
  const unknownYears = allResults.filter((result) => sourcePublicationYear(result) === null).length;
  const directQuery = researchSpecQuery(researchSpec) || researchSpec.topic || "";
  const externalFilters = [researchSpec.sourceContract?.label ? `Source type: ${researchSpec.sourceContract.label}` : "", ...sourceRequirementFilters(researchSpec.sourceRequirements)].filter(Boolean);
  const outcomes = { library: sourceDiscovery?.lanes?.library?.attempts || [], openAccess: sourceDiscovery?.lanes?.openAccess?.attempts || [] };
  const recovery = sourceDiscovery?.recovery || buildSearchRecovery(researchSpec, { outcomes, resultCount: allResults.length });
  const resetFilters = () => setFilters({ type: "all", from: "", to: "", sort: filters.sort });
  const retry = async (suggestion) => {
    if (!onRerunInterpretation || retryPending) return;
    setRetryPending(true);
    setRetryError("");
    try { await onRerunInterpretation(suggestion.query || directQuery, { mode: suggestion.researchSpec?.mode || researchSpec.mode, researchSpec: suggestion.researchSpec || researchSpec, changes: (suggestion.changes || []).map((change) => typeof change === "string" ? { label: suggestion.kind === "retry" ? "Search retry" : "Search expansion", after: change } : change) }); }
    catch { setRetryError("The search could not restart. Try again or use a direct search link below."); }
    finally { setRetryPending(false); }
  };
  if (!allResults.length && !lanes.some((lane) => lane.status?.requested)) return null;

  return <div className={`source-results-workspace ${compact ? "is-compact" : ""} ${followup ? "is-followup" : ""}`}>
    {sourceDiscovery?.identity && sourceDiscovery.identity.status !== "matched" && <p className="source-identity-notice" role="status">{sourceDiscovery.identity.explanation || "The requested work has not been matched to its title and author."} Check the author and publication before using a related work in place of the original.</p>}
    {allResults.length > 0 && <div className="source-results-toolbar">
      <div className="source-results-summary"><strong>{shownCount} {shownCount === 1 ? "lead" : "leads"}{localFiltersApplied ? ` of ${allResults.length}` : ""}</strong><span>Filter only the retrieved leads below.</span></div>
      <label className="source-sort-label" htmlFor={`${filterId}-sort`}>Sort<select id={`${filterId}-sort`} value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="relevance">Relevance</option><option value="newest">Newest first</option></select></label>
      <details className="source-local-filters"><summary>Filter leads{localFiltersApplied ? " · active" : ""}</summary><div className="source-filter-fields">
        <label htmlFor={`${filterId}-type`}>Source type<select id={`${filterId}-type`} value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="all">All retrieved types</option>{sourceTypeOptions(allResults).map((type) => <option key={type} value={type}>{sourceTypeLabel(type)}</option>)}</select></label>
        <label htmlFor={`${filterId}-from`}>Year from<input id={`${filterId}-from`} inputMode="numeric" maxLength={4} placeholder="Any year" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value.replace(/\D/g, "") })} /></label>
        <label htmlFor={`${filterId}-to`}>Year to<input id={`${filterId}-to`} inputMode="numeric" maxLength={4} placeholder="Any year" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value.replace(/\D/g, "") })} /></label>
        <button type="button" onClick={resetFilters} disabled={!localFiltersApplied}>Clear filters</button>
        <p>These filters do not change your assignment requirements or run a new search.{(filters.from || filters.to) && unknownYears > 0 ? ` ${unknownYears} ${unknownYears === 1 ? "lead has" : "leads have"} no publication year and will be hidden by a valid year filter.` : ""}</p>
        {invalidYears && <p role="status" className="source-filter-error">Enter four-digit years, with the start year no later than the end year.</p>}
      </div></details>
    </div>}
    {allResults.length > 0 && <p className="source-results-trust"><strong>Source records come from providers.</strong> AI guidance can hallucinate claims; topic-fit labels can also be wrong. <strong>Verify claims in the full source.</strong></p>}
    {retryError && <p className="source-provider-status" role="alert">{retryError}</p>}
    {!allResults.length && <SourceEmptyState lanes={lanes} recovery={recovery} directQuery={directQuery} researchSpec={researchSpec} externalFilters={externalFilters} pending={retryPending} onRetry={onRerunInterpretation ? retry : null} onShowStrategy={onShowStrategy} onEditRequirements={onEditRequirements} onTrackSearch={onTrackSearch} />}
    {evidenceNotice && <details className="source-record-details"><summary>About AI guidance &amp; evidence</summary><p className="source-results-trust">{evidenceNotice}</p></details>}
    {allResults.length > 0 && paginateSourceLanes(lanes, filters).map((lane) => {
      if (!lane.results.length && !lane.status?.requested && !lane.mergedResultCount) return null;
      const visible = lane.filteredResults;
      const first = lane.initialResults;
      const more = lane.moreResults;
      const outcome = sourceLaneOutcome(lane.status);
      const failed = RETRY_OUTCOMES.has(outcome);
      if (!lane.results.length && lane.mergedResultCount > 0) return <section className="source-merged-access-note" key={lane.id} aria-label="Open-access matches"><strong>Open-access links included</strong><p>{lane.mergedResultCount} open-access {lane.mergedResultCount === 1 ? "match is" : "matches are"} already included in Library sources. Open Details on those records for access options.{localFiltersApplied ? " Local filters may hide some records." : ""}</p>{OUTCOME_MESSAGES[outcome] && failed && <p>{OUTCOME_MESSAGES[outcome]}</p>}</section>;
      if (!lane.results.length) return <section className="source-merged-access-note" key={lane.id} aria-label={lane.label}><strong>{lane.label}: {failed ? "search incomplete" : "no additional sources"}</strong><p>{OUTCOME_MESSAGES[outcome] || "No results were reported for this collection."}</p>{failed && onRerunInterpretation && <button type="button" className="source-action-button" disabled={retryPending} onClick={() => retry({ kind: "retry", query: directQuery, researchSpec })}>{retryPending ? "Searching…" : "Retry source search"}</button>}</section>;
      return <section className={`source-result-lane ${lane.id}-lane`} key={lane.id} aria-label={lane.label}>
        <div className="source-lane-heading"><div><h3>{lane.label}</h3><span>{lane.id === "open-access" ? "Locations reported as open access; verify version and license." : "ZSR and bibliographic records; check full-text access."}</span></div>{visible.length > 0 && <button type="button" className="source-export-button" onClick={() => { if (downloadRis(visible, { filename: `${lane.id}-source-leads` })) visible.forEach((result) => onSourceEvent?.("exported", { sourceId: result.doi || result.url || researchItemKey(result) })); }}>Export citations</button>}</div>
        {OUTCOME_MESSAGES[outcome] && <p className="source-provider-status" role="status">{OUTCOME_MESSAGES[outcome]}</p>}
        {!visible.length ? <div className="source-empty-state" role="status"><p><strong>No leads match these display filters.</strong> The original search returned {lane.results.length} {lane.results.length === 1 ? "lead" : "leads"} in this group.</p><button type="button" onClick={resetFilters}>Clear filters</button></div> : <>
          {first.length > 0 && <ul className="source-result-list">{first.map((result, index) => <SourceRow key={`${result.doi || result.url || result.title}-${index}`} result={result} researchSpec={researchSpec} onSaveResearchItem={onSaveResearchItem} onTrackSearch={onTrackSearch} savedResearchItemKeys={savedResearchItemKeys} onSourceEvent={onSourceEvent} studyEnabled={studyEnabled} evidenceNotes={evidenceNotes} savedItems={savedItems} onSaveSourceNotes={onSaveSourceNotes} />)}</ul>}
          {more.length > 0 && <details className="source-more-results"><summary>Show {more.length}{first.length ? " more" : ""} {more.length === 1 ? "source" : "sources"}</summary><ul className="source-result-list">{more.map((result, index) => <SourceRow key={`${result.doi || result.url || result.title}-${index + first.length}`} result={result} researchSpec={researchSpec} onSaveResearchItem={onSaveResearchItem} onTrackSearch={onTrackSearch} savedResearchItemKeys={savedResearchItemKeys} onSourceEvent={onSourceEvent} studyEnabled={studyEnabled} evidenceNotes={evidenceNotes} savedItems={savedItems} onSaveSourceNotes={onSaveSourceNotes} />)}</ul></details>}
        </>}
      </section>;
    })}
  </div>;
}
