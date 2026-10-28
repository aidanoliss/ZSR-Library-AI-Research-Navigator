# Layout verification — 2026-10-05

Changed `src/App.jsx`, `src/styles.css`, and `src/navigator.css` on top of the existing uncommitted project work.

- Removed the sidebar My sources shortcut. The main toolbar retains one My sources button; the contextual Saved sources result tab remains.
- Replaced the root serif stack and the two explicit serif declarations with system fonts; input controls inherit the font.
- Folders expand individually. Topic counts, two-line topic names and secondary removal controls reduce clutter. Existing folders and topics are preserved.
- Folder creation opens on request with a labeled field, Create and Cancel. Blank submission disabled; Escape/Cancel dismisses and returns focus to New folder. Global New topic starts unfiled; New topic here is explicit about its folder.
- Desktop1280×900 and mobile390×844 inspected. Mobile document width390 equals viewport390. Main toolbar My sources button count1. Original pillar header remains.
- Checked folder expansion, creation form focus, Create enabled for nonblank input, Escape cancellation, and responsive navigation. Did not remove existing user folders or topics.
- `npm test`:326passed; `npm run build`:passed with existing advisory about a JS bundle over500kB. `git diff --check`:passed.
- Local preview server was restarted after it stopped during the session; HTTP200 confirmed on port3002. Fresh preview tab renders the updated app.

Screenshots: `layout-desktop.jpg`, `layout-mobile.jpg`.
