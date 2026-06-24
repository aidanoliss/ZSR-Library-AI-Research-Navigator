# Roadmap

## Phase 1: Core Data Model And Sample Data

- Supabase schema
- Fictional startup and investor seed data
- Scoring engine
- Dashboard, company table, domain summaries, report preview

## Phase 2: LLM Analysis Layer

- Prompt templates
- Provider abstraction
- Server-side model adapters
- Stored company summaries, scorecards, risks, and memos

## Phase 3: Weekly Report Automation

- Local cron-compatible weekly report worker
- Report Markdown and JSON output
- Investor matches and proposal drafts

## Phase 4: Source Ingestion

- HN Launch connector through public Algolia/HN search API
- Runtime job endpoint and UI scan control
- Local JSON persistence with optional server-side Supabase REST persistence
- Deduplication by source UID, source URL, website, and normalized name
- Source reliability and confidence scoring
- Product Hunt, YC, GitHub, RSS, and richer manual URL connectors

## Phase 5: UI Polish And Export

- Markdown export
- CSV export
- PDF export
- Investor proposal export

## Phase 6: Advanced Features

- Domain trend analysis
- Competitive mapping
- Founder graph
- Market context ingestion
- Email and Slack delivery
- User-configurable scoring weights
