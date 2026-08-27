# Official ZSR Integration Proposal

## Goal

Replace prototype-only metadata and best-effort public lookups with approved ZSR-owned services while preserving the current fail-safe behavior.

## Current boundary

The browser calls only the Node API. Gemini credentials remain server-side. The server currently combines:

- librarian-editable local resource metadata in `config/researchAgent.js`
- best-effort public Primo discovery requests
- optional Crossref bibliographic metadata when ZSR discovery is sparse
- public A-Z, research-guide, Ask ZSR, and full-text workflow links

The prototype does not have authenticated Primo, LibGuides, LibKey, proxy, identity, or course-system access.

## Proposed integrations

### 1. Primo Search API

ZSR provides an approved endpoint, API key, allowed scopes, request limits, and expected result schema. The server maps the response into the existing source-lead contract:

```text
title, authors, date, source type, subjects, abstract excerpt,
DOI/PMID, record URL, thumbnail, provider, access status
```

Only provider-supplied abstracts may be excerpted. The app must not generate source summaries from titles or incomplete metadata. If the API fails or returns no relevant records, the UI keeps the current explicit zero-result state.

### 2. LibGuides / A-Z resource feed

Replace hand-maintained database entries with a scheduled import or reviewed export. Minimum fields:

```text
stable id, display name, description, subject areas, source types,
best-for guidance, limitations, access URL, authentication note,
search filters, owner, review status, last reviewed date
```

Imported data should be validated in a staging step. Deleted or renamed databases should be reported, not silently removed from production recommendations.

### 3. LibKey / OpenURL

ZSR confirms the Wake Forest LibKey/Third Iron library ID and preferred DOI/PMID/OpenURL workflow. The app should show an access action only when an identifier is present and continue to say that access must be confirmed.

### 4. Librarian directory

ZSR supplies an approved subject-to-contact mapping with owner, unit, public contact route, and general fallback. The app should recommend a person or department only when the mapping is institutionally maintained.

## Privacy and security

- Keep provider and library credentials server-side.
- Keep query logging off unless ZSR approves notice, purpose, retention, deletion, and access controls.
- Do not send browser-local folders or research trails to ZSR without an explicit handoff action.
- Use institutional secret storage, dependency monitoring, rate limits, structured error logs, and a documented incident owner.
- Decide whether authentication is needed before adding user synchronization or course context.

## Delivery phases

1. **Read-only staging:** connect approved Primo and resource-feed credentials in a non-public environment.
2. **Contract validation:** replay the librarian evaluation set and compare API-backed results with the prototype baseline.
3. **Librarian review:** score path relevance, query quality, catalog precision, and fallback safety.
4. **Limited pilot:** enable only approved subjects, privacy settings, and support routes.
5. **Production decision:** proceed only after ownership, accessibility, security, records, and support gates are signed off.

## Inputs needed from ZSR

- Primo API endpoint, key process, scope, quotas, and support contact
- LibGuides/A-Z export method and metadata owner
- LibKey/Third Iron identifier and preferred access language
- approved citation-guide and Ask ZSR URLs
- subject-librarian mapping owner
- privacy, retention, accessibility, branding, hosting, and incident-response decisions
