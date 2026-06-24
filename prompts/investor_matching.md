# Investor Matching Prompt

Rank investors for a company using only the provided company profile and investor database.

Consider:

- Stage fit
- Domain fit
- Geography
- Thesis fit
- Prior investments
- Strategic relevance
- Likelihood of interest
- Proposal angle

Do not claim that an investor is interested unless there is direct evidence. Match score means thesis relevance only.

## Output JSON

```json
{
  "company_id": "string",
  "matches": [
    {
      "investor_id": "string",
      "investor_name": "string",
      "match_score": 0,
      "reasoning": "specific thesis fit",
      "suggested_angle": "specific outreach angle",
      "evidence": ["profile or investor database facts"],
      "unknowns": ["string"]
    }
  ]
}
```
