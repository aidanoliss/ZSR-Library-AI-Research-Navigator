# Browser regressions with synthetic fixtures

Build the application, then start the separate loopback fixture server:

```sh
npm run build
node scripts/browser-fixture-server.mjs --self-test
node scripts/browser-fixture-server.mjs
```

Open `http://127.0.0.1:3004` in a separate browser tab/profile. Use synthetic topics and clear that origin's saved browser data between independent tests. Set `ZSR_FIXTURE_PORT=3005` to change the port. The server binds only `127.0.0.1`; it does not load `.env`, import a provider client, make provider requests, or persist submitted data. The browser still uses its ordinary local workspace storage.

This server serves the current production `dist` bundle. Rebuild after frontend edits and refresh the tab. It is a testing tool, not a deployment option; the production start and build scripts are unchanged.

The pure `buildFixturePayload(body, origin)` and `createFixtureServer({distDir, delayMs})` exports can be imported by a browser harness. Importing the module does not open a listening port. `--self-test` starts an ephemeral loopback port and checks shape, deterministic planning, streaming, failure outcomes, cancellation, and malformed requests.

## Normal source and workspace journey

1. Choose a response style that returns sources and submit `Find 3 peer-reviewed sources from 2022-2026 about adolescent sleep`.
2. Confirm the interpreted request retains the count, date range, and peer-review requirement. The research specification and routes come from the real deterministic planner.
3. Expect three titles beginning `[SYNTHETIC TEST FIXTURE]`: a 2025 journal article with explicit peer-review metadata, a 2024 article with unknown peer review, and a 2018 background book reported not peer reviewed. Fixture records deliberately retain known mismatches so the UI can exercise all three states; production discovery normally filters mismatches.
4. Save the three records and open **My sources**. Mark them **Use**. Expect one metadata-supported source, one requiring verification, and one mismatch for this request. Database paths and saved searches must not count as sources. Source titles, authors, year, provider, access label, and peer-review evidence must remain attached after saving.
5. Select two or three sources to compare. Verify differences remain visible at narrow widths, comparison can scroll without widening the page, and a fourth source cannot be selected.
6. Add a note and citation details. Open **Review**, export JSON, and import it into a new chat. Verify notes and provenance survive, imported assertions become unverified, and imported assignment text does not enable AI submission. Import the same file again and verify duplicate items are skipped.
7. Try invalid JSON, an unsupported version, a file over 2 MB, and a JSON source URL starting `javascript:`. The import must show an error and preserve existing work. Try a file that would exceed 100 saved items. Verify capacity is reported before any overwrite.
8. Export/copy the Markdown review packet and verify the saved details are represented. Where clipboard permissions are denied, expect a visible error rather than a success notice.

Fixture source links open local pages saying that the record is synthetic. There are no real DOI, PMID, or ISBN values. Curated database links still come from the real planner; opening them navigates to their normal external sites. This fixture does not validate those sites, provider relevance, or licensed access.

## Failure controls

Append a tag to a normal research prompt. The server removes it before calling the planner.

| Tag | Expected behavior |
| --- | --- |
| `[fixture:delay]` | Stream emits an initial progress event, then waits 15 seconds before completing. Start a new chat, switch chats, or cancel during the delay; the old answer must not reappear or enter the new chat. |
| `[fixture:error]` | Both chat endpoints return HTTP 503. Expect the normal local-plan fallback and a clear failure explanation. |
| `[fixture:stream-retry]` | Stream closes before completion. The buffered retry returns a complete fixture response. Expect one completed answer. |
| `[fixture:empty]` | No records; provider outcome is `empty`. Expect an honest no-results state and usable next steps. |
| `[fixture:timeout]` | No records; provider outcome is `timeout`. The UI should explain a provider timeout rather than blame the topic. |
| `[fixture:rate-limit]` | No records; provider outcome is `rate_limited`. The UI should distinguish rate limiting from zero matches. |

The source scope control is honored: Library puts all records in the library lane; Open access puts them in that lane; Both splits the fixtures across the two. All provider names explicitly say synthetic. Feedback returns a synthetic success response without storing anything. Other administrative/handoff APIs are intentionally unavailable in this fixture server.

## Keyboard, mobile, and storage checks

- Open the workspace using the keyboard. Close receives focus; Escape closes and restores the opener. Tabs support Left/Right wrap, Home, and End, with one tab in the tab order and matching panel labels.
- Use only the keyboard to save sources, change status, select comparisons, open source details, and reach JSON import/export. Success and failure messages should be announced by a screen reader.
- Inspect the initial screen, a completed answer, interpretation editor, workspace, and comparison at 320 px width and 200% zoom. Ensure no page-level horizontal overflow or blocked composer.
- Test disabled or full `localStorage`, reload recovery, and a pending request during session switching. Expect a visible storage warning with a usable export path; these browser failures are separate from fixture provider controls.
- Verify **Share Navigator** communicates sharing the application URL, while plan/workspace exports communicate sharing research content.

Record the tested commit, browser, viewport, keyboard/screen-reader method, scenario, expected/actual result, and any screenshot or trace. Passing these UI fixtures does not establish librarian approval, source correctness, accessibility conformance, live-provider reliability, or production readiness.
