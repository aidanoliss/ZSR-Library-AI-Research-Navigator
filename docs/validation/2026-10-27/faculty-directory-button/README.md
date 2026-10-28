# Faculty browsing and database button validation

- Added always-visible official faculty directory links, selected from positive topic terms and verified matches. The full Wake faculty directory remains available for unmatched topics. These are browsing routes, not claims that every listed person specializes in the topic.
- Increased the maximum named matches from two to four while retaining profile verification, expiry, deduplication and institution checks. The curated pilot still contains five profiles; no invented faculty were added.
- Checked official Politics, History, Psychology and Biology faculty pages on October 27, 2026.
- Restyled the database jump button in black with white text, database/arrow icons, spacing, hover and keyboard focus treatment.

## Validation

`npm run qa:release` passed: 643 tests, resource audit, 56 planner cases, synthetic browser fixture self-test, and production build. The pre-existing bundle-size advisory remains.

Browser verification used production assets and synthetic fixture records at localhost:3020, in a private session. For the sanctions example, Politics, History and All Wake faculty links remained visible with the named card collapsed and expanded; Ben Coates retained his profile and contact actions. The database button measured approximately 46 px high with white text on rgb(23,23,23). Clicking it focused the Recommended databases section at 145 px below the viewport top, clear of the sticky toolbar. Screenshots show the rendered changes.

These checks validate routing and interface behavior. They do not measure retrieval accuracy or establish faculty availability.

## Official directory routes

- https://politics.wfu.edu/faculty-and-staff/
- https://history.wfu.edu/people/
- https://psychology.wfu.edu/faculty-and-staff/
- https://biology.wfu.edu/faculty-research/
- https://www.wfu.edu/faculty-staff/
