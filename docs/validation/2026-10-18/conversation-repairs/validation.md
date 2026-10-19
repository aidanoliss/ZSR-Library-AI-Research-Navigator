# Conversation and retrieval repairs

- Private sessions have a persistent high-contrast banner and a matching composer indicator. The explanation explicitly states that searches still go to the service/providers; private mode is not anonymous browsing.
- A single fixed follow-up composer stays within the content column on desktop and mobile. Earlier questions and responses remain chronological; superseded corrections retain their existing disclosure.
- Save/undo notices use a dismissible eight-second notification instead of a permanent page-wide message. Undo remains available in saved-source views.
- Related-source panels show titles, source types, authors/dates, labeled provider excerpts where present, and explicit open/save controls. Registry diagnostics are collapsed. Similar-title retrieval screens substantive title/abstract overlap; it remains a lexical heuristic, not a quality judgment.
- Conversational example requests no longer require words such as “Examples Russia having”, “used against”, or generic “result” in source metadata. Outcome intent is preserved, as are concrete outcomes, quoted phrases, and explicit requirements. “What about Russia?” can refine an existing topic.

## Verification

499 tests passed; strict planner baseline 56/56 cases and 1,232/1,232 checks. Resource audit, fixture self-test, and production build passed. The existing large-bundle advisory remains.

Browser checks: private indicator and composer visible while scrolling; chronological two-question conversation; save/unsave/undo and notification expiry; 390px mobile viewport with 390px document width and composer inside the viewport. Synthetic fixtures verify interaction only.

A fresh real-provider capture of “Examples of Russia having sanctions used against them and the result” returned 10 candidate records with the query `Russia AND sanctions`. Displayed titles included work on trade effects, the heterogeneous effects of sanctions on Russia, and firm exports following the 2014 EU–Russia sanctions. The real browser search also returned 10 leads; related-source exploration of “Friendly fire: the trade impact of the Russia sanctions and counter-sanctions” returned 10 related records.

Counts are retrieval observations, not relevance accuracy rates. No full-text claims were verified. Direction (sanctions imposed on Russia versus by Russia), study quality, source type, and conclusions still require human review. No feedback or emails were sent.
