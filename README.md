# Wake Forest ZSR Library AI Research Navigator

Prototype research navigator for Wake Forest Z. Smith Reynolds Library workflows. The app helps students turn a topic into search terms, mode-specific research strategies, ZSR starting points, live source leads where available, citation guidance, and honest full-text access next steps. Source leads can be limited to the library lane, the OpenAlex open-access lane, or both; the two lanes remain visibly separate.

Topic-matched ZSR recommendations are kept separate from general discovery routes. If a matched path or live catalog list is small, the interface offers a collapsed `Other potentially helpful ZSR starting points` group without presenting those general services as additional topic matches.

This is a prototype, not a production ZSR integration. It uses Gemini through the server API, curated ZSR-style resource metadata, a best-effort live Primo lookup, Crossref bibliographic fallback where appropriate, and an optional server-keyed OpenAlex metadata lane. It does not log students into ZSR, bypass paywalls, retrieve or summarize OpenAlex-linked full text, control LibKey Nomad, or expose private keys in the browser.

Current source-workflow additions include:

- per-result and per-lane RIS export using only returned citation metadata
- deterministic named subject-librarian routing from a reviewed-window directory, with Ask ZSR fallback
- book location, call-number, and provider-reported availability guidance when Primo supplies delivery metadata
- an optional, separately labelled OpenAlex open-access metadata lane with exact license and version provenance

## Research Modes

Students can choose:

- Scholarly Articles
- Books and Background Sources
- News and Current Events
- Data and Statistics
- Primary Sources
- Legal or Policy Sources
- General Research

The selected mode affects search-term suggestions, recommended platforms, Primo/ZSR lookup behavior, source-evaluation advice, citation reminders, and next steps.

## Research Workspace

Each chat has a browser-local research workspace with:

- an optional assignment brief and course presets
- saved ZSR paths, source leads, and search strings
- source statuses, notes, and citation details
- search iteration history and result notes
- a copy/download review packet for librarian handoff

Workspace data remains in that browser unless the student explicitly prepares a librarian handoff. When the student enables assignment constraints for a request, the submitted constraints join the same normalized ResearchSpec used by deterministic planning and generated guidance.

## Local Demo

The root folder is the canonical app/deploy path. See `docs/canonical-deploy-path.md`.

```bash
npm install
cp .env.example .env
# add GEMINI_API_KEY=... to .env
npm run build
PORT=3002 npm start
```

Open `http://localhost:3002`.

For development with hot reload:

```bash
npm run dev
```

Frontend: `http://localhost:5173`  
ZSR API server: `http://localhost:3001`

## Sharing A Test Link

Do not share a `localhost` URL with Amanda unless she is on the same machine. For a live test link, deploy the app to a server that can run the Node API server and set `GEMINI_API_KEY` as a server-side environment variable. Render, Railway, Fly.io, or a similar Node host is the simplest path for this Node + Vite setup.

Private keys must stay server-side. The browser should only call `/api/chat` or `/api/chat/stream`.

Suggested demo framing:

- This is a student-built prototype, not an official ZSR service unless ZSR approves it.
- It uses Gemini through the Node API server, local librarian-editable ZSR resource configs, public link-outs, and best-effort catalog examples.
- It does not provide authenticated database access, bypass paywalls, or confirm Wake Forest full-text availability.
- ZSR librarians can review or replace the local resource config before any broader pilot.

Live demo readiness checklist:

- Set `GEMINI_API_KEY` only on the server host.
- To enable the open-access lane, set `OPENALEX_API_KEY` only on the server host. Without it, the interface shows a safe disabled state and sends no OpenAlex request.
- Confirm `.env` is not committed and no API key appears in browser-visible files.
- For Render, deploy as a Web Service with build `npm ci --include=dev && npm run build`, start `npm start`, `HOST=0.0.0.0`, and `PORT=10000`.
- Run `npm run build` before sharing.
- Keep `LOG_QUERIES=off` and `HANDOFF_STORE_CONTACT=off` for the first shared demo unless ZSR approves retention.
- Use Render/Railway/Fly for the current Node API shape; static-only Netlify/Vercel hosting will need a separate API deployment or serverless adapter.
- Keep the prototype disclaimer visible in the demo and in any shared recording.

Pilot-hardening commands:

```bash
npm run qa:pilot
npm run eval:pilot
npm run eval:pilot:strict
npm run audit:resources
npm run audit:resources:live
```

The automated librarian evaluation checks regression-level routing and query safeguards. It does not replace human librarian scoring or confirm database licensing.

Additional release evidence commands:

```bash
npm run eval:matrix
npm run evidence:release
node scripts/build-release-evidence.mjs --strict --write /tmp/zsr-release-evidence.md
node scripts/build-release-evidence.mjs --strict --require-clean
npm run diff:institution
node scripts/diff-institution-config.mjs wfu-zsr-prototype duke-illustrative-unapproved --json
```

The release report deliberately distinguishes automated passage from librarian, privacy, accessibility, security, and institutional approval.

## Institution Profiles

`config/institutionProfile.js` defines and validates institution-owned discovery parameters, resource-registry pointers, help/citation/full-text routes, branding, and privacy defaults for review, release evidence, and configuration diffs. The current WFU runtime has not been converted into a dynamic multi-institution switch. The WFU entry describes prototype defaults and is not an institutional approval record. The Duke entry is deliberately blank and marked unapproved; it contains no invented Duke resource links, contacts, credentials, discovery parameters, or branding and cannot activate a Duke deployment.

## Library Link Configuration

Library URLs and mode definitions live in `config/libraryLinks.js`. The normalized research specification lives in `config/researchSpec.js`, source-mode and resource-capability governance lives in `config/resourceCapabilities.js`, database-specific query compilation lives in `config/queryCompiler.js`, and deterministic routing plus librarian-editable resource records live in `config/researchAgent.js`.

Values that should be confirmed with ZSR before a public pilot:

- ZSR Citations & Bibliographies: `https://guides.zsr.wfu.edu/citations`
- Zotero Research Assistant: `https://zsr.wfu.edu/research-instruction/zotero-research-assistant/`
- LibKey information page: currently points to a general ZSR research page until ZSR confirms a preferred LibKey Nomad page
- ZSR Delivers / ILL: `https://zsr.wfu.edu/delivers/ill/`
- Official Primo API endpoint/key, if ZSR wants API-backed search rather than public Primo lookup

## External Provider And MCP Boundaries

The current agentic behavior is intentionally local-config based: classify the student's need, generate better search terms, recommend likely ZSR paths, and link out to Primo, A-Z Databases, Google Scholar, LibKey Nomad, and ZSR help pages.

Do not build a full MCP server until ZSR can provide official access details. A future integration should add:

- Approved Primo API endpoint and key
- Confirmed ZSR database metadata or LibGuides export
- Wake Forest LibKey / Third Iron library ID or API details
- Librarian-reviewed citation guide URLs for APA, MLA, Chicago, and Zotero
- Logging/privacy rules approved for student research queries

OpenAlex is implemented as a metadata-only, separately labelled open-access lane. OpenAlex metadata licensing does not grant rights to a linked article or PDF. Full-text summaries remain unimplemented and gated by exact-version rights checks, privacy approval, retention rules, and librarian evaluation. Scite MCP remains unintegrated until subscription permission, OAuth/data-flow privacy, and institutional pilot ownership are confirmed. See `docs/provider-integration-roadmap.md`.

The repository deliberately has no software license yet. Public visibility alone is not represented as open-source permission.

## LibKey Nomad Support

The app gives LibKey-aware full-text guidance. If a catalog/article record exposes a DOI or PMID, the UI shows DOI/PubMed-based access actions that can work alongside LibKey Nomad. If not, it falls back to Google Scholar, ZSR search, and ZSR Delivers/help links.

This is not a LibKey API integration and does not control the browser extension.

## Optional Primo API Readiness

`server/primoApi.js` contains a future-facing service that can build Primo-compatible requests when `PRIMO_API_ENDPOINT` and `PRIMO_API_KEY` are configured. Without credentials, it falls back gracefully to current ZSR/Scholar links and the existing live Primo lookup.

## Pilot Admin And Handoff

Open `/?admin=1` to reach the restricted librarian QA gate. The client does not request protected data until an operator enters the deployment-configured access code. The server requires `Authorization: Bearer <ADMIN_TOKEN>` and denies the route when the token is absent or invalid; the code is held only for that request and is not saved in browser storage. The authorized view is read-only and does not write resource configuration.

Use the envelope handoff icon to package a student's topic, suggested search terms, matched ZSR paths, and live source leads into an Ask ZSR email draft. Handoff contact details are not retained by default. Retaining them requires both `HANDOFF_STORE_DETAIL=on` and `HANDOFF_STORE_CONTACT=on`, and should happen only after privacy review.

Query logging is off by default for safer demos. Set `LOG_QUERIES=on` only after ZSR approves retention and student notice language.

## Meeting Packet

For library technical staff review, use:

- `docs/library-technical-staff-brief.md`
- `docs/demo-script.md`
- `docs/architecture-summary.md`
- `docs/live-demo-deployment.md`
- `docs/privacy-logging-note.md`
- `docs/amanda-feedback-validation.md`
- `docs/technical-staff-questions.md`
- `docs/pilot-hardening-baseline.md`
- `docs/reliability-qa.md`
- `docs/accessibility-qa.md`
- `docs/official-zsr-integration-proposal.md`
- `docs/staff-decision-packet.md`
- `docs/data-inventory.md`
- `docs/threat-and-failure-model.md`
- `docs/duke-readiness-packet.md`
- `docs/duke-demo-10-minute.md`
- `docs/technical-correction-note.md`
- `docs/provider-integration-roadmap.md`

## Useful Commands

```bash
npm run build
npm test
PORT=3002 npm start
```

## Project Structure

```text
config/                  Institution adapter, ZSR links, modes, and research/resource config
docs/                    Meeting packet, architecture, privacy, deployment notes
public/                  Static images used by the prototype
server/                  Node API server, Gemini adapter, retrieval, Primo lookup, logging
src/                     Vite/React frontend
test/                    Focused validation, screening, and research-agent tests
```

Some older experimental files may still exist in the working tree, but they are not part of the ZSR demo path.
