# Ten-Minute Duke Technical Demonstration

Use a staging or local environment for failure simulations. Keep the circulated public URL unchanged.

## 0:00 to 1:00, boundaries

Say:

> This is an independent student-built prototype. It has no Duke login, resources, credentials, or institutional approval. I am demonstrating a governed research workflow and the review controls that would let Duke decide whether a narrow pilot is worthwhile.

Show the prototype label, release/configuration identifier, and the “research orientation” label.

## 1:00 to 3:00, books versus articles

Use one humanities topic:

`Jazz clubs and urban cultural identity in the United States during the 1950s`

Run it in Scholarly Articles, then Books and Background. Show:

- the same core concepts in the ResearchSpec;
- disciplinary article indexes high in scholarly mode;
- the catalog and monograph-capable paths high in books mode;
- database-specific queries that retain the core topic;
- the reason, capability, limitation, owner/review status, config version, and plan hash on a recommendation.

The point is controlled variation, not two cosmetically different answers.

## 3:00 to 4:30, loaded premise

Prompt:

`Do vaccines cause autism?`

Show that the orientation examines the premise, avoids a fake consensus meter, distinguishes evidence standards, does not frame misinformation as an equal side, and routes to health evidence without claiming an exhaustive review.

## 4:30 to 6:00, inspectability and refinement

Open the interpreted ResearchSpec. Change one visible dimension, such as source type or date range. Use one refinement choice, such as “too broad” or “wrong source type,” and show the before/after query change. Explain that weak matching produces a safe-failure reason or librarian handoff instead of unrelated database padding.

## 6:00 to 7:00, Gemini failure

In a controlled staging/local run, remove or disable the Gemini credential or invoke the tested provider-failure path. Submit the same topic. Show that:

- the interface says generated prose is unavailable;
- the deterministic ResearchSpec, database routes, and executable searches remain;
- no canned topical answer replaces the failed model response.

## 7:00 to 8:00, discovery failure

Run staging with `PRIMO_LIVE=off`. Show that no catalog records are invented, database routes and searches remain usable, Crossref is not used for incompatible modes, and the interface explains the limitation.

## 8:00 to 9:15, release evidence and governance

Show:

```bash
node scripts/build-release-evidence.mjs
node scripts/diff-institution-config.mjs
```

Point out the commit/config version, mode-by-mode evaluation, plan hashes, blank human ratings, and explicit “not human approved” status. Show the WFU prototype profile beside the blank, unapproved Duke template. If the librarian QA console is available, preview a configuration change and its regression impact; do not activate or label it approved without a librarian decision.

## 9:15 to 10:00, narrow ask

Ask for a two-discipline content and usability review, not production approval. Request named owners for resource metadata, privacy, accessibility, security, and deployment questions. Offer to use only public, staff-approved routes on staging until Duke chooses otherwise.
