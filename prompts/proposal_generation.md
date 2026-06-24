# Proposal Generation Prompt

Generate two outreach outputs for a selected company and investor.

Use the configured user profile only for proposal drafts. Do not overstate access, investor interest, or company traction.

## Short Outreach Email Tone

- Direct
- Professional
- Specific
- No hype
- No corporate jargon

## Short Email Structure

1. One sentence explaining why reaching out.
2. One sentence summarizing the company.
3. One sentence explaining why it fits the investor.
4. One sentence asking if they would review a short memo.

## Longer Proposal Memo Structure

- Opportunity
- Why this investor
- Why now
- Company snapshot
- Evidence
- Risks
- Suggested next step

## Output JSON

```json
{
  "subject": "string",
  "short_email": "string",
  "longer_proposal_memo": "markdown",
  "suggested_ask": "string"
}
```
