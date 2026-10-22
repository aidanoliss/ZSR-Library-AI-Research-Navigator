# Field-Level Data Inventory

This inventory describes application fields and their default destinations. It is a technical map, not an institutional privacy determination. Operators should verify deployed environment variables before every pilot.

## Browser-local fields

| Data | Example fields | Location | Leaves browser automatically? | Deletion / retention |
| --- | --- | --- | --- | --- |
| Draft composer | Current unsent topic text | Browser `localStorage` | No | Replaced as the draft changes; removable through browser site-data controls |
| Chat sessions | Session ID, title, mode, source-access scope, response style, subject focus, messages, timestamps, pinned/folder state | Browser `localStorage`, up to 60 sessions in the current client | Submitted conversation turns and selected scope are sent when the student sends the next chat request | No server sync; removable in the interface where offered or through browser site-data controls |
| Research workspace | Assignment brief, “use in AI requests” choice, saved paths/results/searches, notes, citation details, search status/history | Stored inside the browser-local session | Assignment constraints leave the browser only when the student enables their use in AI requests; workspace content enters the email draft only after handoff | No remote backup; browser-controlled retention |
| Folder labels | Folder ID and student-created name | Browser `localStorage` | No | Browser-controlled retention |
| Active session | Session ID | Browser `localStorage` | No | Removed when the session is cleared or site data is deleted |
| Librarian QA access code | Operator-entered bearer token | React component memory for the authorization request | Sent only to `/api/admin/summary` after explicit submit | Cleared after the request or when the panel locks; never written to browser storage or exports |

Browser `localStorage` is origin-scoped but is not application-level encryption. Anyone with access to the same browser profile may be able to inspect it.

## Chat request and provider fields

| Recipient / processor | Fields sent | Purpose | Default storage controlled here? | Important boundary |
| --- | --- | --- | --- | --- |
| Node application server | Normalized user/assistant message history, selected mode, source-access scope, response style, subject focus, and enabled assignment/planner context | Validate request, construct ResearchSpec, route resources, choose discovery lanes, and build the model prompt | Query logging defaults off | No institutional identity or SSO field is attached by the app |
| Google Gemini API | Conversation content retained by the active-context filter, selected mode/style/focus instructions, and compact curated resource metadata | Generate structured research-orientation prose | Provider handling is governed by the configured Google API account and terms, not browser `localStorage` settings | Gemini is not given a library login and does not browse library links |
| WFU public Primo surface | Compiled discovery query plus public Primo view/scope parameters | Return bibliographic metadata leads | No application-side response persistence by default | Not an official credentialed Primo API integration |
| Crossref | Compiled article-compatible query, row/select/filter parameters, and a generic application user-agent | Bibliographic fallback when appropriate discovery results are sparse | No application-side response persistence by default | Crossref does not confirm ZSR access or holdings |
| OpenAlex | First compiled discovery query, OA/retraction filters, result limit, and server-side API key | Optional open-access metadata lane when the student selects OA or combined scope | Short process-local metadata cache; no application-side durable response persistence | The key is never returned to the browser; OpenAlex metadata is CC0, while linked works retain their own rights; no full text is retrieved |
| Open Library Covers | ISBN embedded in a cover-image URL | Optional cover image | Browser/cache behavior is controlled by the browser and provider | The cover request is separate from chat text and is cosmetic |
| External library/database/help sites | URL and query parameters only after the student opens a link | Continue research outside the prototype | Controlled by the destination site | The app does not authenticate the student into those sites |

The server stores `GEMINI_API_KEY`, optional `OPENALEX_API_KEY`, and optional `ADMIN_TOKEN` only as deployment environment variables. They must not be returned by health/status endpoints, embedded in frontend assets, logged, or included in release evidence.

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


### Research guidance additions (October 2026)

- **Evidence notebook:** bounded student-authored claim/passage/location/limitations entries on saved sources. Stored with the existing local workspace, included in JSON/Markdown/RIS exports, and excluded from AI request context. Editing invalidates student confirmation; imports require a fresh check. Confirmation is a student attestation, not independent verification.
- **Relevance feedback:** `zsr-source-feedback-v1` in browser local storage (up to 500 bounded entries), recording the student-selected reason, optional note, request, criteria, and source identity. No automatic feedback transmission. The user reviews and downloads JSON to share manually. Private mode shares an in-memory queue across searches, cleared on reload or when the mode remounts. The queue has remove and clear controls.
- **Citation exploration:** `/api/explore-sources` receives a bibliographic seed, current research specification, relationship type, and access scope. It uses the same request limits and concurrent-request budget as chat. OpenAlex uses the existing server-side key when configured; Crossref public metadata supplies related title searches and DOI-linked references otherwise. No AI call or full text retrieval. Returned source relationships and actual query/filter observations are retained in the local Searches history and workspace exports.
- **Scope preferences:** separate preferred population/location/method fields are stored in the reviewed research specification and search history. They can influence ranking but do not silently become required filters.


### Source-bound Research chat (October 2026)

Research chat sends the latest question, up to ten bounded prior chat messages, research-topic context, and up to six selected Navigator evidence envelopes to `/api/research-chat`. An assignment brief is optional and controlled in the chat view. Reading notes, evidence notebooks, and unselected saved sources are not included. The server verifies an HMAC signature and 24-hour expiry, then sends only authenticated metadata/abstract excerpts plus the bounded task context to the existing Gemini service. It does not expose its credential or use external search tools. The endpoint uses existing request-size, rate, origin, and concurrent-work controls and adds no server-side chat-history store. Provider handling remains subject to the configured Gemini service.

Drafts, source selections, attached public records, and cited replies persist with the browser's research session. Private sessions keep them in memory and clear on reload or mode exit. Signed envelopes contain public bibliographic/abstract data, not credentials; they may survive in saved-source JSON and expire after 24 hours. Keys use `RESEARCH_CHAT_SIGNING_KEY` when configured, otherwise a context-separated derivation of the existing Gemini key, otherwise a process-local random key. Records must be retrieved again after expiry or an incompatible signing-key change. No full text is acquired.

Quotation and numeric checks reject unsupported identities, modified passages, incomplete sentence context, and numbers absent from the displayed quote. They do not prove that an AI interpretation follows from the quote; semantic misgrounding remains possible and is labeled in the interface.


### Planning and evidence chat (October 21 update)

Research chat sends a submitted question, bounded prior messages, enabled assignment context, and selected signed source envelopes to the application server. Common planning tasks are answered there with procedural templates and do not call Gemini. Evidence discussions send the bounded question/context and usable selected abstracts to Gemini. A later evidence discussion can include earlier planning messages in its bounded context. No-source planning does not require a source token; forged records still fail verification. Valid expired records are omitted only for procedural planning and require refreshing for evidence discussions. Normal/private browser retention is unchanged.


### Visible provenance and scope checks (October 21)

Explicit chat-copy and chat/research-plan export actions append a visible attribution footer outside original source quotations. No hidden watermark, student identity, or copy interception is added. Scope rules use the submitted request and bounded existing user-message context on the application server; no additional classifier provider, telemetry, or detector storage is introduced. A later evidence call may still include earlier submitted messages within existing context limits. Private-session behavior is unchanged, and downloaded exports remain on disk.


### Source-free research coaching (2026-10-21)

Research chat can now provide procedural coaching without attachments. Its Gemini request contains the current question, up to ten bounded prior messages (12,000 characters total), topic, and the assignment brief only when enabled. It also includes seven developer-curated summaries of official ZSR research guides. The coaching request does not automatically include selected source metadata/abstracts, signed envelopes, saved notebooks, or unselected sources. Prior messages remain untrusted context and can contain text the student supplied; this is disclosed before sending. Questions about attached study findings retain the authenticated abstract-only route described above.

The guide snapshot is versioned in `config/researchCoachKnowledge.js`; it is neither a live website lookup nor librarian approval. Guide definitions are rendered from server-curated summaries, while generated procedural suggestions remain fallible. Provider failure or rejected output is labeled as a planning fallback. Chat-only sessions now save and reopen using the same normal/private browser storage rules. No new analytics, server history store, user profile, or chat-export control was added.
