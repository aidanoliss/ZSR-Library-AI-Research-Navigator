"""Deterministic Venture Radar scoring helper.

This mirrors the JavaScript scoring weights so future enrichment jobs can run
in Python without changing the scoring methodology.
"""

SCORING_WEIGHTS = {
    "founder_signal": 0.20,
    "market_signal": 0.20,
    "product_signal": 0.15,
    "technical_defensibility": 0.15,
    "traction_signal": 0.15,
    "timing_signal": 0.10,
    "risk_adjustment": 0.05,
}


def clamp_score(value):
    try:
        return max(0, min(100, round(float(value))))
    except (TypeError, ValueError):
        return 0


def score_company(company, weights=None):
    weights = weights or SCORING_WEIGHTS
    inputs = company.get("score_inputs", {})
    components = {key: clamp_score(inputs.get(key, 0)) for key in SCORING_WEIGHTS}
    overall = clamp_score(sum(components[key] * weights.get(key, SCORING_WEIGHTS[key]) for key in SCORING_WEIGHTS))
    return {
        "company_id": company.get("id"),
        "company_name": company.get("name"),
        "domain": company.get("domain"),
        "component_scores": components,
        "overall_score": overall,
        "confidence_score": clamp_score(company.get("confidence_score", 0)),
    }
