export default function RiskFlags({ risks = [] }) {
  if (!risks.length) {
    return <p className="empty-note">No material risk flags recorded.</p>;
  }

  return (
    <div className="risk-list">
      {risks.map((risk) => (
        <article className={`risk-flag severity-${risk.severity}`} key={`${risk.risk_type}-${risk.explanation}`}>
          <div>
            <strong>{risk.risk_type}</strong>
            <span>{risk.severity}</span>
          </div>
          <p>{risk.explanation}</p>
        </article>
      ))}
    </div>
  );
}
