# Toolbar integration review and repair

Scope: the existing sticky research action toolbar, not a broader redesign. Goal: make the Search / Research chat switch fit the product's established navigation pattern and neighboring controls.

## Captured steps

1. **Before — needs improvement.** The current public results screen was captured at 1280×720 before editing. The nested cream pill was 54px tall alongside 42px actions. Its black selected state competed with the black My sources button. Several boxed styles and the long Assignment requirements label crowded the row. Current-run local capture: `01-before.jpg` (retained in the primary workspace, not published in this release).
2. **Desktop repair — verified.** Reused the flat text tabs and old-gold selected underline already present in Results. Removed the switch's filled container, aligned all controls at 44px, softened secondary actions, retained the switch between the librarian link and export menu, and shortened the visible assignment label to Assignment brief. Its native accessible name matches its visible label; the tooltip explains requirements. Toolbar height is 65px, reduced from 75px. A tight 1141px viewport retained one row without horizontal overflow.
3. **Phone repair — verified.** At 390×844, the mode row stays full width and the secondary actions use a two-column grid. Mode buttons are 44px tall, the toolbar is 158px high (previously 171px), and the page has no horizontal overflow. Current-run local capture: `02-mobile-preview.jpg`. Viewport override reset after testing.
4. **Interaction checks — verified.** After scrolling, the toolbar top is 0. Switching Search → chat preserves an unsent draft. Tab moves from Search to Research chat; Space activates it. Assignment brief opens the existing Brief panel. No AI request was submitted for these checks.

## Release verification and limits

Clean release `qa:release` passed 599 tests, resource audit, 56/56 strict planner cases / 1,232 assertions, fixture self-test, and production build. The pre-existing bundle-size advisory remains. Screenshots and focused keyboard/geometry checks support this bounded visual repair; they are not a full accessibility audit, a source-accuracy evaluation, or evidence of librarian approval. No search ranking, source authentication, AI generation, or storage behavior changed. Current-run screenshots are retained locally and the live screen will be compared again after deployment.
