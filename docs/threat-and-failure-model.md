# Threat and Failure Model

This document separates current controls from pilot gates. It is not a penetration test, privacy approval, or security certification.

## Assets and trust boundaries

Protected assets include the Gemini API key, student-entered research text, browser-local workspaces, feedback/handoff records, the approved resource registry, evaluation evidence, and the stability of the circulated public URL.

Trust boundaries exist between:

1. the student and browser storage;
2. the browser and Node API;
3. the Node API and Gemini;
4. the Node API and public Primo/Crossref services;
5. the browser and external library/database/help links;
6. prototype administrators and any retained pilot records;
7. local configuration and an institution-approved release.

## Threat register

| Threat | Consequence | Current or implemented control | Remaining pilot gate |
| --- | --- | --- | --- |
| Prompt injection asks for arbitrary links or invented citations | Unsafe or fabricated research route | Curated allowlist, structured response validation, deterministic source contract | Red-team review and regression expansion |
| Loaded or stigmatizing premise | Harmful framing or false certainty | Premise-checking prompt rules, controversial-question suite, orientation label | Human content review across disciplines and identities |
| Wrong source mode | Articles returned for books/data/news/primary/legal requests | Explicit mode contracts, capability filtering, mode-order evaluation matrix | Librarian approval of capabilities and ranking thresholds |
| Weak or ambiguous match | Generic database padding presented as confidence | Safe-failure metadata, clarification/refinement path, librarian handoff | Define institution-approved handoff threshold |
| Malicious or oversized API request | Resource exhaustion or provider spend | Request length/turn/body limits, rate limiting, provider timeout/retry/circuit controls | Load test and production proxy configuration review |
| Public read access to pilot records | Research-topic or feedback exposure | Administrative read routes must be disabled by default or protected with server-side authorization | Institutional identity/access design and access-log review |
| Cross-origin abuse | Third-party sites invoke API from a victim browser | Origin allowlist and same-origin defaults | Confirm deployed hostnames and proxy/CDN behavior |
| Secret disclosure | Provider credential theft | Server-side environment variable; browser calls only the app API | Secret scanning, rotation plan, least-privilege provider account |
| Excess retention | Research interests become an unintended record | Query text off by default, separate detail/contact flags, caps and time-based pruning | Approved retention schedule, deletion procedure, storage location |
| Browser-local exposure | Shared-device user sees prior research | Origin-scoped `localStorage`, no institutional sync | Clear-data control, shared-device guidance, accessibility review |
| Dependency or deployment compromise | Application/code execution risk | Lockfile, reproducible build command, release evidence | Dependency remediation, security scanning, reviewed CI/CD |
| Configuration drift | Evaluated behavior differs from deployed behavior | Configuration version, deterministic plan hash, config diff and release evidence scripts | Sign-off tied to deployed commit and rollback artifact |

## Failure behavior

| Failure | Student-visible behavior required | Must not happen |
| --- | --- | --- |
| Gemini timeout, quota, malformed response, or open circuit | Deterministic plan remains available with a plain explanation that generated prose is unavailable | Canned topical answer, fabricated result, infinite spinner |
| Primo timeout or zero relevant records | Keep database routes and searches; identify that no verified catalog leads were returned | Label route suggestions as retrieved citations |
| Crossref timeout or sparse metadata | Continue without Crossref; preserve provider labels on any existing leads | Treat Crossref as holdings/full-text confirmation |
| Open Library cover failure | Hide or replace the image without changing ranking | Suppress an otherwise usable record |
| No eligible resource for selected mode | Ask for one useful clarification or route to a librarian; expose safe-failure reason | Fill the list with unrelated generic resources |
| Configuration validation failure | Block release/promotion and keep the last known approved configuration | Partially apply an invalid institution profile |
| Evaluation regression | Mark release “review required”; show failed case/check IDs | Describe automated checks as librarian approval |
| Existing Render service unavailable | Use staging/local demonstration fallback and report outage honestly | Create a new public hostname and silently replace the circulated URL |

## Release gates

- All deterministic, mode, metamorphic, loaded-question, reliability, accessibility-contract, and security tests pass.
- Release evidence identifies commit, configuration version, plan hashes, and dirty-tree state.
- A librarian completes relevance and search-quality scoring; blank ratings remain visibly pending.
- Privacy, accessibility, and application-security owners approve their separate scopes.
- Production smoke checks run against the existing service and rollback is tested.
- No Duke profile is activated until Duke supplies and approves all operational fields.
