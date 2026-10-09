import { REQUIREMENT_STATUS_LABELS, savedSourceDetails } from "./workspaceRequirements.js";

export function RequirementProgress({ progress, id = "workspace-progress" }) {
  return (
    <section className="workspace-progress" aria-labelledby={`${id}-title`}>
      <div className="workspace-progress-heading">
        <h4 id={`${id}-title`}>Requirements progress</h4>
        <span>{progress.spec.origin}</span>
      </div>
      <p><strong>{progress.selected}{progress.target ? ` of ${progress.target}` : ""}</strong> unique sources marked “Use”{progress.target ? "." : ". Set a source target in your brief."}</p>
      {progress.target && <progress value={Math.min(progress.selected, progress.target)} max={progress.target} aria-label={`${progress.selected} of ${progress.target} sources selected; this does not verify quality`} />}
      {progress.selected > 0 && <div className="workspace-progress-counts">
        <span><strong>{progress.supported}</strong> supported by metadata</span>
        <span><strong>{progress.unknown}</strong> need verification</span>
        <span><strong>{progress.mismatches}</strong> do not meet checks</span>
      </div>}
      {progress.selected > 0 && !!progress.checks.length && <ul>{progress.checks.map((check) => <li key={check.id}><strong>{check.label}:</strong> {check.meets} supported · {check.unverified} unknown · {check.mismatch} outside requirement</li>)}</ul>}
      {!!progress.duplicates && <p>{progress.duplicates} duplicate record{progress.duplicates === 1 ? "" : "s"} excluded from the count.</p>}
      {!progress.selected && <p>Save source leads and mark the ones you plan to use.</p>}
      {!!progress.spec.manualRequirements?.length && <ul>{progress.spec.manualRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>}
      {progress.selected > 0 && <p className="workspace-evidence-note">These checks use reported metadata. Verify each source before relying on it.</p>}
    </section>
  );
}

export function SavedSourceEvidence({ item, spec }) {
  const details = savedSourceDetails(item, spec);
  return (
    <div className="workspace-source-evidence">
      <p className="workspace-source-summary">{[details.provider, details.year !== "Not supplied" ? details.year : "", details.kind !== "Not supplied" ? details.kind : ""].filter(Boolean).join(" · ")}</p>
      {item.imported && <p className="workspace-imported-note">Imported record — recheck metadata in the source.</p>}
      <p>{details.fit}</p>
      <details>
        <summary>Source details and requirement checks</summary>
        <dl>
          {[['Authors', details.author], ['Peer review', details.peerReview], ['Access', details.access], ['Source license', details.license], ['DOI', details.doi]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {!!details.checks.length && <ul className="workspace-source-checks">{details.checks.map((check) => <li key={check.id} data-status={check.status}><strong>{check.label}: {REQUIREMENT_STATUS_LABELS[check.status]}.</strong> {check.detail}</li>)}</ul>}
      </details>
    </div>
  );
}

export function SourceComparison({ items, spec, onClear }) {
  if (items.length < 2) return null;
  const columns = items.map((item) => ({ item, details: savedSourceDetails(item, spec) }));
  const rows = [['Authors', 'author'], ['Year', 'year'], ['Type', 'kind'], ['Metadata provider', 'provider'], ['Peer review', 'peerReview'], ['Access', 'access'], ['Source license', 'license'], ['DOI', 'doi'], ['Fit to the question', 'fit']];
  return (
    <section className="workspace-comparison" aria-labelledby="workspace-comparison-title">
      <div className="workspace-progress-heading"><h4 id="workspace-comparison-title">Compare {items.length} saved sources</h4><button type="button" onClick={onClear}>Clear</button></div>
      <p>Compare the supplied metadata; missing information stays unknown.</p>
      <div className="workspace-comparison-scroll" role="region" aria-label="Source comparison, scroll horizontally for all columns" tabIndex={0}>
        <table>
          <caption className="sr-only">Comparison of selected saved sources</caption>
          <thead><tr><th scope="col">Field</th>{columns.map(({ item }) => <th scope="col" key={item.id}>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a> : item.title}</th>)}</tr></thead>
          <tbody>{rows.map(([label, field]) => <tr key={field}><th scope="row">{label}</th>{columns.map(({ item, details }) => <td key={item.id}>{details[field]}</td>)}</tr>)}
            <tr><th scope="row">Requirements</th>{columns.map(({ item, details }) => <td key={item.id}>{details.checks.length ? details.checks.map((check) => <p key={check.id}><strong>{check.label}: {REQUIREMENT_STATUS_LABELS[check.status]}</strong><br />{check.detail}</p>) : "Add requirements in your brief to compare."}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
