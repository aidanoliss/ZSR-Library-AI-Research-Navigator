# Results design release — 2026-10-16

Published commit: `7169746126cf1d611b0da1362cc25b35f9ced65a` on `codex/universal-research-workflow`.

Public URL: https://zsr-library-ai-research-navigator-1.onrender.com/

Changes: blue underlined links; Results jump navigation; distinct copyable Boolean query variants; database cards with coverage and search instructions; expandable database queries and additional recommendations.

Validation: clean-checkout release checks passed (398 tests, 56 evaluation cases, 1,232 automated assertions, resource audit, browser fixture self-test, production build). GitHub Actions run 38941007618 completed successfully. Public `/api/health` returned HTTP 200 with releaseId `7169746126cf`.

Public browser verification used an existing saved sanctions comparison result: new Results sections visible; jump links scroll and focus the corresponding section; query copy shows success; database query and additional recommendations disclosures work. Screenshots: `live-search-options.png`, `live-databases.png`. This was not a fresh retrieval-accuracy evaluation.

Render recovered from the earlier wake failure before publication. No manual restart or hosting-plan change was performed. The Free instance still sleeps with inactivity; the dashboard warns wake-up requests may take 50 seconds or more. This release does not eliminate cold starts or guarantee uptime.
