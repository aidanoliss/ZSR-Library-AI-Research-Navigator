# Amanda Feedback Validation

Validated on July 15, 2026 against the local production build at `http://127.0.0.1:3002`.

## Feedback coverage

| Feedback area | Change | Validation |
| --- | --- | --- |
| Search Plan / ZSR Paths | Recommendations are now variable length. Weak matches are omitted instead of padding every response. When a topic-matched shortlist or live result list is small, a separate collapsed group offers general ZSR discovery routes without labeling them as topic matches. Unknown niche topics fall back to A-Z Databases, ZSR Library Search, and Subject & Course Research Guides. | Automated tests cover biomedical, AI/cognition, humanities, business, mixed-discipline, unknown-niche topics, and the separation of general starting points from scored recommendations. Live AI/cognitive-offloading and protein-folding searches returned only related paths. |
| Topic Options | Brainstorming and narrowing requests no longer trigger catalog discovery. Source discovery begins only after an explicit source request. | Live Answer First test returned three topic angles with no catalog or ZSR-result cards. Catalog-intent regression tests cover first turns and follow-ups. |
| If This Search Fails | Link-outs use keyword strings rather than natural-language questions. Broadening changes one concept while preserving an anchor. Conversational request words are removed. | Live links used forms such as `"cognitive offloading" AND artificial intelligence`. Tests reject `Can you help me`, `how AI affects`, and `Find more source leads focused on`. |
| Real Results in ZSR Catalog | Catalog lookup is intent-gated and records must pass stricter multi-concept title/subject relevance checks. Weak matches are omitted. The UI labels results as discovery leads rather than endorsements. | AI/cognitive-offloading returned directly related titles. Protein folding returned protein-folding/disease titles. Tests reject adjacent cognitive records missing the AI concept and off-topic result sets. |
| Search Terms to Try | The response explains `OR` within a concept, `AND` between concepts, and recommends swapping one synonym or removing one limiter before changing databases. | Live results displayed the combination guidance and keyword-form ZSR/Scholar links. Regression tests preserve core concepts and population limiters. |
| Evaluating Your Sources | Evaluation guidance remains available in the single consolidated `Evaluation, citations, limitations & AI` dropdown. The duplicate standalone section was removed. | Component regression coverage confirms the evaluation guidance is rendered once, while psychology and biomedical responses retain methodology, relevance/authority, recency, and peer-review checks. |

## New research-process support

- Per-chat assignment briefs with course presets, source-count/type requirements, date expectations, and other constraints.
- A local research trail for saved ZSR paths, catalog leads, and search strings.
- Promising, Opened, Use, and Not relevant statuses plus notes and citation details.
- Automatic and manual search-history entries with result notes.
- A librarian-ready review packet with copy/download and explicit handoff.
- Clear integration posture: live public ZSR discovery metadata and curated link-outs are available; subscription access, full text, and citation metadata still require confirmation.

Assignment and guided-planner context is sent only to the AI model context. It is deliberately excluded from subject routing, catalog intent, catalog keywords, and resource matching so assignment wording cannot distort the search.

## Test evidence

- `npm test`: 64 tests passed.
- `npm run test:live`: 4 live Gemini adversarial checks passed, covering paywalled-content handling, unsupported search claims, prompt injection, and curated-link enforcement.
- `npm run build`: production build passed.
- Exact staff-reported scenario: `AI and cognitive offloading in college students` returned eight focused Boolean/keyword strings and ten catalog discovery leads; all ten contained the required AI and cognitive-offloading concepts, with no business paths or unrelated catalog leads.
- Desktop browser QA at 1440x900: no horizontal overflow; fixed composer remained fully in the viewport.
- Mobile browser QA at 390x844: no horizontal overflow; workspace fit within 374px; page scrolling remained enabled.
- Browser console during QA: no warnings or errors.

## Remaining limits

- Live Primo metadata is a discovery aid, not a librarian-reviewed recommendation or access guarantee.
- Gemini wording can vary between requests even though deterministic routing, fallback links, and catalog filters are tested.
- Official Primo API credentials, reviewed A-Z/LibGuides exports, library authentication, course-system sync, and institutional retention policy are not implemented.
- A broader pilot should use a librarian-reviewed prompt set and record pass/fail outcomes before production approval.
