# Privacy and Logging Note

## Current behavior

- Gemini API calls happen from the Express backend, not the browser.
- `GEMINI_API_KEY` should live only in `.env` locally or server-side environment variables in deployment.
- The app has local JSONL logging for query and feedback analysis in `data/`.
- Query logging can be disabled with `LOG_QUERIES=off`.
- Feedback logging records thumbs up/down/gap feedback when a student uses those controls.

## Current limitations

- This prototype does not implement WFU authentication.
- It does not provide user accounts, FERPA review, retention policy, or institutional audit logging.
- It does not have a reviewed student-data privacy policy.
- It does not anonymize all free-text input; students could type personal information.

## Recommended setting for a public demo

Use:

```text
LOG_QUERIES=off
```

Then avoid collecting identifiable research-query logs during a general demo.

## Questions for technical staff

- Should student research queries be logged at all?
- If logs are allowed, what retention period is acceptable?
- Should logs be anonymized, aggregated, or disabled by default?
- Where should any logs live if this becomes a Wake Forest service?
- What language should be shown to students about AI use and data handling?
