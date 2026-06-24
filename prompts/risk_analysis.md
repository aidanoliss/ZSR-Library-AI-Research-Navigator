# Risk Analysis Prompt

Identify risks in a startup profile. Keep the output specific and evidence-aware.

Risk categories may include crowded market, weak differentiation, regulatory exposure, platform dependency, unclear monetization, unclear buyer, weak evidence, security or privacy risk, hype-heavy language, founder credibility issues, procurement risk, hardware execution, and data-quality risk.

## Output JSON

```json
{
  "company_id": "string",
  "risk_flags": [
    {
      "risk_type": "string",
      "severity": "low | medium | high",
      "explanation": "specific explanation",
      "evidence_url": "string or unknown",
      "diligence_questions": ["string"]
    }
  ],
  "unknowns": ["string"],
  "confidence_level": "low | medium | high"
}
```

Do not state that a risk exists as fact unless the source supports it. If it is inferred, say so.
