# ZSR Research Navigator - Technical Staff Brief

## One-sentence framing

This is a student-built prototype showing how an AI assistant could guide Wake Forest students from a rough research topic toward better ZSR search paths, citation help, and full-text workflows.

## What it can do now

- Accept a student topic or follow-up question in a chat-style interface.
- Classify the research need into paths such as scholarly articles, books/background, market/business data, statistics/datasets, news/current events, legal/policy sources, citation help, full-text help, or general exploration.
- Recommend ZSR-oriented resources from an editable local config in `config/researchAgent.js`.
- Suggest better search terms and recovery searches when a query is too broad, too narrow, or poorly suited to Primo.
- Link students out to ZSR Library Search, A-Z Databases, ZSR guides, Google Scholar, LibKey Nomad, ZSR Delivers, and Ask a Librarian.
- Show best-effort catalog examples from ZSR's public Primo discovery endpoint when available.
- Keep the Gemini API key server-side through the Node API server.

## What it does not do yet

- It does not authenticate into ZSR databases.
- It does not search every licensed database directly.
- It does not verify full-text availability.
- It does not have an approved Primo API, LibKey API, or LibGuides metadata integration.
- It does not replace librarian review or official ZSR subject guidance.
- It is not an official ZSR service unless reviewed and approved by ZSR/WFU.

## Current architecture

- Frontend: Vite + React.
- Backend: Node server in `server/native.js`.
- AI: Gemini API via server-side calls only.
- Local ZSR guidance layer: `config/researchAgent.js` plus `server/resources.json`.
- Live catalog examples: public Primo discovery lookup in `server/primo.js`, with safe fallback to link-outs.
- Full-text workflow: DOI/PMID/title detection and LibKey Nomad guidance, not direct access verification.
- Deployment target: Render web service using `render.yaml`.

## Demo prompts

Use these in order:

1. `The impact of social media on adolescent mental health`
2. `I searched Primo and got nothing for Rolex watches`
3. `I need statistics on college student mental health`
4. `I need a citation for a website in APA`
5. `I need full text for this DOI 10.1001/jama.2004.1635`

## Meeting ask

The goal is not to ask technical staff to approve production immediately. The goal is to learn what real ZSR systems, metadata, access rules, privacy constraints, and hosting path would be needed to make this institutionally sound.

## Recommended next step after meeting

If staff are interested, ask for a small librarian/technical review cycle:

- 5-10 approved subject/resource mappings.
- Confirmed citation guide URLs.
- Preferred ZSR/Primo/LibGuides metadata path.
- Preferred hosting/security model.
- Privacy/logging guidance for student research queries.
