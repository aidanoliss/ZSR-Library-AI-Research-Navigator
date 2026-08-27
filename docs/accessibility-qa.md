# Accessibility QA

## Implemented safeguards

- Visible `:focus-visible` outlines across keyboard controls
- Semantic labels for composer buttons, icon tools, form controls, and expandable details
- `role="alert"` for request and access errors
- Polite live status for AI progress and the changing guided-planner question
- Guided planner remains a non-modal region, so it does not block page scrolling or interaction
- Handoff uses a labeled modal dialog with Escape close, focus containment, and focus restoration
- Research workspace uses a labeled non-modal dialog and tab/tabpanel semantics
- Global reduced-motion handling for animations, transitions, and smooth scrolling
- Responsive layouts for narrow screens and long text wrapping

## QA matrix

| Check | Method | Status | Notes |
| --- | --- | --- | --- |
| Accessible names and live regions | Static contract tests | Pass | Covered by `test/accessibility-contract.test.js`. |
| Visible keyboard focus | Browser keyboard walkthrough | Pass | Verified a visible 2px gold focus outline plus focused entry controls in the workspace and handoff. |
| Handoff focus containment | Browser keyboard walkthrough | Pass | Shift+Tab wrapped from Close to Open email draft, Tab wrapped back to Close, and Escape restored focus to Prepare librarian handoff. |
| Planner remains non-modal | Browser keyboard and scroll walkthrough | Pass | Body overflow remained visible, page scroll moved from 0 to 650px, and the research workspace remained usable while the planner was open. |
| 200% zoom | Browser visual check | Pass | Browser zoom reached 200% with no document-level horizontal overflow or clipping of the core conversation and composer. |
| 320px mobile width | Browser visual check | Pass | No document-level horizontal overflow; the composer and 292px-wide planner remained inside the viewport without overlapping each other. |
| Reduced motion | CSS contract test | Pass | Uses `prefers-reduced-motion: reduce`. |
| Screen reader | VoiceOver or NVDA manual review | Not completed | Required before calling the prototype WCAG-conformant. |
| Contrast | Manual/tool review | Not completed | Gold text and muted text need formal contrast measurements. |

Browser checks were completed against the local production server on July 29, 2026 at 1440x900, 200% browser zoom, and 320x800. The browser console reported no warnings or errors during the tested flows.

This document records prototype QA; it is not a WCAG conformance statement.
