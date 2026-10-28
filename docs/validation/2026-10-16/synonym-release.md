# Expanded query vocabulary — 2026-10-16

Published commit: e3d587443dc1416d20a2c14e4067384e93d6dc9d on codex/universal-research-workflow.

Results now offer up to 12 unique queries, fuller vocabulary expansion, one-concept expansion, and an inspectable synonym/related-term list. Four options appear initially; remaining options are disclosed on demand. Known-item lookups and explicit phrases stay exact. Required concepts, comparison grouping, geography and method constraints are retained. Suggestions do not mutate the research brief or automatically rerun retrieval.

Validation: 400 tests passed; resource audit, strict developer evaluations, browser fixture self-test and production build passed. The initial sandboxed fixture check could not bind a local port; rerunning that check with permission passed. GitHub Actions run 38941912592 succeeded. Render health returned releaseId e3d587443dc1.

Browser verification: local wearables example displays seven options; live saved sanctions comparison displays seven options. Verified vocabulary disclosure, additional options, jump navigation, and successful copying of an additional query. Screenshot: live-expanded-vocabulary.png. No new retrieval-accuracy benchmark was run. Vocabulary suggestions are explicitly labeled as unverified equivalents/subject headings.
