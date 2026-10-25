import { useContext, useId, useState } from "react";
import { ResearchChatContext } from "./researchChatContext.js";
import { buildAccessLinks, extractDoi, extractPmid, fillTemplate, LIBRARY_LINKS } from "../config/libraryLinks.js";
import { researchSpecQuery } from "../config/researchSpec.js";
import { sourceRequirementFilters } from "../config/sourceRequirements.js";
import { buildSearchRecovery } from "../config/searchRecovery.js";
import { assessSourceRequirements, sourcePublicationYear } from "./sourceAssessment.js";
import { researchItemKey } from "./researchWorkspace.js";
import CitationExport from "./CitationExport.jsx";
import SourceDetailsDialog from "./SourceDetailsDialog.jsx";
import { filterSourceResults, paginateSourceLanes, shortSourceExcerpt, sourceAuthors, sourceJournal, sourceResultLanes, sourceTypeKey, sourceTypeLabel, sourceTypeOptions } from "./sourceResultView.js";
import SourceReadingGuide from "./SourceReadingGuide.jsx";
import SourceFitSummary from "./SourceFitSummary.jsx";
import SourceExploration from "./SourceExploration.jsx";
import SourceFeedback, { SourceFeedbackQueue, useSourceFeedback } from "./SourceFeedback.jsx";
import SourceThumbnail from "./SourceThumbnail.jsx";
import SourceEmptyState from "./SourceEmptyState.jsx";
import { SOURCE_OUTCOME_MESSAGES as OUTCOME_MESSAGES, RETRY_SOURCE_OUTCOMES as RETRY_OUTCOMES, sourceLaneOutcome } from "./sourcePresentation.js";
import { describeSourceRole, evidenceNotesForSource } from "./sourceLearning.js";
import { evidencePassageContext } from "../config/evidencePassages.js";
import { sourceKey, whereToStart } from "./whereToStart.js";
import "./sourceResults.css";

const Icons = {
  external: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></svg>,
  save: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z" /></svg>,
  check: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>,
};

// Ranking labels stay precise in the data; the card shows plain wording, and
// says nothing when a result simply matches every topic idea.
const FIT_DISPLAY = [
  [/^All topic concepts found$/, ""],
  [/^Requested item/, "Your requested item"],
  [/^Possible requested item/, "Possibly your item · check author"],
  [/^Related work/, "Related work"],
  [/^Comparison indicated · verify design$/, "Compares both"],
  [/^Comparison indicated · scope needs checking$/, "Compares both · check scope"],
  [/^Combined approach/, "Combined approach, not a comparison"],
  [/comparison not established$/, "Comparison not confirmed"],
  [/^Topic match · scope needs checking$/, "Check scope"],
  [/partial topic match$/, "Partial match"],
  [/^Title keywords match/, "Title match only"],
  [/^Mentions an excluded topic/, "Mentions an excluded topic"],
];
function displayFitLabel(label = "") {
  const entry = FIT_DISPLAY.find(([pattern]) => pattern.test(label));
  return entry ? entry[1] : label;
}

function sourceIds(result) {
  const text = [result.doi, result.pmid, result.description, ...(result.detailPoints || [])].filter(Boolean).join(" ");
  return { doi: result.doi || extractDoi(text), pmid: result.pmid || extractPmid(text) };
}

function safeSourceUrl(url) {
  return /^https?:\/\//i.test(String(url || "")) ? url : "";
}

function SourceRow({ feedback, feedbackRequest, explorationAccessScope, result: groupedResult, selectedEdition, onEditionChange, researchSpec, onSaveResearchItem, onRemoveResearchItem, onTrackSearch, savedResearchItemKeys, onSourceEvent, studyEnabled = false, evidenceNotes = [], savedItems = [], onSaveSourceNotes }) {
  const discussSources = useContext(ResearchChatContext);
  const editions = [groupedResult, ...(groupedResult.relatedEditions || [])];
  const editionId = (record) => record?.doi || record?.url || record?.id || record?.title;
  const editionIndex = Math.max(0, editions.findIndex((record) => editionId(record) === editionId(selectedEdition)));
  const result = editions[editionIndex] || groupedResult;
  const [markedUseful, setMarkedUseful] = useState(false);
  const moreId = useId();
  const isOpenAccess = result.accessScope === "open-access";
  const ids = sourceIds(result);
  const assessment = result.sourceAssessment || assessSourceRequirements(result, researchSpec);
  const year = sourcePublicationYear(result);
  const journal = sourceJournal(result);
  const sameAsTitle = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === String(result.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  // A book's "container" is often its own title; repeating it adds nothing.
  const metadata = [sourceAuthors(result, true), year || "Year not supplied", sameAsTitle(journal) ? "" : journal].filter(Boolean).join(" · ");
  const fit = result.matchExplanation;
  const role = describeSourceRole(result);
  const groundedNotes = evidenceNotesForSource(result, evidenceNotes);
  const sourceUrl = safeSourceUrl(result.fulfillment?.recordUrl || (isOpenAccess && (result.openAccess?.landingPageUrl || result.openAccess?.pdfUrl)) || result.url);
  const savedItem = { ...result, sourceRecord: result, sourceAssessment: assessment, kind: "catalog", title: result.title, url: result.url, detail: metadata || result.description || "Source metadata lead" };
  const saved = savedResearchItemKeys?.has(researchItemKey(savedItem));
  const savedEntry = savedItems.find((entry) => researchItemKey(entry) === researchItemKey(savedItem));
  const sourceId = result.doi || result.url || researchItemKey(savedItem);
  const openSource = () => {
    onTrackSearch?.({ kind: "opened-resource", query: result.title, tool: isOpenAccess ? "Reported open-access location" : result.sourceProvider || "Source record", url: sourceUrl });
    onSourceEvent?.("source_opened", { sourceId });
  };
  const links = [
    ...(safeSourceUrl(result.url) && result.url !== sourceUrl ? [{ label: "Provider record", url: result.url }] : []),
    ...(safeSourceUrl(result.fulfillment?.requestUrl) ? [{ label: result.fulfillment.requestLabel || "Request through ZSR Delivers", url: result.fulfillment.requestUrl }] : []),
    ...(result.accessLinks || []),
    ...buildAccessLinks({ title: result.title, ...ids }),
  ].filter((link, index, all) => safeSourceUrl(link.url) && link.url !== sourceUrl && all.findIndex((item) => item.url === link.url) === index);
  const excerpt = shortSourceExcerpt(result.abstractExcerpt);

  return <li className="source-result-row" data-source-key={sourceKey(groupedResult)}>
    {editions.length > 1 && <label className="source-edition-picker">Edition or version
      <select aria-label="Edition or version" value={editionIndex} onChange={(event) => { setMarkedUseful(false); onEditionChange?.(groupedResult, editions[Number(event.target.value)]); }}>
        {editions.map((edition, index) => <option key={edition.doi || edition.url || index} value={index}>{[edition.edition, sourcePublicationYear(edition), edition.doi || edition.isbn || edition.sourceProvider || `Record ${index + 1}`].filter(Boolean).join(" · ")}</option>)}
      </select><small>These may be editions or versions of the same work. Check the selected record. Save and Cite use its own metadata.</small>
    </label>}
    <div className="source-result-heading"><SourceThumbnail source={result} /><div className="source-result-heading-text"><div className="source-result-kicker">
      <span title={role.basis}>{role.label.replace(/ · study type unknown$/, "")}</span>
      {displayFitLabel(fit?.label) && <span className={`source-fit-label fit-${fit.category || "background"}`} title={`${fit.label}. Automated check of title and abstract; open the source to confirm.`}>{displayFitLabel(fit.label)}</span>}
    </div>
    <h4 className="source-result-title">{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" onClick={openSource}>{result.title || "Untitled source"}</a> : result.title || "Untitled source"}</h4>
    <p className="source-result-meta">{metadata}</p></div></div>
    {excerpt ? <p className="source-result-excerpt"><strong className="source-excerpt-label">Abstract</strong>{excerpt}</p> : <p className="source-no-abstract">No abstract available. Open the source to judge fit.</p>}
    {result.fulfillment && <p className="source-book-location"><strong>{result.fulfillment.statusLabel || "Check availability"}</strong>{result.fulfillment.location && <span>{result.fulfillment.location}</span>}{result.fulfillment.callNumber && <span>Call number: {result.fulfillment.callNumber}</span>}</p>}
    <SourceFitSummary assessment={assessment} />
    {result.identityCheck?.status === "title-difference" && <p className="source-check-summary"><strong>Citation details need checking.</strong> This title differs from the DOI registry. Open Source tools → Details before citing.</p>}
    <div className="source-row-actions">
      {sourceUrl && <a className="source-open-button" href={sourceUrl} target="_blank" rel="noopener noreferrer" onClick={openSource} aria-label={`Open ${result.title || "source"}`}>Open {Icons.external}</a>}
      {onSaveResearchItem && <button type="button" className={`source-action-button ${saved ? "is-saved" : ""}`} disabled={saved && !onRemoveResearchItem} onClick={() => { if (saved) onRemoveResearchItem?.(savedItem); else { onSaveResearchItem(savedItem); onSourceEvent?.("source_saved", { sourceId }); } }} aria-label={`${saved ? "Unsave" : "Save"} ${result.title || "source"}`}>{saved ? Icons.check : Icons.save}{saved ? "Unsave" : "Save"}</button>}
      <CitationExport sources={[result]} filename={result.title || "research-source"} description={`Cite ${result.title || "this source"}`} onExport={() => onSourceEvent?.("exported", { sourceId })} />
      {discussSources && <button type="button" className="source-action-button" disabled={!result.researchChatToken} title={!result.researchChatToken ? "Run this search again to make its source evidence available to chat." : "Discuss only this source’s available metadata and abstract."} onClick={() => discussSources([result])}>Discuss this source</button>}
      <SourceDetailsDialog id={moreId} title={result.title} metadata={metadata}>{{
        details: <div className="source-record-details-body">
    {groundedNotes.length > 0 && <section className="source-evidence-notes"><strong>AI-selected evidence passage · abstract only</strong><div>
      <p className="source-evidence-limit"><strong>AI selected this passage from the provider abstract.</strong> Selection does not establish relevance or support for your claim; check the context in the full text. No full text was retrieved.</p>
      {groundedNotes.map((note, index) => <div className="source-evidence-note" key={index}><blockquote><span>Provider abstract passage</span>{note.quote}</blockquote><p><strong>Surrounding abstract context:</strong> {evidencePassageContext(result.evidenceExcerpt, note.quote)}</p></div>)}
    </div></section>}
        <dl className="source-metadata-list">
          <div><dt>Source role</dt><dd>{role.basis}</dd></div>
          <div><dt>Provider</dt><dd>{(result.metadataSources || []).length ? result.metadataSources.join("; ") : result.sourceProvider || "Not recorded"}</dd></div>
          {sourceAuthors(result) && <div><dt>Authors</dt><dd>{sourceAuthors(result)}</dd></div>}
          {journal && <div><dt>Publication</dt><dd>{journal}</dd></div>}
          {result.publisher && <div><dt>Publisher</dt><dd>{result.publisher}</dd></div>}
          {[['edition', 'Edition'], ['volume', 'Volume'], ['issue', 'Issue'], ['pages', 'Pages'], ['isbn', 'ISBN'], ['issn', 'ISSN']].filter(([key]) => result[key]).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{Array.isArray(result[key]) ? result[key].join('; ') : result[key]}</dd></div>)}
          {ids.doi && <div><dt>DOI</dt><dd>{ids.doi}</dd></div>}
          {ids.pmid && <div><dt>PMID</dt><dd>{ids.pmid}</dd></div>}
          <div><dt>Published</dt><dd>{year || "Not supplied"}</dd></div>
        </dl>
        {result.identityCheck && <div className="source-fit-details"><strong>DOI identity check</strong><p>{result.identityCheck.detail}</p>{result.identityCheck.registryTitle && <p>Registry title: {result.identityCheck.registryTitle}</p>}{result.identityCheck.url && <a href={result.identityCheck.url} target="_blank" rel="noopener noreferrer">Open DOI record</a>}</div>}
        {fit?.explanation && <div className="source-fit-details"><strong>Why this appeared</strong><p>{fit.explanation}</p>{fit.evidence?.length > 0 && <ul>{fit.evidence.map((evidence, index) => <li key={index}>{evidence.field === "title" ? "Title" : evidence.field === "abstract" ? "Abstract" : evidence.field || "Metadata"} contains “{evidence.term}”{evidence.concept && evidence.concept !== evidence.term ? ` (${evidence.concept})` : ""}.</li>)}</ul>}<p className="source-evidence-limit">Topic fit is an automated interpretation of metadata, not confirmation that the work answers your question.</p></div>}
        {assessment.checks.length > 0 && <div className="source-requirements"><strong>Assignment requirements</strong><ul>{assessment.checks.map((check) => <li key={check.id}><span className={`source-check-status ${check.status}`}>{check.status === "meets" ? "Matches metadata" : check.status === "mismatch" ? "Does not match" : "Needs checking"}</span><span><strong>{check.label}</strong> — {check.detail}</span></li>)}</ul></div>}
        {(result.abstractText || result.abstractExcerpt) && <div className="source-full-abstract"><strong>Provider-supplied abstract{!result.abstractText || result.abstractTruncated ? " excerpt" : ""}</strong><p>{result.abstractText || result.abstractExcerpt}</p><small>{result.abstractSource || result.sourceProvider || "Provider metadata"} · not AI-generated. No full article text was retrieved.</small></div>}
        {(isOpenAccess || result.openAccess || result.accessLinks?.some((link) => link.accessScope === "open-access")) && <p>OpenAlex reports an open-access location{result.openAccess?.version ? ` (${result.openAccess.version})` : ""}.{result.openAccess?.license ? ` Reported license: ${result.openAccess.license}.` : " No reuse license was supplied."} Confirm access, version, and reuse terms in the linked record.</p>}
        {!isOpenAccess && <p>Metadata does not confirm Wake Forest access. Check availability through ZSR.</p>}
        <p>Cite offers RIS for citation managers and BibTeX for LaTeX. Both export supplied provider metadata. Verify missing fields and formatting with the <a href={LIBRARY_LINKS.zsrCitationGuide} target="_blank" rel="noopener noreferrer">ZSR citation guide</a>.</p>
        {result.fulfillment && <p>Availability can change. Confirm the location in ZSR before visiting or requesting.</p>}
        {links.length > 0 && <div className="source-secondary-links" aria-label="Additional access options">{links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ kind: "opened-resource", query: result.title, tool: link.label, url: link.url })}>{link.label}{Icons.external}</a>)}</div>}

        </div>,
        reading: <SourceReadingGuide embedded key={sourceId} source={result} savedItem={savedItem} savedEntry={savedEntry} onSaveSourceNotes={onSaveSourceNotes} onTrackSearch={onTrackSearch} />,
        explore: <SourceExploration embedded key={`explore-${sourceId}`} source={result} researchSpec={researchSpec} accessScope={explorationAccessScope || "all"} onSaveResearchItem={onSaveResearchItem} onRemoveResearchItem={onRemoveResearchItem} savedResearchItemKeys={savedResearchItemKeys} onTrackSearch={onTrackSearch} />,
        feedback: <SourceFeedback embedded key={`feedback-${sourceId}`} source={result} request={feedbackRequest} researchSpec={researchSpec} feedback={feedback} />,
      }}</SourceDetailsDialog>
    </div>
    {studyEnabled && <button type="button" className="source-study-useful" disabled={markedUseful} onClick={() => { setMarkedUseful(true); onSourceEvent?.("source_marked_useful", { sourceId }); }}>{markedUseful ? "Marked useful" : "Useful for my question"}</button>}
  </li>;
}

function WhereToStart({ results, researchSpec, incomplete = false }) {
  const guide = whereToStart(results, researchSpec, { incomplete });
  if (!guide) return null;
  const jump = (key) => {
    const row = [...document.querySelectorAll(".source-result-row")].find((element) => element.dataset.sourceKey === key);
    if (!row) return;
    const hidden = row.closest("details:not([open])");
    if (hidden) hidden.open = true;
    row.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    row.querySelector(".source-result-title a, .source-result-title")?.focus?.({ preventScroll: true });
  };
  return <section className="where-to-start" aria-label="Where to start">
    <h3>Where to start</h3>
    {guide.picks.length > 0 && <ol>{guide.picks.map((pick) => <li key={pick.key}><button type="button" onClick={() => jump(pick.key)}>{pick.title}</button><span>{pick.reason}</span></li>)}</ol>}
    {guide.tip && <p className="where-to-start-tip">{guide.tip}</p>}
  </section>;
}

export default function SourceResults({ liveResults = [], sourceDiscovery = null, researchSpec = {}, compact = false, followup = false, onSaveResearchItem, onRemoveResearchItem, onTrackSearch, savedResearchItemKeys, onRerunInterpretation, onShowStrategy, onEditRequirements, onSourceEvent, studyEnabled = false, evidenceNotes = [], evidenceNotice = "", savedItems = [], onSaveSourceNotes }) {
  const filterId = useId();
  const feedback = useSourceFeedback();
  const [filters, setFilters] = useState({ type: "all", from: "", to: "", sort: "relevance" });
  const [selectedEditions, setSelectedEditions] = useState({});
  const editionKey = (record) => record.doi || record.url || record.id || record.title;
  const selectEdition = (group, record) => setSelectedEditions((current) => ({ ...current, [editionKey(group)]: record }));
  const exportRecord = (group) => {
    const selected = selectedEditions[editionKey(group)];
    return selected ? [group, ...(group.relatedEditions || [])].find((record) => editionKey(record) === editionKey(selected)) || group : group;
  };
  const [retryPending, setRetryPending] = useState(false);
  const [retryError, setRetryError] = useState("");
  // Recheck restored results too: old sessions can contain superseded checks.
  const checkedResults = liveResults.map((result) => ({ ...result, sourceAssessment: assessSourceRequirements(result, researchSpec) }));
  const excludedCount = checkedResults.filter((result) => result.sourceAssessment.status === "mismatch").length;
  const lanes = sourceResultLanes(checkedResults.filter((result) => result.sourceAssessment.status !== "mismatch"), sourceDiscovery);
  const allResults = lanes.flatMap((lane) => lane.results);
  const shownCount = filterSourceResults(allResults, filters).length;
  const localFiltersApplied = filters.type !== "all" || Boolean(filters.from || filters.to);
  const invalidYears = Boolean((filters.from && !/^\d{4}$/.test(filters.from)) || (filters.to && !/^\d{4}$/.test(filters.to)) || (filters.from && filters.to && Number(filters.from) > Number(filters.to)));
  const unknownYears = allResults.filter((result) => sourcePublicationYear(result) === null).length;
  const directQuery = researchSpecQuery(researchSpec) || researchSpec.topic || "";
  const seeAllUrl = fillTemplate(["books", "primary"].includes(researchSpec.mode) ? LIBRARY_LINKS.zsrPrimoSearch : LIBRARY_LINKS.zsrArticleSearch, directQuery);
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
  if (!allResults.length && !excludedCount && !lanes.some((lane) => lane.status?.requested)) return null;

  return <div className={`source-results-workspace ${compact ? "is-compact" : ""} ${followup ? "is-followup" : ""}`}>
    {excludedCount > 0 && <p className="source-results-trust"><strong>{excludedCount} {excludedCount === 1 ? "record excluded" : "records excluded"}.</strong> The reported metadata conflicts with a required source type, population, date, or method.</p>}
    {sourceDiscovery?.identity && sourceDiscovery.identity.status !== "matched" && <p className="source-identity-notice" role="status">{sourceDiscovery.identity.explanation || "The requested work has not been matched to its title and author."} Check the author and publication before using a related work in place of the original.</p>}
    {allResults.length > 0 && <div className="source-results-toolbar">
      <div className="source-results-summary"><strong>{shownCount} {shownCount === 1 ? "source" : "sources"}{localFiltersApplied ? ` of ${allResults.length}` : ""}</strong></div>
      <label className="source-sort-label" htmlFor={`${filterId}-sort`}>Sort<select id={`${filterId}-sort`} value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="relevance">Relevance</option><option value="newest">Newest first</option></select></label>
      <details className="source-local-filters"><summary>Filter{localFiltersApplied ? " · on" : ""}</summary><div className="source-filter-fields">
        <label htmlFor={`${filterId}-type`}>Source type<select id={`${filterId}-type`} value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="all">All retrieved types</option>{sourceTypeOptions(allResults).map((type) => <option key={type} value={type}>{sourceTypeLabel(type)}</option>)}</select></label>
        <label htmlFor={`${filterId}-from`}>Year from<input id={`${filterId}-from`} inputMode="numeric" maxLength={4} placeholder="Any year" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value.replace(/\D/g, "") })} /></label>
        <label htmlFor={`${filterId}-to`}>Year to<input id={`${filterId}-to`} inputMode="numeric" maxLength={4} placeholder="Any year" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value.replace(/\D/g, "") })} /></label>
        <button type="button" onClick={resetFilters} disabled={!localFiltersApplied}>Clear filters</button>
        <p>These filters do not change your assignment requirements or run a new search.{(filters.from || filters.to) && unknownYears > 0 ? ` ${unknownYears} ${unknownYears === 1 ? "lead has" : "leads have"} no publication year and will be hidden by a valid year filter.` : ""}</p>
        {invalidYears && <p role="status" className="source-filter-error">Enter four-digit years, with the start year no later than the end year.</p>}
      </div></details>
    </div>}
    {allResults.length > 0 && <WhereToStart results={allResults} researchSpec={researchSpec} incomplete={lanes.some((lane) => RETRY_OUTCOMES.has(sourceLaneOutcome(lane.status)))} />}
    {allResults.length > 0 && <p className="source-results-trust">Records come from library providers. Fit labels are automated and can be wrong; <strong>verify in the source</strong>.{evidenceNotice && <> <details className="source-trust-more"><summary>About AI &amp; evidence</summary><span>{evidenceNotice}</span></details></>}</p>}
    {feedback.queue.length > 0 && <SourceFeedbackQueue feedback={feedback} />}
    {retryError && <p className="source-provider-status" role="alert">{retryError}</p>}
    {!allResults.length && <SourceEmptyState excludedCount={excludedCount} lanes={lanes} recovery={recovery} directQuery={directQuery} researchSpec={researchSpec} externalFilters={externalFilters} pending={retryPending} onRetry={onRerunInterpretation ? retry : null} onShowStrategy={onShowStrategy} onEditRequirements={onEditRequirements} onTrackSearch={onTrackSearch} />}
    {evidenceNotice && !allResults.length && <details className="source-record-details"><summary>About AI guidance &amp; evidence</summary><p className="source-results-trust">{evidenceNotice}</p></details>}
    {allResults.length > 0 && paginateSourceLanes(lanes, filters).map((lane) => {
      if (!lane.results.length && !lane.status?.requested && !lane.mergedResultCount) return null;
      const visible = lane.filteredResults;
      const first = lane.initialResults;
      const more = lane.moreResults;
      const outcome = sourceLaneOutcome(lane.status);
      const failed = RETRY_OUTCOMES.has(outcome);
      if (!lane.results.length && lane.mergedResultCount > 0) return <section className="source-merged-access-note" key={lane.id} aria-label="Open-access matches"><strong>Open-access links included</strong><p>{lane.mergedResultCount} open-access {lane.mergedResultCount === 1 ? "match is" : "matches are"} already included in Library sources. Open Source tools on those records for access options.{localFiltersApplied ? " Local filters may hide some records." : ""}</p>{OUTCOME_MESSAGES[outcome] && failed && <p>{OUTCOME_MESSAGES[outcome]}</p>}</section>;
      if (!lane.results.length) return <section className="source-merged-access-note" key={lane.id} aria-label={lane.label}><strong>{lane.label}: {failed ? "search incomplete" : "no additional sources"}</strong><p>{OUTCOME_MESSAGES[outcome] || "No results were reported for this collection."}</p>{failed && onRerunInterpretation && <button type="button" className="source-action-button" disabled={retryPending} onClick={() => retry({ kind: "retry", query: directQuery, researchSpec })}>{retryPending ? "Searching…" : "Retry source search"}</button>}</section>;
      return <section className={`source-result-lane ${lane.id}-lane`} key={lane.id} aria-label={lane.label}>
        <div className="source-lane-heading"><div><h3>{lane.label}</h3><span>{lane.id === "open-access" ? "Reported as free to read; check the version and license." : "Check access when you open a source."}</span></div>{visible.length > 0 && <CitationExport sources={visible.map(exportRecord)} filename={`${lane.id}-source-leads`} label="Export citations" description={`Export ${lane.label} citations`} onExport={(exported) => exported.forEach((result) => onSourceEvent?.("exported", { sourceId: result.doi || result.url || researchItemKey(result) }))} />}</div>
        {OUTCOME_MESSAGES[outcome] && <p className="source-provider-status" role="status">{OUTCOME_MESSAGES[outcome]}</p>}
        {!visible.length ? <div className="source-empty-state" role="status"><p><strong>No leads match these display filters.</strong> The original search returned {lane.results.length} {lane.results.length === 1 ? "lead" : "leads"} in this group.</p><button type="button" onClick={resetFilters}>Clear filters</button></div> : <>
          {first.length > 0 && <ul className="source-result-list">{first.map((result, index) => <SourceRow explorationAccessScope={sourceDiscovery?.accessScope} feedback={feedback} feedbackRequest={researchSpec.originalRequest || researchSpec.topic || directQuery} key={result.doi || result.url || result.id || `${result.title}-${index}`} result={result} selectedEdition={exportRecord(result)} onEditionChange={selectEdition} researchSpec={researchSpec} onSaveResearchItem={onSaveResearchItem} onRemoveResearchItem={onRemoveResearchItem} onTrackSearch={onTrackSearch} savedResearchItemKeys={savedResearchItemKeys} onSourceEvent={onSourceEvent} studyEnabled={studyEnabled} evidenceNotes={evidenceNotes} savedItems={savedItems} onSaveSourceNotes={onSaveSourceNotes} />)}</ul>}
          {more.length > 0 && <details className="source-more-results"><summary>Show {more.length}{first.length ? " more" : ""} {more.length === 1 ? "source" : "sources"}</summary><ul className="source-result-list">{more.map((result, index) => <SourceRow explorationAccessScope={sourceDiscovery?.accessScope} feedback={feedback} feedbackRequest={researchSpec.originalRequest || researchSpec.topic || directQuery} key={result.doi || result.url || result.id || `${result.title}-${index + first.length}`} result={result} selectedEdition={exportRecord(result)} onEditionChange={selectEdition} researchSpec={researchSpec} onSaveResearchItem={onSaveResearchItem} onRemoveResearchItem={onRemoveResearchItem} onTrackSearch={onTrackSearch} savedResearchItemKeys={savedResearchItemKeys} onSourceEvent={onSourceEvent} studyEnabled={studyEnabled} evidenceNotes={evidenceNotes} savedItems={savedItems} onSaveSourceNotes={onSaveSourceNotes} />)}</ul></details>}
        </>}
      </section>;
    })}
    {allResults.length > 0 && directQuery && <a className="source-see-all" href={seeAllUrl} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ kind: "opened-resource", query: directQuery, tool: "ZSR Library Search", url: seeAllUrl })}>See all results in ZSR Library Search {Icons.external}</a>}
  </div>;
}
