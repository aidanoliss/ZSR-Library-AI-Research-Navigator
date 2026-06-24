export default function InvestorMatchCard({ match, compact = false }) {
  const investor = match.investor;
  return (
    <article className={compact ? "investor-card compact" : "investor-card"}>
      <div className="investor-head">
        <div>
          <h3>{investor.name}</h3>
          <p>{investor.type}</p>
        </div>
        <strong>{match.match_score}</strong>
      </div>
      <p>{compact ? `Thesis fit for ${match.investor.domains.slice(0, 2).join(" and ")}.` : match.reasoning}</p>
      {!compact && (
        <>
          <div className="tag-row">
            {investor.domains.slice(0, 3).map((domain) => (
              <span className="mini-tag" key={domain}>{domain}</span>
            ))}
          </div>
          {match.relevant_partners?.length ? (
            <p className="investor-angle">Relevant partners: {match.relevant_partners.map((partner) => partner.name).join(", ")}</p>
          ) : null}
          {match.why_this_firm_might_pass ? (
            <p className="investor-angle">Pass risk: {match.why_this_firm_might_pass}</p>
          ) : null}
          <p className="investor-angle">{match.suggested_angle}</p>
        </>
      )}
    </article>
  );
}
