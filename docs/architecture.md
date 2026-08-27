# Architecture Index

The canonical implementation description is `docs/architecture-summary.md`. Use that document for technical review; it covers deterministic planning, Gemini, public Primo, Crossref, Open Library covers, browser storage, logging, deployment, and current versus future integrations.

Supporting architecture records:

- `docs/data-inventory.md`: field-level data destinations and retention controls.
- `docs/threat-and-failure-model.md`: trust boundaries, threats, safe degradation, and release gates.
- `config/institutionProfile.js`: generic institution-profile contract plus the WFU prototype and blank Duke template.
- `docs/live-demo-deployment.md`: canonical runtime and hostname-preservation procedure.

The deployed application is the ZSR Research Navigator. Older unrelated product architecture is not part of this repository’s review surface.
