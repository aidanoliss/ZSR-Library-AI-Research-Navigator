import SourceBadge from "./SourceBadge.jsx";

export default function StartupTable({ rows, onSelectCompany, compact = false, listState = {}, onSetList }) {
  return (
    <div className="table-shell">
      <table className="startup-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Domain</th>
            {!compact && <th>Source</th>}
            <th>Discovered</th>
            <th>Score</th>
            {!compact && <th>Founder</th>}
            {!compact && <th>Market</th>}
            {!compact && <th>Traction</th>}
            <th>Risk</th>
            <th>Confidence</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ company, scorecard }) => (
            <tr key={company.id}>
              <td>
                <button className="company-link" type="button" onClick={() => onSelectCompany(company.id)}>
                  {company.name}
                </button>
                <span>{company.subdomain}</span>
              </td>
              <td>{company.domain}</td>
              {!compact && (
                <td>
                  <SourceBadge name={company.source_name} url={company.source_url} />
                </td>
              )}
              <td>{company.discovered_at}</td>
              <td>
                <div className="score-cell">
                  <strong>{scorecard.overall_score}</strong>
                  <span style={{ "--score": `${scorecard.overall_score}%` }} />
                </div>
              </td>
              {!compact && <td>{scorecard.founder_score}</td>}
              {!compact && <td>{scorecard.market_score}</td>}
              {!compact && <td>{scorecard.traction_score}</td>}
              <td><span className={`risk-pill risk-${scorecard.risk_level.toLowerCase()}`}>{scorecard.risk_level}</span></td>
              <td>{scorecard.confidence_label}</td>
              <td>
                <div className="table-actions">
                  <button className="row-action" type="button" onClick={() => onSelectCompany(company.id)}>
                    Review
                  </button>
                  {onSetList && !compact && (
                    <>
                      <button className={listState[company.id] === "watch" ? "row-action active-action" : "row-action"} type="button" onClick={() => onSetList(company.id, "watch")}>
                        Watch
                      </button>
                      <button className={listState[company.id] === "pass" ? "row-action active-action danger-action" : "row-action"} type="button" onClick={() => onSetList(company.id, "pass")}>
                        Pass
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
