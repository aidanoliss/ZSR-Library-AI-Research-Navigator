import { searchCoverage } from './searchCoverage.js';
import './researchEnhancements.css';
export default function SearchCoverage({ discovery, plan, onRetry, onShowDatabases }) {
  const coverage = searchCoverage(discovery, plan);
  const providerCount = new Set(coverage.searched.map(row => row.provider)).size;
  function rows(values, queryLabel = 'Executed query') { return <ul>{values.map((row, index) => <li key={`${row.provider}-${index}`}><strong>{row.provider}</strong> — {row.label}{row.count !== null && ['success', 'empty'].includes(row.status) && <> · {row.count} returned {row.count === 1 ? 'record' : 'records'} in this attempt</>}{row.query && <small>{queryLabel}: {row.query}</small>}</li>)}</ul>; }
  return <details className="search-coverage"><summary>What this search covered <span>{coverage.unavailable.length ? 'Some searches could not finish' : coverage.searched.length ? `${providerCount} search ${providerCount === 1 ? 'provider' : 'providers'} completed` : 'Check coverage before drawing conclusions'}</span></summary>
    {coverage.completedAt && <time dateTime={coverage.completedAt}>Run status recorded {new Date(coverage.completedAt).toLocaleString()}</time>}
    <h4>Actually searched</h4>{coverage.searched.length ? rows(coverage.searched) : <p>{coverage.unknown ? 'Execution details are unavailable for this saved result.' : 'No completed provider searches were recorded for this run.'}</p>}
    {coverage.unavailable.length > 0 && <><h4>Unavailable or incomplete</h4>{rows(coverage.unavailable, 'Attempted query')}{onRetry && <button type="button" className="scope-apply" onClick={onRetry}>Retry this search</button>}</>}
    {coverage.notSearched.length > 0 && <><h4>Not searched / not confirmed</h4>{rows(coverage.notSearched, 'Recorded query (execution not confirmed)')}</>}
    {coverage.recommended.length > 0 && <><h4>Recommended for further searching</h4><p><strong>These recommendations are not evidence that Navigator searched the databases.</strong></p><ul>{coverage.recommended.map((item) => <li key={item.id || item.name}>{item.name}</li>)}</ul>{onShowDatabases && <button type="button" onClick={onShowDatabases}>Go to recommended databases</button>}</>}
    <p><strong>Coverage limits:</strong> These are bounded searches of available metadata, not a comprehensive literature review. Provider indexes, access scopes and search limits can omit relevant work. Counts may overlap across queries and do not measure relevance. No full article text was retrieved.</p>
  </details>;
}
