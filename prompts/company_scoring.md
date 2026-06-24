# Company Scoring Prompt

You are scoring a startup for analyst augmentation, not automated investing.

Return a transparent 0-100 scorecard. Every score must include reasoning and evidence references. Do not output a score without explanation.

## Weights

- Founder signal: 20%
- Market size and urgency: 20%
- Product clarity and usefulness: 15%
- Technical defensibility: 15%
- Traction signal: 15%
- Timing and macro fit: 10%
- Risk adjustment: 5%

## Output JSON

```json
{
  "founder_score": 0,
  "market_score": 0,
  "product_score": 0,
  "defensibility_score": 0,
  "traction_score": 0,
  "timing_score": 0,
  "risk_score": 0,
  "overall_score": 0,
  "confidence_level": "low | medium | high",
  "explanation": [
    {
      "component": "founder_signal",
      "score": 0,
      "reasoning": "specific reasoning",
      "evidence": ["source-backed evidence"],
      "uncertainty": "what remains unknown"
    }
  ],
  "unsupported_claims": [],
  "diligence_questions": []
}
```

Risk score is a risk-adjusted quality score: higher means risks appear more bounded or mitigable. Use separate risk flags for severity.
