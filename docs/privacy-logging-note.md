# Privacy and Logging Note

## Current behavior

- Gemini API calls happen from the Node API server, not the browser.
- `GEMINI_API_KEY` should live only in `.env` locally or server-side environment variables in deployment.
- The app has local JSONL logging support for query, feedback, and handoff analysis in `data/`.
- Query logging is disabled by default. `LOG_QUERIES=on` enables aggregate events; raw topic text additionally requires `LOG_QUERY_TEXT=on`.
- Feedback metadata logging defaults on. Note text requires `FEEDBACK_STORE_TEXT=on`, and topic text requires `FEEDBACK_STORE_TOPIC=on`.
- Handoff metadata logging defaults on after the student explicitly submits a handoff. Topic, note, searches, result metadata, and routes require `HANDOFF_STORE_DETAIL=on`.
- Handoff contact details require both `HANDOFF_STORE_DETAIL=on` and `HANDOFF_STORE_CONTACT=on`.
- Any enabled text is lightly redacted for common emails, US-style phone numbers, and long numeric identifiers before local storage. This is not de-identification.
- Local JSONL records are pruned using `LOG_RETENTION_DAYS` (default 30, maximum 365) and `LOG_MAX_RECORDS` (default 1000).
- Chat sessions, folders, assignment briefs, saved research-trail items, and search history are stored in browser `localStorage` and are not synced to ZSR or a user account.
- When `Use in AI requests` is enabled, populated assignment constraints are sent to the server and Gemini as request context. The governed planner may also normalize submitted constraints into the ResearchSpec; unsent workspace fields remain browser-local.
- Research-workspace details are included in the Ask ZSR email draft only after the student explicitly opens the librarian handoff. They are not added to the local handoff log.

## Current limitations

- This prototype does not implement WFU authentication.
- It does not provide user accounts, FERPA review, retention policy, or institutional audit logging.
- It does not have a reviewed student-data privacy policy.
- It does not provide full de-identification; students could still type personal information that is not caught by lightweight redaction.
- Browser-local research work is not encrypted, remotely backed up, or portable across devices.

## Recommended setting for a public demo

Use:

```text
LOG_QUERIES=off
LOG_QUERY_TEXT=off
LOG_FEEDBACK=on
FEEDBACK_STORE_TEXT=off
FEEDBACK_STORE_TOPIC=off
LOG_HANDOFFS=on
HANDOFF_STORE_DETAIL=off
HANDOFF_STORE_CONTACT=off
```

Then avoid passive research-query logs and avoid retaining handoff contact details during a general demo.

## Questions for technical staff

- Should student research queries be logged at all?
- If logs are allowed, what retention period is acceptable?
- Should logs be anonymized, aggregated, or disabled by default?
- Where should any logs live if this becomes a Wake Forest service?
- What language should be shown to students about AI use and data handling?
