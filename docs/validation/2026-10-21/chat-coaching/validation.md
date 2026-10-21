# Research chat usefulness repair

The previous source-only answer contract required an abstract quotation for every response, including essay structure advice. This change separates procedural coaching from claims about research findings.

## Behavior

- Essay outlines, paragraph plans, introduction planning, working thesis frames, neutral question development, search strategies, and reading checklists use bounded server-authored planning guidance. They do not call Gemini, require citations, or invent a thesis or source summary. Topic concepts, comparison labels, and authenticated record inventory provide limited tailoring.
- Planning works before searching and with metadata-only records. Valid but expired records are excluded from planning, with a refresh notice, instead of blocking it. Forged tokens remain invalid. Evidence discussions still require current authenticated abstracts and checked quotations; no arbitrary model prose enters the planning channel.
- A short follow-up can expand a prior outline into a paragraph plan. Suggested follow-ups fill the composer for review. Parallel search drafts return to Search without submitting automatically.
- Source management is collapsed by default, distinguishes abstracts from citation details, and does not repeat attached records in the available-source list. New replies scroll to their start. Planning guidance, citations, and follow-up actions remain bounded in session storage/history.
- Evidence shortage and failed answer validation now have different messages. A rejected generated answer is not described as proof that the source is irrelevant.

## Verification

Focused regressions reproduce the reported three-record sanctions essay question: two abstracts and one metadata-only record yield a plan and correct record inventory without a provider call. Cases cover no-source planning, contextual follow-ups, factual-source questions retaining the evidence path, forged and expired records, cancellation, parallel search drafts, and persistent client guidance/actions.

Browser checks on the production local server: no-source essay request returned a sanctions comparison plan; suggested paragraph follow-up retained the topic; switching Search/Research chat retained both turns; a fresh retrieval attached one source; Manage sources showed it only in the attached list. The original browser's saved normal research was preserved by testing privately.

A fresh search for the complete sanctions/civilian-well-being topic returned an incomplete provider result with a visibly weak match. This is a separate retrieval/ranking limitation, not evidence that the chat repair improves source accuracy. Planning guidance remains bounded and is not an unrestricted conversational tutor. Matching quotations still cannot prove correct interpretation.
