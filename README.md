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

## Library Link Configuration

Library URLs and mode definitions live in `config/libraryLinks.js`.

Values that should be confirmed with ZSR before a public pilot:

- ZSR Citations & Bibliographies: `https://guides.zsr.wfu.edu/citations`
- Zotero Research Assistant: `https://zsr.wfu.edu/research-instruction/zotero-research-assistant/`
- LibKey information page: currently points to a general ZSR research page until ZSR confirms a preferred LibKey Nomad page
- ZSR Delivers / ILL: `https://zsr.wfu.edu/delivers/ill/`
- Official Primo API endpoint/key, if ZSR wants API-backed search rather than public Primo lookup

## LibKey Nomad Support

The app gives LibKey-aware full-text guidance. If a catalog/article record exposes a DOI or PMID, the UI shows DOI/PubMed-based access actions that can work alongside LibKey Nomad. If not, it falls back to Google Scholar, ZSR search, and ZSR Delivers/help links.

This is not a LibKey API integration and does not control the browser extension.

## Optional Primo API Readiness

`server/primoApi.js` contains a future-facing service that can build Primo-compatible requests when `PRIMO_API_ENDPOINT` and `PRIMO_API_KEY` are configured. Without credentials, it falls back gracefully to current ZSR/Scholar links and the existing live Primo lookup.

## Legacy Venture Radar Notes

The repository still contains earlier Venture Radar files and scripts. They are not part of the ZSR Research Navigator demo.

# Venture Radar

Venture Radar is an AI venture-intelligence MVP for startup discovery, domain analysis, transparent scoring, investor matching, investment memo generation, proposal drafting, and weekly venture reports.

It is not an automated investing product. It does not predict unicorns, recommend buying or selling securities, or provide financial, legal, or investment advice.

## What Is Included

- Vite + React dashboard with pages for Dashboard, Companies, Company Detail, Domains, Reports, Memos, and Settings.
- Structured fictional sample startup data across AI infrastructure, vertical AI, agents, defense, fintech, healthcare, legal, climate, robotics, devtools, cybersecurity, SaaS, consumer AI, edtech, and govtech.
- Fictional sample investor database with 25 entries across VC, angels, accelerators, corporate venture, university funds, and strategic investors.
- Transparent scoring engine with component explanations.
- Investor matching and proposal generation.
- Weekly report automation worker that outputs Markdown and JSON.
- Runtime source ingestion from Hacker News Launch HN through the public Algolia/HN search API.
- Local JSON persistence with server-side Supabase REST persistence when configured.
- Editable institutional VC profile config for 8VC, Founders Fund, a16z, General Catalyst, Lux, DCVC, First Round, Pear, Contrary, NFX, Sequoia, and Khosla.
- Firm-specific VC fit scoring, firm-specific memos, outreach variants, CSV export, and browser-local watch/pass lists.
- Supabase schema and SQL seed subset.
- Prompt templates for extraction, scoring, risk analysis, investor matching, memos, proposals, and weekly reports.
- Methodology, scoring, limitations, compliance, and roadmap docs.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend: http://localhost:5173  
Express API: http://localhost:3001

## Useful Commands

```bash
npm run build
npm test
npm run venture:score
npm run venture:report
npm run venture:report:write
npm run venture:proposals
npm run venture:weekly-scan
```

`npm run venture:report:write` writes `data/generated_weekly_report.json`.
`npm run venture:weekly-scan` runs source ingestion, persists the updated runtime state, and writes:

- `data/generated_weekly_summary.md`
- `data/generated_weekly_summary.json`

## Project Structure

```text
components/              Reusable Venture Radar UI components
config/                  Editable VC profile configuration
data/                    Sample startups, investors, sources, generated outputs
docs/                    Methodology, rubric, limitations, compliance, roadmap
lib/                     Scoring, matching, reports, memos, source and LLM helpers
prompts/                 Reusable LLM prompt templates
python/                  Future Python scoring/context/clustering helpers
server/                  Express API, including /api/venture/* endpoints
src/                     Vite app entry and dashboard shell
supabase/                schema.sql and seed.sql
workers/                 Local cron-compatible jobs
```

See `docs/architecture.md` for module boundaries and the current institutional workflow.

## API Endpoints

- `GET /api/venture/scorecards`
- `GET /api/venture/investor-matches/:companyId`
- `GET /api/venture/weekly-report`
- `GET /api/venture/state`
- `GET /api/venture/jobs`
- `POST /api/venture/run-weekly-scan`

`POST /api/venture/run-weekly-scan` currently supports `{ "source": "hn", "limit": 12 }`. It fetches Launch HN posts, extracts conservative company profiles, deduplicates against existing runtime data, scores the merged company set, updates the weekly report, and records a job.

## Supabase

Apply `supabase/schema.sql` in a Supabase project, then optionally run `supabase/seed.sql`.

The schema enables RLS on every public table and grants access to authenticated users for the single-analyst MVP model. Before production multi-tenant use, replace those policies with owner/team-scoped policies.

For server-side persistence, set:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

The browser only needs public keys if you later add direct client access. The current ingestion job runs through Express and does not expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code.

The Supabase changelog reviewed during implementation includes a 2026 breaking change that new tables may not be exposed to the Data API automatically. If tables are inaccessible through the client, check Data API exposure and grants in addition to RLS policies.

## Weekly Automation

The weekly source scan command is:

```bash
npm run venture:weekly-scan
```

It:

1. Reads the current runtime state from Supabase or local JSON fallback.
2. Fetches Launch HN candidates.
3. Extracts source-disciplined company profiles.
4. Deduplicates against tracked companies.
5. Scores the merged company set.
6. Updates the weekly report and job log.
7. Writes a Markdown and JSON summary with additions, duplicates, top new companies, top overall companies, high-risk items, and next diligence actions.

This can be scheduled with Vercel Cron, GitHub Actions, Supabase Edge Functions, or a local cron runner.

## Compliance

This platform is for research and educational purposes. Startup scores are analytical estimates based on public information and model-generated inferences. Human diligence is required before any investment decision or recommendation.

The product must not include promises of return, buy/sell/invest-now instructions, guaranteed performance claims, fabricated traction, fabricated funding, or fabricated investor interest.
