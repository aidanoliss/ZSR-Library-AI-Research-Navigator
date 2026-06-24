import SourceBadge from "./SourceBadge.jsx";
import RiskFlags from "./RiskFlags.jsx";

function EvidenceColumn({ title, items, className }) {
  return (
    <section className={`evidence-column ${className}`}>
      <h4>{title}</h4>
      {items?.length ? (
        <ul>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="empty-note">None recorded.</p>
      )}
    </section>
  );
}

export default function CompanyCard({ company, scorecard }) {
  return (
    <article className="company-detail-card">
      <div className="detail-hero">
        <div>
          <p className="section-kicker">{company.domain}</p>
          <h2>{company.name}</h2>
          <p>{company.product_summary}</p>
          <div className="detail-actions">
            <SourceBadge name={company.source_name} url={company.source_url} />
            <a className="row-action" href={company.website_url} target="_blank" rel="noreferrer">Website</a>
          </div>
        </div>
        <dl className="score-summary">
          <div>
            <dt>Overall</dt>
            <dd>{scorecard.overall_score}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{scorecard.confidence_label}</dd>
          </div>
          <div>
            <dt>Risk</dt>
            <dd>{scorecard.risk_level}</dd>
          </div>
        </dl>
      </div>

      <div className="profile-grid">
        <section>
          <h3>Structured Profile</h3>
          <dl className="profile-list">
            <div><dt>Stage</dt><dd>{company.stage}</dd></div>
            <div><dt>Business model</dt><dd>{company.business_model}</dd></div>
            <div><dt>Target customer</dt><dd>{company.target_customer}</dd></div>
            <div><dt>Funding status</dt><dd>{company.funding_status}</dd></div>
            <div><dt>Geography</dt><dd>{company.geography}</dd></div>
          </dl>
        </section>
        <section>
          <h3>Scorecard</h3>
          <div className="score-bars">
            {scorecard.explanation.map((item) => (
              <div className="score-bar-row" key={item.component}>
                <span>{item.label}</span>
                <strong>{item.score}</strong>
                <i style={{ "--score": `${item.score}%` }} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="evidence-grid">
        <EvidenceColumn title="Confirmed" items={company.evidence?.confirmed} className="confirmed" />
        <EvidenceColumn title="Inferred" items={company.evidence?.inferred} className="inferred" />
        <EvidenceColumn title="Unverified" items={company.evidence?.unverified} className="unverified" />
        <EvidenceColumn title="Needs diligence" items={company.evidence?.needs_diligence} className="diligence" />
      </div>

      <div className="profile-grid">
        <section>
          <h3>Pros</h3>
          <ul className="plain-list">{company.pros.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section>
          <h3>Cons</h3>
          <ul className="plain-list">{company.cons.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </div>

      <section>
        <h3>Risk Flags</h3>
        <RiskFlags risks={company.risk_flags} />
      </section>

      <section>
        <h3>Diligence Questions</h3>
        <ul className="plain-list">{company.diligence_questions.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
    </article>
  );
}
