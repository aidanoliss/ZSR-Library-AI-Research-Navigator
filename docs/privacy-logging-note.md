# Privacy and Logging Note

## Current behavior

- Gemini API calls happen from the Node API server, not the browser.
- `GEMINI_API_KEY` should live only in `.env` locally or server-side environment variables in deployment.
- The app has local JSONL logging support for query, feedback, and handoff analysis in `data/`.
- Query logging is disabled by default. Enable it only with `LOG_QUERIES=on`.
- Query, feedback, and handoff text is lightly redacted for emails, phone numbers, and long numeric identifiers before it is written locally.
- Feedback logging records thumbs up/down/gap feedback when a student uses those controls.
- Librarian handoff logging records the topic, note, search terms, catalog leads, and matched resources only after the student explicitly uses the handoff control.
- Handoff contact details are not retained unless `HANDOFF_STORE_CONTACT=on`.

## Current limitations

- This prototype does not implement WFU authentication.
- It does not provide user accounts, FERPA review, retention policy, or institutional audit logging.
- It does not have a reviewed student-data privacy policy.
- It does not provide full de-identification; students could still type personal information that is not caught by lightweight redaction.

## Recommended setting for a public demo

Use:

```text
LOG_QUERIES=off
HANDOFF_STORE_CONTACT=off
```

Then avoid passive research-query logs and avoid retaining handoff contact details during a general demo.

## Questions for technical staff

- Should student research queries be logged at all?
- If logs are allowed, what retention period is acceptable?
- Should logs be anonymized, aggregated, or disabled by default?
- Where should any logs live if this becomes a Wake Forest service?
- What language should be shown to students about AI use and data handling?
