# Adding an "AI Research Help" entry to the ZSR homepage

Goal: let students start the Research Navigator from the homepage search area —
*without* implying the AI searches the catalog. Two ready-to-paste options for the
ZSR web team. Replace `NAVIGATOR_URL` with the deployed address
(e.g. `https://zsr-research-navigator.onrender.com`).

> **Labeling matters.** Call it **research help / planning**, never "AI search."
> The tool plans research and points to ZSR resources — it does not search live
> databases or return catalog results. The wording below keeps that honest.

---

## Option 1 — A simple link/tab (easiest)

Place this next to the existing `CATALOG | DATABASES | JOURNALS | ADVANCED` links:

```html
<a class="zsr-ai-help"
   href="NAVIGATOR_URL/"
   title="Plan your research with the AI Research Navigator">
  ✨ Research Help (AI)
</a>
```

No query handoff — it just opens the Navigator. Lowest effort, no JavaScript.

---

## Option 2 — An "AI mode" wired to the search box (seamless)

This takes whatever the student typed in the ZSR search box and opens the
Navigator with that topic, auto-generating a plan (`&go=1`):

```html
<button type="button" class="zsr-ai-help" id="zsr-ai-mode">
  ✨ Not sure where to start? Ask the Research Navigator
</button>

<script>
  (function () {
    var btn = document.getElementById("zsr-ai-mode");
    if (!btn) return;
    btn.addEventListener("click", function () {
      // Adjust the selector to match the homepage search input:
      var input = document.querySelector('input[type="search"], #search, .search-input');
      var q = input && input.value ? input.value.trim() : "";
      var url = "NAVIGATOR_URL/?go=1";
      if (q) url += "&topic=" + encodeURIComponent(q);
      window.open(url, "_blank", "noopener");
    });
  })();
</script>
```

Behavior:
- Student types a topic, clicks the AI button → Navigator opens and **immediately
  produces a research plan** for that topic.
- Empty box → opens the Navigator's normal landing screen.

The app already supports this handoff:
- `?topic=<query>` pre-fills the box.
- `?topic=<query>&go=1` (or `&ask=1`) auto-runs the plan.

---

## Notes
- Keep ZSR's existing **Ask-a-Librarian chat** as-is; the Navigator funnels into it
  (its "Email a librarian" button), so don't add a competing chat widget.
- If the homepage search markup changes, only the `querySelector` in Option 2 needs updating.
- For styling, reuse ZSR's existing button/link classes so it matches the site.
