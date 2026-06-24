# Venture Radar Architecture

Venture Radar is organized around clear module boundaries rather than a single scoring script.

## Core Modules

- `lib/sources.js`: modular discovery connectors and source-normalized startup candidates.
- `lib/pipeline.js`: source scan orchestration, extraction, dedupe, scoring, matching, and report generation.
- `lib/scoring.js`: explainable company scorecards.
- `lib/investors.js`: VC thesis matching and best-company-per-firm ranking.
- `lib/vcProfiles.js`: editable VC profile normalization.
- `lib/memos.js`: investment memos, firm-specific memos, and outreach variants.
- `lib/reports.js`: weekly report generation.
- `server/ventureStore.js`: Supabase or local JSON persistence.
- `workers/run-weekly-scan.js`: scheduled weekly scan and summary artifact generation.
- `config/vc_profiles.json`: institutional VC firm profiles.

## Editable VC Profiles

The first institutional profile set lives in `config/vc_profiles.json` and covers:

- 8VC
- Founders Fund
- Andreessen Horowitz
- General Catalyst
- Lux Capital
- DCVC
- First Round Capital
- Pear VC
- Contrary
- NFX
- Sequoia Capital
- Khosla Ventures

Each profile includes sector focus, stage focus, geography, partner interests, thesis language, risk tolerance, technical-depth preference, examples that fit, examples that do not fit, and source links.

## Analyst Workflow

1. Run source ingestion manually from the dashboard or weekly via `npm run venture:weekly-scan`.
2. Review ranked startups on the dashboard.
3. Filter companies by sector, stage, source, score, and top VC fit.
4. Mark companies as watch or pass.
5. Review company detail pages with firm-specific memo and outreach drafts.
6. Use the VC Firms page to inspect firm profiles and best startup fit by firm.
7. Export reports and company data as Markdown, JSON, or CSV.

## Persistence

The runtime store uses Supabase REST when server-side Supabase environment variables are configured. Otherwise it writes to `data/venture_runtime.json`, which is intentionally gitignored.

The schema supports source audit trails, enrichment events, startup scores, VC profiles, VC fit scores, memos, reports, watchlist states, outreach drafts, and score history.
