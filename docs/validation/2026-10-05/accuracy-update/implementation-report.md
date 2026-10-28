# Source accuracy and black sidebar update

Implemented and verified on 5 October 2026. The local preview is served at http://127.0.0.1:3002/.

## Changes

- Primo and Crossref retain up to 20,000 characters of provider abstract metadata separately from the short card preview. OpenAlex also retains a longer reconstructed abstract. Ranking and source checks use the fuller metadata. Existing collapsed Details exposes it for inspection; no full article text is retrieved.
- AI evidence packets use bounded provider passages up to 4,000 characters per source and 32,000 characters total. A quoted passage still must match the exact passage supplied to the model. Generated interpretations are stripped from extractive notes. The general AI orientation remains explicitly unverified.
- Comparison labels require both comparison sides and the requested anchor topic in the relevant statement. An unrelated comparison or the phrase “comparative politics” does not establish the requested relationship.
- Confirmed source requirements influence ranking. Explicit method descriptions, participant statements, and study periods can establish or contradict a requirement. Missing or ambiguous evidence remains unverified. A period being studied is distinct from a publication-date filter; newer historical scholarship remains eligible.
- Reviews and hearings are distinguished from requested books or original research where metadata establishes their role. Source-role guidance uses fuller abstracts and avoids treating negated, planned, or prior-study methods as the current work's methods.
- Chapter deduplication uses converging title, author, book-identifier, container, abstract and pagination evidence. A partial page range such as 13- is compatible with 13-26, but conflicting known identifiers, editions or page ranges remain separate. Abstract text, preview and attribution stay with one provider when records merge.
- Sidebar and former dark-brown primary buttons share #111111. Gold accents and the original pillar background remain. Desktop has a close button and a 64px collapsed rail with an expand button; mobile starts compact. Escape closes the sidebar and restores toggle focus. Hidden sidebar controls leave the tab order.

## Verification

- **354/354 automated tests passed.** Production build passed; the existing bundle-size advisory remains (approximately 531 kB minified JavaScript).
- Browser checks covered desktop 1280px wide and mobile 390×844: black computed backgrounds, close/expand behavior, Escape focus, one My sources shortcut, and no horizontal overflow. A fresh complete sanctions search returned ten leads, with five displayed initially and five behind Show more.
- The sanctions result's Details showed 1,409 characters of provider abstract. Its displayed AI-selected passage exactly matched that provider text. This establishes quotation identity for that inspected passage, not correctness of every interpretation or finding.
- The final 28-query live provider capture returned sources for **24/28 queries (85.7%)**, compared with **22/28 (78.6%)** in the earlier capture. At least five sources were returned for **17/28**, compared with **15/28**. The final capture contains 186 candidates and 102 returned top-five records.
- The duplicate detector found **zero duplicate candidates or top-five duplicates** in the final capture. The previously corroborated Vogel chapter pair now appears once; both access routes remain available. This is not a guarantee that every future duplicate is detectable.
- Two individual Primo query alternatives timed out (democratic-sanctions and urban-biodiversity); other alternatives returned ten records for each. Four searches remained empty: the three sparse-topic cases and the open-access-only case. OpenAlex remains unconfigured; a missing provider is not evidence that no literature exists.

## Concrete search regressions checked

1. Sanctions: “Sanctions and Regime Type: What Works, and When?” ranks first. A Venezuela article comparing democracy/autocracy promotion is labeled supporting, not a verified comparison of sanctions across target regime types.
2. After-2015 minimum-wage request: the Oregon restaurant study whose abstract specifies 2000–2007 is excluded. Other records with unclear study periods remain labeled as needing verification.
3. Explicit qualitative-interview request: later method and participant passages are now available and can establish the requested method without relying on the first two abstract sentences.
4. The Vogel chapter's subtitle/date/page-range variants merge, while deliberately conflicting work identifiers and known page ranges remain separate in regression tests.

## Limits

These are engineering checks and one repeated retrieval benchmark, not a representative human accuracy study. All human usefulness judgments in the capture remain blank. The earlier 40.4% AI excerpt-based direct-fit figure is not comparable to the new 85.7% source-return rate. No new overall relevance, claim-support or hallucination percentage is established.

**Hallucinations and misgrounded claims remain possible.** Real citations do not establish that an AI claim is supported. Exact quotation validation does not prove that a selected passage answers the question or represents the study fairly. Metadata-based checks can miss wording variations, and books or supporting articles may still be imperfect fits. Students and librarians should evaluate the returned works and substantive claims before broader deployment.

## Evidence

- [Final provider capture](provider-capture.json) and [automated report](provider-report.md)
- [Machine-readable metrics](quality-metrics.json)
- [Desktop result layout](results-desktop.jpg)
- [Expanded mobile sidebar](sidebar-mobile.jpg)
- [Collapsed mobile sidebar](sidebar-mobile-collapsed.jpg)
- The restricted-network capture and first-pass capture are retained separately; neither is presented as the final result. The restricted run could not reach providers and was rerun with network access.
