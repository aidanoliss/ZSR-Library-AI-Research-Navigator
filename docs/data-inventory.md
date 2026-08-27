# Field-Level Data Inventory

This inventory describes application fields and their default destinations. It is a technical map, not an institutional privacy determination. Operators should verify deployed environment variables before every pilot.

## Browser-local fields

| Data | Example fields | Location | Leaves browser automatically? | Deletion / retention |
| --- | --- | --- | --- | --- |
| Draft composer | Current unsent topic text | Browser `localStorage` | No | Replaced as the draft changes; removable through browser site-data controls |
| Chat sessions | Session ID, title, mode, response style, subject focus, messages, timestamps, pinned/folder state | Browser `localStorage`, up to 60 sessions in the current client | Submitted conversation turns are sent when the student sends the next chat request | No server sync; removable in the interface where offered or through browser site-data controls |
| Research workspace | Assignment brief, “use in AI requests” choice, saved paths/results/searches, notes, citation details, search status/history | Stored inside the browser-local session | Assignment constraints leave the browser only when the student enables their use in AI requests; workspace content enters the email draft only after handoff | No remote backup; browser-controlled retention |
| Folder labels | Folder ID and student-created name | Browser `localStorage` | No | Browser-controlled retention |
| Active session | Session ID | Browser `localStorage` | No | Removed when the session is cleared or site data is deleted |
| Librarian QA access code | Operator-entered bearer token | React component memory for the authorization request | Sent only to `/api/admin/summary` after explicit submit | Cleared after the request or when the panel locks; never written to browser storage or exports |

Browser `localStorage` is origin-scoped but is not application-level encryption. Anyone with access to the same browser profile may be able to inspect it.

## Chat request and provider fields

| Recipient / processor | Fields sent | Purpose | Default storage controlled here? | Important boundary |
| --- | --- | --- | --- | --- |
| Node application server | Normalized user/assistant message history, selected mode, response style, subject focus, and enabled assignment/planner context | Validate request, construct ResearchSpec, route resources, build the model prompt | Query logging defaults off | No institutional identity or SSO field is attached by the app |
| Google Gemini API | Conversation content retained by the active-context filter, selected mode/style/focus instructions, and compact curated resource metadata | Generate structured research-orientation prose | Provider handling is governed by the configured Google API account and terms, not browser `localStorage` settings | Gemini is not given a library login and does not browse library links |
| WFU public Primo surface | Compiled discovery query plus public Primo view/scope parameters | Return bibliographic metadata leads | No application-side response persistence by default | Not an official credentialed Primo API integration |
| Crossref | Compiled article-compatible query, row/select/filter parameters, and a generic application user-agent | Bibliographic fallback when appropriate discovery results are sparse | No application-side response persistence by default | Crossref does not confirm ZSR access or holdings |
| Open Library Covers | ISBN embedded in a cover-image URL | Optional cover image | Browser/cache behavior is controlled by the browser and provider | The cover request is separate from chat text and is cosmetic |
| External library/database/help sites | URL and query parameters only after the student opens a link | Continue research outside the prototype | Controlled by the destination site | The app does not authenticate the student into those sites |

The server stores `GEMINI_API_KEY` and optional `ADMIN_TOKEN` only as deployment environment variables. They must not be returned by health/status endpoints, embedded in frontend assets, logged, or included in release evidence.

## Optional server-side JSONL records

The canonical server can write local JSONL files under `data/`. Defaults below are code defaults; deployment settings must be checked separately.

| Record | Default fields | Optional text fields | Enabling flags | Retention controls |
| --- | --- | --- | --- | --- |
| Query event | Timestamp, `type=query`, whether a topic was provided, matched resource IDs, blocked flag | Redacted topic | `LOG_QUERIES=on`; topic text additionally requires `LOG_QUERY_TEXT=on` | `LOG_RETENTION_DAYS` (default 30, capped 365) and `LOG_MAX_RECORDS` (default 1000) |
| Feedback event | Timestamp, rating, whether note/topic was provided | Redacted note and/or topic | Feedback defaults enabled unless `LOG_FEEDBACK=off`; text requires `FEEDBACK_STORE_TEXT=on`; topic requires `FEEDBACK_STORE_TOPIC=on` | Same retention and record caps |
| Handoff event | Timestamp, mode, response style, presence booleans, result count, matched resource IDs, librarian route IDs | Redacted topic, note, search terms, result metadata, resource metadata, routes, and optionally contact | Handoff metadata defaults enabled unless `LOG_HANDOFFS=off`; detail requires `HANDOFF_STORE_DETAIL=on`; contact additionally requires `HANDOFF_STORE_CONTACT=on` | Same retention and record caps |

Lightweight redaction replaces common email addresses, US-style telephone numbers, and long numeric strings. It is not de-identification and cannot reliably detect names, health information, education records, quoted private text, or every identifier.

## Recommended public-pilot defaults

```text
LOG_QUERIES=off
LOG_QUERY_TEXT=off
LOG_FEEDBACK=on
FEEDBACK_STORE_TEXT=off
FEEDBACK_STORE_TOPIC=off
LOG_HANDOFFS=on
HANDOFF_STORE_DETAIL=off
HANDOFF_STORE_CONTACT=off
LOG_RETENTION_DAYS=30
LOG_MAX_RECORDS=1000
```

Before an institutional pilot, the institution must decide whether even metadata-only feedback and handoff records are allowed, where they may be stored, who may read them, the deletion process, incident response, and the required student notice.
