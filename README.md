# Wake Forest ZSR Library AI Research Navigator

Prototype research navigator for Wake Forest Z. Smith Reynolds Library workflows. The app helps students turn a topic into search terms, mode-specific research strategies, ZSR starting points, live ZSR catalog leads where available, citation guidance, and honest full-text access next steps.

This is a prototype, not a production ZSR integration. It uses Gemini through the server API, curated ZSR-style resource metadata, and a best-effort live Primo lookup. It does not log students into ZSR, bypass paywalls, control LibKey Nomad, or expose private keys in the browser.

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

## Local Demo

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
Express API: `http://localhost:3001`

## Sharing A Test Link

Do not share a `localhost` URL with Amanda unless she is on the same machine. For a live test link, deploy the app to a server that can run the Express API and set `GEMINI_API_KEY` as a server-side environment variable. Render, Railway, Fly.io, or a similar Node host is the simplest path for this Express + Vite setup.

Private keys must stay server-side. The browser should only call `/api/chat` or `/api/chat/stream`.

Suggested demo framing:

- This is a student-built prototype, not an official ZSR service unless ZSR approves it.
- It uses Gemini through the Express API, local librarian-editable ZSR resource configs, public link-outs, and best-effort catalog examples.
- It does not provide authenticated database access, bypass paywalls, or confirm Wake Forest full-text availability.
- ZSR librarians can review or replace the local resource config before any broader pilot.

Live demo readiness checklist:

- Set `GEMINI_API_KEY` only on the server host.
- Confirm `.env` is not committed and no API key appears in browser-visible files.
- Run `npm run build` before sharing.
- Use Render/Railway/Fly for the current Express API shape; static-only Netlify/Vercel hosting will need a separate API deployment or serverless adapter.
- Keep the prototype disclaimer visible in the demo and in any shared recording.

## Library Link Configuration

Library URLs and mode definitions live in `config/libraryLinks.js`.
The research-intent router, citation guide placeholders, and librarian-editable resource recommendations live in `config/researchAgent.js`.

Values that should be confirmed with ZSR before a public pilot:

- ZSR Citations & Bibliographies: `https://guides.zsr.wfu.edu/citations`
- Zotero Research Assistant: `https://zsr.wfu.edu/research-instruction/zotero-research-assistant/`
- LibKey information page: currently points to a general ZSR research page until ZSR confirms a preferred LibKey Nomad page
- ZSR Delivers / ILL: `https://zsr.wfu.edu/delivers/ill/`
- Official Primo API endpoint/key, if ZSR wants API-backed search rather than public Primo lookup

## Future Primo / MCP Integration TODO

The current agentic behavior is intentionally local-config based: classify the student's need, generate better search terms, recommend likely ZSR paths, and link out to Primo, A-Z Databases, Google Scholar, LibKey Nomad, and ZSR help pages.

Do not build a full MCP server until ZSR can provide official access details. A future integration should add:

- Approved Primo API endpoint and key
- Confirmed ZSR database metadata or LibGuides export
- Wake Forest LibKey / Third Iron library ID or API details
- Librarian-reviewed citation guide URLs for APA, MLA, Chicago, and Zotero
- Logging/privacy rules approved for student research queries

## LibKey Nomad Support

The app gives LibKey-aware full-text guidance. If a catalog/article record exposes a DOI or PMID, the UI shows DOI/PubMed-based access actions that can work alongside LibKey Nomad. If not, it falls back to Google Scholar, ZSR search, and ZSR Delivers/help links.

This is not a LibKey API integration and does not control the browser extension.

## Optional Primo API Readiness

`server/primoApi.js` contains a future-facing service that can build Primo-compatible requests when `PRIMO_API_ENDPOINT` and `PRIMO_API_KEY` are configured. Without credentials, it falls back gracefully to current ZSR/Scholar links and the existing live Primo lookup.

## Meeting Packet

For library technical staff review, use:

- `docs/library-technical-staff-brief.md`
- `docs/demo-script.md`
- `docs/architecture-summary.md`
- `docs/live-demo-deployment.md`
- `docs/privacy-logging-note.md`
- `docs/technical-staff-questions.md`

## Useful Commands

```bash
npm run build
npm test
PORT=3002 npm start
```

## Project Structure

```text
config/                  ZSR links, search modes, research-intent/resource config
docs/                    Meeting packet, architecture, privacy, deployment notes
public/                  Static images used by the prototype
server/                  Express API, Gemini adapter, retrieval, Primo lookup, logging
src/                     Vite/React frontend
test/                    Focused validation, screening, and research-agent tests
```

Some older experimental files may still exist in the working tree, but they are not part of the ZSR demo path.
