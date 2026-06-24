# ZSR Research Navigator — Project Summary

**An AI research-planning assistant for Wake Forest students.** It helps students
figure out *how* to research a topic using ZSR Library — where to start, what to
search, and how to judge sources — without doing the work for them.

---

## What it does (the student experience)

A student types a topic or assignment prompt into a search bar. The tool replies
with a clear, structured **research plan**:

- **Recommended starting points** — specific ZSR resources (databases, guides,
  Special Collections, etc.), each with what it's best for and access notes.
- **Search terms to try** — including Boolean examples, each with one-click links
  to run it in **ZSR's catalog** or Google Scholar.
- **Real results from ZSR's catalog** — a few actual matching books/articles
  (title, author, year, link to the record), pulled live from ZSR's discovery
  search. These come from the library's catalog, not the AI.
- **Key journals to look in** for the field, and **how to evaluate sources**.
- **Citation guidance** and a **responsible-AI / academic-integrity** reminder.
- A **"Stuck? Email a ZSR librarian"** button that pre-fills a message with the
  student's topic.

Students can keep chatting to refine the topic. Vague topics ("climate change")
get a clarifying question first. They can copy, print, export, or share the plan.

## What it deliberately does NOT do (by design)

This is the core of the design and the trust model:

- The **AI never invents** article titles, citations, database names, or links.
  Real results shown to students come **directly from ZSR's catalog**, not the AI.
- It does **not** open, read, summarize, or quote paywalled / copyrighted
  full-text content. If asked to, it **redirects** the student to ZSR or a librarian.
- Recommended resource links come **only** from a **curated, librarian-controlled
  list**; any link the AI tries to invent is automatically stripped.
- It does **not** write the student's essay or do the assignment.

These limits are enforced **in code**, not just by instructions to the AI.

## How it works (plain version)

1. The student's topic is matched against a **curated list of ZSR resources** (a
   file the library controls) using tags and keywords.
2. The topic + matched resources are sent to **Google's Gemini AI**, with strict
   rules about what it may and may not do.
3. Before anything reaches the student, the system **strips any link the AI
   invented** — only curated, real ZSR links survive.
4. Off-topic, abusive, or "do my homework" requests are caught and redirected
   **before** the AI is even called.

## Features at a glance

| Area | What's there |
|---|---|
| Interface | Clean, academic search-bar landing → conversational chat; works on mobile |
| Research plan | Resource cards, real ZSR catalog results, search terms with one-click search, key journals, source-evaluation tips, citation help, research-roadmap diagram |
| Safeguards | Curated-links-only enforcement, paywall/full-text refusal, relevance & abuse filter, rate limiting |
| Librarian tools | Student feedback (👍/👎/"missing a resource"), topic logging to reveal demand & gaps |
| For students | Save / print / export the plan, shareable link, librarian email handoff |

## Technology & data

- **Frontend:** React (Vite). **Backend:** Node / Express. **AI:** Google Gemini.
- **The data is the product:** all recommendations come from `resources.json`, a
  curated file of real ZSR pages that a librarian maintains. Richer entries →
  better recommendations. Specific subject databases can be added anytime.
- Quality is protected by an automated test suite, including adversarial tests
  that confirm the AI refuses paywalled summaries and never surfaces a fake link.

## Status & what's needed to go live

- **Working today** with real ZSR links and live AI; ready for a private librarian demo.
- **To pilot with students:** a librarian to confirm/expand the resource list,
  institutional sign-off on branding and on logging anonymous query topics, and
  hosting on a Wake Forest–approved URL.
- **Natural home:** linked from ZSR's "How do I…?" / research-help areas as a
  "Plan your research" companion that funnels students to databases and librarians
  — it complements, not replaces, the existing search and Ask-a-Librarian chat.
