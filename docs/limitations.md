# Current Prototype Limitations

- No institutional login, SSO, student account, entitlement check, or user authorization is implemented.
- Gemini does not browse library pages, search licensed databases, retrieve full text, verify holdings, or produce an exhaustive evidence synthesis.
- Public Primo lookup is best effort and does not use an institution-issued API key.
- Crossref is public bibliographic metadata, not confirmation of library access, peer-review status, or topical relevance.
- OpenAlex OA status and location metadata are provider reports, not a new entitlement check or blanket reuse permission. The app does not retrieve or summarize linked full text.
- Book location and availability are a point-in-time public Primo response and must be confirmed in the record before a shelf visit or request.
- Named librarian records are public-directory-checked prototype configuration unless explicitly marked librarian-approved, and stale/invalid records fall back to Ask ZSR.
- Scite MCP and OA full-text summaries are not implemented. The repository has no selected software license and is not represented as open source.
- Open Library cover images are optional cosmetic metadata.
- Resource capabilities, ownership, review dates, and links remain local prototype configuration until librarians approve them.
- The WFU institution profile is a prototype record, not formal approval. The Duke profile is an unconfigured and unapproved template.
- Browser-local workspaces are not encrypted by the app, backed up, synced, or suitable for shared-device confidentiality.
- Lightweight server-log redaction is not de-identification. Privacy approval and a student notice do not yet exist.
- Automated tests do not replace librarian relevance scoring, assistive-technology testing, penetration testing, load testing, or measured student outcomes.
- The Render Blueprint does not guarantee the currently circulated hostname. URL continuity depends on deploying to the existing service.
- The application is not yet an official library service and has no institutional support commitment.
