export default function DomainScorecard({ domain, onSelectCompany }) {
  return (
    <article className="domain-scorecard">
      <div className="domain-topline">
        <div>
          <h3>{domain.name}</h3>
          <p>{domain.company_count} new {domain.company_count === 1 ? "company" : "companies"}</p>
        </div>
        <strong>{domain.average_score}</strong>
      </div>
      <dl className="domain-metrics">
        <div>
          <dt>Best company</dt>
          <dd>
            <button type="button" onClick={() => onSelectCompany?.(domain.best_company_id)}>
              {domain.best_company}
            </button>
          </dd>
        </div>
        <div>
          <dt>Momentum</dt>
          <dd>{domain.momentum_score}/100</dd>
        </div>
        <div>
          <dt>Competition</dt>
          <dd>{domain.competition_level}</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd>{domain.risk_level}</dd>
        </div>
      </dl>
      <p>{domain.market_context}</p>
    </article>
  );
}
