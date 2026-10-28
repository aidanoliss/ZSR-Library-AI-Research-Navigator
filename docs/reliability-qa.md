# Reliability QA

## Covered automatically

The main test suite now covers:

- empty, malformed, non-user, oversized, and overlong chat requests
- normalization of model-visible history and assignment/planner context limits
- independent topic changes that must not inherit an earlier topic
- incomplete or failed streaming responses with one buffered retry
- unrecovered stream and buffered failures with a transparent local-search fallback
- zero-result source responses that do not invent citations
- Primo relevance filtering, record deduplication, polluted metadata cleanup, and Crossref disclosure
- duplicate search suppression across database cards, search terms, fallbacks, and secondary paths
- server-side resource metadata and URL-shape validation
- Primo API guest/institutional profile separation, documented Ex Libris authentication, and guest-data exclusion from student results

The two Node server entry points now use the same `server/chatRequest.js` parser, so request validation cannot drift independently.

## Verified baseline

On September 2, 2026, in the current working tree:

- `npm test` passed 202/202 tests.
- The strict pilot evaluation passed 47/47 cases and 893/893 automated checks.
- `/api/health` returned `ok: true`.
- `/api/pilot/status` confirmed query logging and handoff contact storage are off by default.
- An empty `/api/chat` request returned a bounded user-facing validation error without crashing the server.
- The production build completed successfully.
- The resource audit found no technical registry errors. All 31 configured resources still require librarian review and an assigned maintenance owner before institutional production use.

## Manual failure drills

Run these before a staff demo:

1. Start without `GEMINI_API_KEY`. Confirm `/api/health` loads and chat shows the actionable missing-key message.
2. Interrupt the provider after a stream begins. Confirm the client retries once and never shows a partial answer as complete.
3. Set `PRIMO_LIVE=off`. Confirm named database routes and search strings still render.
4. Search a niche topic with no catalog matches. Confirm the interface says that no verified records were returned.
5. Send 41 turns or a message over 2,000 characters. Confirm the server returns a bounded 4xx response without crashing.
6. Change from one complete topic to an unrelated topic in the same chat. Confirm the second plan contains no terms from the first topic.

## Remaining reliability work

- Provider quota and sustained-load testing have not been completed.
- Render free-tier cold starts can delay the first request.
- Public Primo and Crossref lookups remain best-effort external dependencies.
- The official Primo adapter is contract-tested but has not completed a live guest-sandbox handshake because no guest API key is configured locally. It cannot be tested against WFU metadata until ZSR supplies an approved read-only institutional profile.
- There is no institutional uptime, alerting, or incident owner.
