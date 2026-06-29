export const SCORING_WEIGHTS = {
  founder_signal: 0.2,
  market_signal: 0.2,
  product_signal: 0.15,
  technical_defensibility: 0.15,
  traction_signal: 0.15,
  timing_signal: 0.1,
  risk_adjustment: 0.05,
};

export const SCORE_LABELS = {
  founder_signal: "Founder signal",
  market_signal: "Market size and urgency",
  product_signal: "Product clarity",
  technical_defensibility: "Technical defensibility",
  traction_signal: "Traction signal",
  timing_signal: "Timing and macro fit",
  risk_adjustment: "Risk adjustment",
};

const EXPLANATION_RULES = {
  founder_signal: "Founder score reflects founder-market fit, prior operating depth, technical credibility, and directly verified credentials.",
  market_signal: "Market score reflects budget ownership, urgency, category growth, and whether the problem looks durable rather than novelty-driven.",
  product_signal: "Product score reflects clarity of user, buyer, use case, repeated workflow, and whether the product is more than a thin model wrapper.",
  technical_defensibility: "Defensibility score reflects data advantage, integration depth, operational complexity, workflow lock-in, and engineering difficulty.",
  traction_signal: "Traction score reflects source-backed usage, revenue hints, customers, community response, hiring, and repeated-use evidence.",
  timing_signal: "Timing score reflects macro, regulatory, labor-market, AI-platform, and sector-specific tailwinds.",
  risk_adjustment: "Risk adjustment is higher when risks appear bounded or mitigable; it is lower for crowded, unclear, regulated, or weak-evidence opportunities.",
};

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function riskLevel(company) {
  const severities = company?.risk_flags?.map((risk) => risk.severity) || [];
  if (severities.includes("high")) return "High";
  if (severities.includes("medium")) return "Medium";
  return "Low";
}

export function confidenceLabel(score) {
  if (score >= 80) return "High";
  if (score >= 65) return "Medium";
  return "Low";
}

export function scoreCompany(company, weights = SCORING_WEIGHTS) {
  const inputs = company.score_inputs || {};
  const component_scores = Object.fromEntries(
    Object.keys(SCORING_WEIGHTS).map((key) => [key, clampScore(inputs[key])])
  );

  const overall_score = clampScore(
    Object.entries(SCORING_WEIGHTS).reduce((total, [key, defaultWeight]) => {
      const weight = Number.isFinite(weights[key]) ? weights[key] : defaultWeight;
      return total + component_scores[key] * weight;
    }, 0)
  );

  const explanation = Object.entries(component_scores).map(([key, score]) => ({
    component: key,
    label: SCORE_LABELS[key],
    score,
    reasoning: EXPLANATION_RULES[key],
  }));

  return {
    company_id: company.id,
    company_name: company.name,
    domain: company.domain,
    founder_score: component_scores.founder_signal,
    market_score: component_scores.market_signal,
    product_score: component_scores.product_signal,
    traction_score: component_scores.traction_signal,
    defensibility_score: component_scores.technical_defensibility,
    timing_score: component_scores.timing_signal,
    risk_score: component_scores.risk_adjustment,
    overall_score,
    confidence_score: clampScore(company.confidence_score),
    confidence_label: confidenceLabel(company.confidence_score),
    risk_level: riskLevel(company),
    explanation,
    created_at: new Date().toISOString(),
  };
}

export function scoreCompanies(companies, weights = SCORING_WEIGHTS) {
  return companies
    .map((company) => ({ company, scorecard: scoreCompany(company, weights) }))
    .sort((a, b) => b.scorecard.overall_score - a.scorecard.overall_score);
}

export function summarizeDomains(companies, scored = scoreCompanies(companies)) {
  const byId = new Map(scored.map((item) => [item.company.id, item.scorecard]));
  const grouped = new Map();

  for (const company of companies) {
    const scorecard = byId.get(company.id) || scoreCompany(company);
    const bucket = grouped.get(company.domain) || [];
    bucket.push({ company, scorecard });
    grouped.set(company.domain, bucket);
  }

  return Array.from(grouped.entries())
    .map(([domain, items]) => {
      const sorted = items.sort((a, b) => b.scorecard.overall_score - a.scorecard.overall_score);
      const average_score = Math.round(
        sorted.reduce((sum, item) => sum + item.scorecard.overall_score, 0) / sorted.length
      );
      const average_risk =
        sorted.filter((item) => item.scorecard.risk_level === "High").length > 0
          ? "High"
          : sorted.filter((item) => item.scorecard.risk_level === "Medium").length > sorted.length / 2
            ? "Medium"
            : "Low";

      return {
        id: domain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        name: domain,
        description: `${domain} companies discovered in the current sample window.`,
        company_count: sorted.length,
        average_score,
        best_company: sorted[0].company.name,
        best_company_id: sorted[0].company.id,
        best_company_score: sorted[0].scorecard.overall_score,
        market_context: inferDomainPattern(domain, sorted),
        momentum_score: Math.min(100, Math.round(average_score + sorted.length * 3)),
        competition_level: inferCompetitionLevel(sorted),
        investor_interest_score: Math.min(100, Math.round(average_score + 6)),
        regulatory_risk: inferRegulatoryRisk(domain, average_risk),
        risk_level: average_risk,
        created_at: new Date().toISOString(),
      };
    })
    .sort((a, b) => b.momentum_score - a.momentum_score);
}

function inferCompetitionLevel(items) {
  const competitorCount = items.reduce((sum, item) => sum + (item.company.competitors?.length || 0), 0);
  if (competitorCount / items.length >= 4) return "High";
  if (competitorCount / items.length >= 2) return "Medium";
  return "Low";
}

function inferRegulatoryRisk(domain, averageRisk) {
  if (/healthcare|legal|defense|govtech|fintech/i.test(domain)) return averageRisk === "Low" ? "Medium" : averageRisk;
  return averageRisk;
}

function inferDomainPattern(domain, items) {
  const top = items[0];
  if (/AI infrastructure|Developer tools|Cybersecurity/.test(domain)) {
    return `Strong technical wedge; diligence should prioritize production evidence for ${top.company.name}.`;
  }
  if (/Healthcare|Legal|Govtech|Defense|Fintech/.test(domain)) {
    return `Trust and compliance drive adoption; verify buyer access and regulatory posture for ${top.company.name}.`;
  }
  if (/Consumer/.test(domain)) {
    return `Retention and distribution are the gating questions; avoid overreading launch engagement.`;
  }
  return `Operational urgency is visible; confirm workflow frequency and willingness to pay for ${top.company.name}.`;
}

export function bestByDomain(companies, scored = scoreCompanies(companies)) {
  const domainSummaries = summarizeDomains(companies, scored);
  const byCompany = new Map(scored.map((item) => [item.company.id, item]));
  return domainSummaries.map((domain) => ({
    domain: domain.name,
    ...byCompany.get(domain.best_company_id),
  }));
}
