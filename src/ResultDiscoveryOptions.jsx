import { useState } from "react";
import { compileResourceQuery } from "../config/queryCompiler.js";
import { fillTemplate } from "../config/libraryLinks.js";
import { buildResultQueryOptions, resultQueryFilters, resultDatabaseRecommendations, resultSearchVocabulary } from "./resultDiscovery.js";

function CopyQuery({ query, label = "Copy query" }) {
  const [status, setStatus] = useState("");
  return <div className="result-query-copy">
    <button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(query); setStatus("Copied. Paste into the database search box."); }
      catch { setStatus("Select the query text to copy it manually."); }
    }} aria-label={label}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>Copy query</button>
    <span role="status">{status}</span>
  </div>;
}

export default function ResultDiscoveryOptions({ id, spec, plan, onTrackSearch }) {
  const options = buildResultQueryOptions(spec);
  const filters = resultQueryFilters(spec);
  const vocabulary = resultSearchVocabulary(spec);
  const resources = resultDatabaseRecommendations(plan);
  function queryCard(option, index) {
    return <li key={option.query}><div className="result-query-label"><strong>{option.label}</strong><span>{index + 1}</span></div><p>{option.description}</p><code>{option.query}</code><CopyQuery query={option.query} label={`Copy query: ${option.label}`} /></li>;
  }
  function databaseCard(resource, index) {
    const query = plan.navigationOnly ? "" : compileResourceQuery(resource, spec, index) || options[0]?.query;
    const url = fillTemplate(resource.accessUrl || resource.url, query || "");
    return <li key={resource.id || resource.name} className="result-database-card">
      <div className="result-database-title"><a href={url} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ query, tool: resource.name, url })}>{resource.name} <span aria-hidden="true">↗</span></a>{resource.subjectArea && <span>{resource.subjectArea}</span>}</div>
      <p><strong>Useful for:</strong> {resource.bestFor || resource.description || resource.whyFits}</p>
      {plan.navigationOnly && <p className="result-database-access"><strong>Next step:</strong> {resource.nextStep || "Open this ZSR resource and follow its instructions."}</p>}
      {query && <details className="result-database-query"><summary>Search string for this database</summary><code>{query}</code><CopyQuery query={query} label={`Copy query for ${resource.name}`} />{resource.filters?.length > 0 && <p><strong>Apply in the database:</strong> {resource.filters.join(" · ")}</p>}</details>}
    </li>;
  }
  return <div className="result-discovery-options">
    {options.length > 0 && <section id={`${id}-terms`} className="result-search-options" tabIndex={-1} aria-label="Search terms to try">
      <div className="result-section-heading"><h3>Search terms to try</h3><a href="https://guides.zsr.wfu.edu/c.php?g=1072064&p=7805742" target="_blank" rel="noopener noreferrer">ZSR search guide ↗</a></div>
      <p>Paste this into a database below. <strong>AND</strong> joins ideas, <strong>OR</strong> adds alternatives, <strong>NOT</strong> leaves a topic out.</p>
      {vocabulary.length > 0 && <details className="result-vocabulary"><summary>Explore synonyms &amp; related terms</summary><p>Suggestions from your brief and Navigator’s vocabulary list. <strong>These are not verified database subject headings or exact equivalents.</strong> Keep only terms that fit your question. An asterisk (*) searches word endings in databases that support it.</p><dl>{vocabulary.map(({ term, alternatives }) => <div key={term}><dt>{term}</dt><dd>{alternatives.join(" · ")}</dd></div>)}</dl></details>}
      <ul className="result-query-options">{options.slice(0, 2).map(queryCard)}</ul>
      {options.length > 2 && <details className="result-more-queries"><summary>More ways to search ({options.length - 2})</summary><ul className="result-query-options">{options.slice(2).map((option, index) => queryCard(option, index + 2))}</ul></details>}
      {filters.length > 0 && <p className="result-query-limit-note"><strong>Also set in the database:</strong> {filters.join(" · ")}.</p>}
    </section>}
    {resources.length > 0 && <section id={`${id}-databases`} className="result-databases" tabIndex={-1} aria-label="Recommended databases">
      <div className="result-section-heading"><h3>{plan.navigationOnly ? "Recommended ZSR resources" : "Recommended databases"}</h3></div>
      <p>{plan.navigationOnly ? "Choose the ZSR resource that matches your task." : "Open a database, sign in with WFU if asked, and paste a search string."}</p>
      <ul className="result-database-list">{resources.slice(0, 2).map(databaseCard)}</ul>
      {resources.length > 2 && <details className="result-more-databases"><summary>More places to search ({resources.length - 2})</summary><ul className="result-database-list">{resources.slice(2).map((resource, index) => databaseCard(resource, index + 2))}</ul></details>}
    </section>}
  </div>;
}
