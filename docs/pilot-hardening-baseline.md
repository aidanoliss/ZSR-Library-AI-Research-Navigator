# Pilot Hardening Baseline

## Protected live demo

- Live URL: `https://zsr-library-ai-research-navigator-1.onrender.com/`
- Frozen demo branch: `codex/demo-ready-update`
- Frozen demo commit at the start of hardening: `6ffa416`
- Hardening branch: `codex/pilot-hardening`
- Baseline recorded: July 29, 2026

Do not point Render at `codex/pilot-hardening` or merge it into the live branch until the checks below are reviewed. This keeps the version already shared with ZSR stable while validation continues.

## Historical automated baseline

The librarian regression set contains 47 prompts across psychology, humanities, economics, business, health, science, education, communication, news, policy, statistics, sociology, citation help, full-text access, and library navigation.

At the July 29 baseline commit, after the routing corrections then present:

- 47/47 cases pass all automated routing and search safeguards.
- 470/470 individual automated checks pass.
- 47/47 cases still require human librarian scoring.

Automated checks cover named-database fit, forbidden paths, subject focus, path count, executable database-specific queries, topic anchors, generic-route suppression, natural-language leakage, normalized duplicate suppression, and minimum search coverage.

These figures are historical, not a claim about the current working tree or live deployment. The current release adds mode contracts, ResearchSpec metadata, a 54-case discipline-by-mode-by-paraphrase matrix, and additional safety/failure/provenance checks. Generate current evidence with `node scripts/build-release-evidence.mjs`; do not copy the July 29 totals into a new release packet.

These checks are regression guardrails. They do not establish that a database is licensed, that a query is optimal, that a source lead is relevant, or that ZSR staff approve the wording.

## Commands

```bash
npm test
npm run eval:pilot
npm run eval:pilot:strict
npm run audit:resources
npm run audit:resources:live
npm run qa:pilot
node --test test/evaluation-matrix.test.js test/institution-profile.test.js
node scripts/build-release-evidence.mjs --strict
```

`eval:pilot:strict` fails when any automated case fails. `audit:resources:live` performs best-effort public URL checks; authentication pages, anti-bot controls, and network failures must be interpreted manually.

## Merge gate

Before this branch replaces the live demo:

1. A ZSR reviewer completes the four human scores for every case or an agreed representative subset.
2. ZSR confirms the named resources, labels, links, and maintenance owners.
3. Keyboard, zoom, responsive, and screen-reader checks are reviewed.
4. Privacy defaults remain `LOG_QUERIES=off`, `LOG_QUERY_TEXT=off`, `HANDOFF_STORE_DETAIL=off`, and `HANDOFF_STORE_CONTACT=off`.
5. The full `npm run qa:pilot` command passes from a clean install.
