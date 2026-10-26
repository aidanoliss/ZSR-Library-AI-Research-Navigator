# Guided search and follow-up repair — 2026-10-26

## Confirmed defects

The supplied first-turn question in Guided plan mode did not request catalog discovery unless the text contained an explicit discovery keyword. Planner answers about source type did not affect this routing decision. Guided plan responses also opened Search strategy rather than Results, hiding source leads and recommended search routes.

The legacy Last 5 years menu became a historical topic facet instead of publication dates. The narrowing menu collected generic preferences without actual scope values. Follow-ups reopened the planner, and short population/method/date modifiers could reset or fail to update the existing request. Date replacement could retain an obsolete opposing bound.

## Repairs

Guided requests and substantive first research questions run discovery. Search refinements request another search while preserving the reviewed brief. Publication dates, population, geography, study design and actual comparison groups update their fields; explicit new topics reset. Old saved menu dates are repaired only when their original planner metadata confirms the legacy mistake and no later edit contradicts it.

All five source and scope choices are visible. Date/source choices are exclusive. Population/place/comparison choices ask for actual values. Ordinary follow-ups bypass the initial questionnaire. Results opens first. Unsearched and unconfirmed search states have explicit recovery actions and do not claim no literature exists.

## Verification

- Clean release: 625 automated tests passed; resource audit, 56 strict librarian-planner cases (1,232 assertions), synthetic HTTP/browser fixtures and production build passed.
- Server integration exercises native and Express, buffered and streamed endpoints with the exact original question and legacy menu choices. Checks prove discovery is invoked, publication dates applied, and no comparison groups invented.
- Browser fixtures: single date selection; all five source options; comparison disabled until groups supplied; Results selected by default; children and since 2023 follow-ups retain the topic without reopening the questionnaire; a simulated failed request displays unconfirmed status and Retry source search. Fixture records are synthetic and provide no relevance evidence. The failure trigger is literal test-only query text, so that case does not validate context retention.
- Real configured Primo searches: initial question + legacy choices returned 10 candidates, with publication bounds 2022–2026 and no historical period. What about children? returned 10 candidates with child population and the same dates. Since 2023 returned 10 candidates, retaining topic/population and replacing dates with 2023–present.
- Initial and children runs were partial because some provider queries timed out. Date refinement completed all three variants (one recovered after timeout). Sanitized artifacts retain metadata and attempted queries, not signed chat evidence or source abstracts.

## Limits

These are retrieval and request-continuity checks, not a measured relevance or medical accuracy rate. Some retrieved records concern vaccine hesitancy or vaccination in autistic populations rather than the causal question. The five-year filter also excludes older foundational studies; it is never silently relaxed. Provider timeouts remain possible. Unknown short populations/places should use explicit labels, such as Population: nurses or Change geography to Denmark. No factual medical synthesis was generated or independently validated. Human judgments of direct relevance and abstract entailment remain necessary.
