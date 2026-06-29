export function splitEvidence(company) {
  return {
    facts: company.evidence?.confirmed || [],
    inferences: company.evidence?.inferred || [],
    unknowns: company.evidence?.unverified || [],
    risks: company.risk_flags || [],
    confidence_level: company.confidence_score >= 80 ? "High" : company.confidence_score >= 65 ? "Medium" : "Low",
  };
}

export function validateScorecard(scorecard) {
  const required = [
    "founder_score",
    "market_score",
    "product_score",
    "traction_score",
    "defensibility_score",
    "timing_score",
    "risk_score",
    "overall_score",
  ];
  const missing = required.filter((field) => !Number.isFinite(scorecard[field]));
  const hasReasoning = Array.isArray(scorecard.explanation) && scorecard.explanation.length >= 7;
  return {
    ok: missing.length === 0 && hasReasoning,
    missing,
    errors: hasReasoning ? [] : ["Every scorecard must include component-level reasoning."],
  };
}

export function unsupportedClaimGuard(text) {
  const blocked = [
    /guaranteed/i,
    /predicts? the next unicorn/i,
    /\bbuy\b|\bsell\b|invest now/i,
    /risk-free/i,
    /certain return/i,
  ];
  return {
    ok: !blocked.some((pattern) => pattern.test(text)),
    violations: blocked.filter((pattern) => pattern.test(text)).map((pattern) => pattern.toString()),
  };
}
