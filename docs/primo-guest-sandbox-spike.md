# Primo Guest-Sandbox Contract Spike

## Purpose

Use the Ex Libris guest sandbox to validate the adapter before asking ZSR for institutional access. The spike can prove:

- the API key is accepted;
- the Search API request has valid view, tab, scope, query, limit, and sort parameters;
- JSON/PNX records normalize into the application's source contract;
- timeouts, non-2xx responses, empty results, and malformed metadata fail safely;
- the key remains server-side; and
- guest records are visibly marked as demo data.

It cannot prove Wake Forest holdings, licensed access, WFU view/scope values, result relevance against WFU collections, IP-restricted behavior, production quotas, or institutional approval.

## Ex Libris setup

1. Create an Ex Libris Developer Network guest account.
2. Under **Build -> My APIs**, create an application/API key.
3. Add Primo Search permission for the **Guest Sandbox** with read-only access.
4. Keep the key in `.env` locally. Never put it in a browser variable, screenshot, issue, or commit.

Official references:

- [Primo REST API getting started](https://developers.exlibrisgroup.com/primo/apis/)
- [Primo Search API](https://developers.exlibrisgroup.com/primo/apis/search/)
- [Guest Search API walkthrough](https://developers.exlibrisgroup.com/blog/understanding-and-using-the-primo-search-api-as-a-guest-in-the-developer-network/)

## Local guest profile

Add these values to `.env`:

```text
PRIMO_API_PROFILE=guest
PRIMO_API_ENDPOINT=https://api-na.hosted.exlibrisgroup.com/primo/v1/search
PRIMO_API_KEY=<your guest-sandbox key>
PRIMO_API_RECORD_HOST=https://na01.primo.exlibrisgroup.com
PRIMO_API_VID=API_GUEST_INST:API_GUEST_INST
PRIMO_API_INST=API_GUEST_INST
PRIMO_API_CATALOG_TAB=LibraryCatalog
PRIMO_API_CATALOG_SCOPE=MyInstitution
PRIMO_API_ARTICLES_TAB=LibraryCatalog
PRIMO_API_ARTICLES_SCOPE=MyInstitution
PRIMO_API_USE_FOR_DISCOVERY=off
```

Run:

```bash
npm run verify:primo -- --query "cloud computing" --mode books
```

The report must say `demoData: true`, `eligibleForStudentResults: false`, and identify the provider as **Ex Libris guest sandbox demo**. A successful call validates the adapter contract only.

## Institutional staging profile

ZSR must supply or confirm the endpoint, API plan/key, view, institution, tabs, scopes, record host, quotas, and support owner. Configure those values first with:

```text
PRIMO_API_PROFILE=institutional
PRIMO_API_USE_FOR_DISCOVERY=off
```

Run the verifier and the librarian evaluation set in a private staging service. Turn `PRIMO_API_USE_FOR_DISCOVERY=on` only after all of these are true:

- the profile is institutional, not guest;
- ZSR has approved the key and exact request parameters;
- keys are stored only in server-side secret storage;
- librarians have scored results from the WFU endpoint;
- access and availability language has been reviewed;
- logging, retention, privacy notice, and support ownership are approved; and
- rollback to `PRIMO_API_USE_FOR_DISCOVERY=off` has been tested.

## Handoff request to ZSR

The narrow request is:

> The Search API adapter, response parser, timeout handling, and demo-data isolation are implemented and contract-tested. Could ZSR technical staff provide a read-only staging key and confirm the WFU endpoint, view, tab, scope, quota, and owner so we can validate it against WFU metadata?

This is smaller than asking ZSR to build the integration, but it is not merely a five-minute key switch. WFU-specific relevance, holdings, restricted scopes, privacy, security, quota, and operational ownership still require institutional review.
