# Research Provider Integration Roadmap

This document turns the Vanderbilt feedback into a universal implementation sequence. It is a technical and governance plan, not a vendor commitment or institutional approval.

## Implemented now

### RIS export

The client can export one returned source or a complete visible result lane as `.ris`. Export uses only metadata already returned by Primo, Crossref, or OpenAlex; missing authors, dates, identifiers, and publication fields stay missing. No citation is generated from prose and no provider request occurs during export.

### Named subject librarian

`config/librarianDirectory.js` contains institution-owned directory records with effective dates, review dates, owner, source, contact routes, and approval state. `config/librarianRoutes.js` deterministically selects only active, valid records. A model cannot supply or override a person-level contact. Invalid, stale, or unmatched records fall back to the generic service route and Ask ZSR.

The current names were checked against public ZSR pages but remain explicitly `librarianApproved: false` until staff approve them for this prototype.

### Book location and request guidance

Books mode requests Primo delivery metadata. Exact provider fields may populate location, call number, and status “when checked.” The UI always links to the live record, warns that status can change, and provides ZSR Delivers for borrowing/request help. The app does not use “rent,” promise a hold, or invent shelf data.

### OpenAlex open-access lane

OpenAlex is an isolated metadata provider and appears as a separate lane from library results. It runs only when:

1. the student selects `Library + open access` or `Open access`; and
2. `OPENALEX_API_KEY` is configured server-side; and
3. `OPENALEX_LIVE` is not `off`.

The provider filters retractions and weak topic matches, enforces provider-reported OA status, accepts only safe HTTPS locations, and returns exact license/version/host provenance when supplied. It never downloads full text. OpenAlex metadata is CC0, but linked works keep their own copyright and licenses. Official API overview: <https://docs.openalex.org/how-to-use-the-api/api-overview>.

## Gated later work

### OA full-text summaries

Status: `gated-not-implemented`.

A pilot must not begin until all of these exist:

- a named institutional owner and written pilot approval;
- an exact-location, exact-version rights decision before every retrieval;
- an allowlist at least as strict as CC BY, CC0, or public-domain, with legal/institutional confirmation;
- provider, cache, log, and retention privacy rules;
- bounded retrieval with content-type/size checks and no paywall bypass;
- a citation-preserving summary format that distinguishes source text, model synthesis, and uncertainty;
- librarian scoring for faithfulness, omissions, citation traceability, and student misuse.

The current `summaryEligible` field is only conservative metadata for evaluating a future pilot. It does not activate retrieval or claim that institutional approval exists.

### Scite MCP

Status: `gated-not-integrated`.

Before adding <https://scite.ai/mcp>, confirm:

- Vanderbilt/Wake subscription rights and permitted prototype use;
- OAuth/account ownership and whether student queries or citations reach Scite;
- vendor retention, training, and subprocessor terms;
- the exact value proposition beyond existing metadata, such as citation-context or retraction checks;
- a narrow librarian-owned test set and cost/rate limits.

Scite should become a separate evidence/context provider, not a hidden replacement for catalog or open-access discovery.

### Repository license

Status: `decision-pending`.

Do not add a license merely to make the repository easier to copy. Decide whether the goal is source-available review, permissive reuse, copyleft, dual licensing, or a future commercial/institutional license. Creative Commons recommends using a software license for software rather than a CC content license: <https://creativecommons.org/faq/#can-i-apply-a-creative-commons-license-to-software>.

Until a license is chosen, public visibility is not described as open-source permission.

## Universal configuration contract

The feature code is provider- and institution-boundary aware rather than Duke-specific:

- source scope: `library`, `both`, or `open-access`;
- institution-owned librarian directory with generic fallback;
- library fulfillment supplied only by the configured discovery provider;
- OpenAlex key and calls remain server-side;
- future provider gates are visible in pilot status and cannot be enabled by client input;
- no Duke or Vanderbilt contacts, credentials, branding, or resource claims are included without an approved institution configuration.
