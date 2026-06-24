# Venture Radar Methodology

Venture Radar is an analyst-augmentation system for startup discovery, market mapping, venture research, and proposal drafting. It is not an automated investing product.

## Workflow

1. Discover newly surfaced startups from configured public or manual sources.
2. Deduplicate company records by name, URL, source URL, and product description similarity.
3. Extract structured company profiles from source text.
4. Separate confirmed facts, model inferences, unverified claims, and diligence needs.
5. Score companies with the transparent scoring rubric.
6. Group companies by domain and identify the best company in each domain.
7. Match top companies to thesis-relevant investors.
8. Generate memos, outreach drafts, and a weekly report.

## Evidence Discipline

The UI and reports use four evidence tags:

- Confirmed: directly supported by a source.
- Inferred: a model or analyst inference based on available information.
- Unverified: a claim that appears in a source but needs corroboration.
- Needs diligence: a question or review item before recommendation.

## Source Policy

Preferred sources are official APIs, RSS feeds, public directories, permitted public pages, manually provided URLs, filings, company websites, accelerator pages, and founder-provided materials. Scraping, if added, should be lightweight, rate-limited, respectful, and isolated from core scoring logic.

## Current Ingestion Implementation

The first live connector uses Hacker News Launch HN results through the public Algolia/HN search API. It stores launch title, source URL, HN metadata, deterministic category inference, score inputs, and raw candidate metadata. HN points and comments are treated as community interest only, not revenue, retention, customer adoption, or investment performance.

Deduplication runs before persistence using normalized name, website host, source URL, and source UID. Extracted profiles preserve four evidence buckets so confirmed source text, inferred category/score logic, unverified claims, and diligence questions remain separate.
