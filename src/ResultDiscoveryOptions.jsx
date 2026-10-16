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
    const az = /az\.php/.test(url);
    return <li key={resource.id || resource.name} className="result-database-card">
      <div className="result-database-title"><a href={url} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ query, tool: resource.name, url })}>{resource.name} <span aria-hidden="true">↗</span></a>{resource.subjectArea && <span>{resource.subjectArea}</span>}</div>
      <p><strong>Useful for:</strong> {resource.bestFor || resource.description || resource.whyFits}</p>
      <p className="result-database-access"><strong>{plan.navigationOnly ? "Next step:" : "How to search:"}</strong> {plan.navigationOnly ? resource.nextStep || "Open this ZSR resource and follow its instructions." : az ? "Open its ZSR A–Z entry, follow the database link, then paste a query. Sign in with WFU if prompted." : "Open this resource and paste a query into its search box. Follow any access or sign-in instructions there."}</p>
      {query && <details className="result-database-query"><summary>Suggested query & filters</summary><code>{query}</code><CopyQuery query={query} label={`Copy query for ${resource.name}`} />{resource.filters?.length > 0 && <p><strong>Apply in the database:</strong> {resource.filters.join(" · ")}</p>}</details>}
    </li>;
  }
  return <div className="result-discovery-options">
    {options.length > 0 && <section id={`${id}-terms`} className="result-search-options" tabIndex={-1} aria-label="Search terms to try">
      <div className="result-section-heading"><h3>Search terms to try</h3><a href="https://guides.zsr.wfu.edu/c.php?g=1072064&p=7805742" target="_blank" rel="noopener noreferrer">ZSR search guide ↗</a></div>
      <p>Copy a Boolean search into one of the databases below. <strong>AND</strong> combines ideas; <strong>OR</strong> includes alternatives; <strong>NOT</strong> excludes terms.</p>
      <p className="result-query-count"><strong>{options.length} distinct {options.length === 1 ? "search" : "searches"}</strong> · Start focused, then try alternatives if you need more.</p>
      {vocabulary.length > 0 && <details className="result-vocabulary"><summary>Explore synonyms &amp; related terms</summary><p>Suggestions from your brief and Navigator’s vocabulary list. <strong>These are not verified database subject headings or exact equivalents.</strong> Keep only terms that fit your question. An asterisk (*) searches word endings in databases that support it.</p><dl>{vocabulary.map(({ term, alternatives }) => <div key={term}><dt>{term}</dt><dd>{alternatives.join(" · ")}</dd></div>)}</dl></details>}
      <ul className="result-query-options">{options.slice(0, 4).map(queryCard)}</ul>
      {options.length > 4 && <details className="result-more-queries"><summary>More search options ({options.length - 4})</summary><ul className="result-query-options">{options.slice(4).map((option, index) => queryCard(option, index + 4))}</ul></details>}
      <p className="result-query-limit-note"><strong>Keep your requirements:</strong> {filters.length ? `${filters.join(" · ")}. ` : ""}Apply source type, date, and peer-review filters in the database when required. NOT may also remove useful studies that mention an excluded term.</p>
    </section>}
    {resources.length > 0 && <section id={`${id}-databases`} className="result-databases" tabIndex={-1} aria-label="Recommended databases">
      <div className="result-section-heading"><h3>{plan.navigationOnly ? "Recommended ZSR resources" : "Recommended databases"}</h3><span>Curated starting points</span></div>
      <p>{plan.navigationOnly ? "Choose the ZSR resource that matches your task." : <>Find more literature in a recommended database. <strong>Each link opens a place to search</strong>; access may require a WFU sign-in.</>}</p>
      <ul className="result-database-list">{resources.slice(0, 2).map(databaseCard)}</ul>
      {resources.length > 2 && <details className="result-more-databases"><summary>More places to search ({resources.length - 2})</summary><ul className="result-database-list">{resources.slice(2).map((resource, index) => databaseCard(resource, index + 2))}</ul></details>}
    </section>}
  </div>;
}
