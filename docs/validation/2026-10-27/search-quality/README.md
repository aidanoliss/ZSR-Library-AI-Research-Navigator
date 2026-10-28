# Search quality check: October 27, 2026

**What this is:** an automated estimate to find failure patterns and compare pipeline options. It is **not** a human-validated accuracy figure. Relevance was rated by an AI judge (Gemini 2.5 Flash, strict rubric) from titles, types and abstracts only. The re-ranker in the last two variants is the same model family, so those gains are likely somewhat optimistic. Librarian scoring is still required before claiming accuracy.

## Method

- 24 realistic student questions across disciplines, written for this check and never used to tune the parser (`questions.json`).
- Live searches against ZSR Primo (public endpoint) and Crossref fallback, library scope, scholarly mode unless the request asked otherwise.
- The judge rated each of the top 5 results: 2 = directly addresses the question, 1 = related or partial, 0 = off-topic or keyword overlap only (`judge.mjs`).

## Results

| Pipeline | Directly relevant per question (of 5) | Shown results at least related | Searches with no results |
|---|---|---|---|
| Rules only (live today) | 2.13 | 91% | 3 |
| + AI question-reading (when the rules' parse looks weak) | 2.54 | 89% | 1 |
| + AI re-ranking of up to 20 records | 2.75 | 94% | 1 |
| + AI synonyms for every concept, then re-ranking | **3.00** | 95% | **0** |

The last variant improved 12 of 24 questions, made 5 worse (several look like judge noise) and left 7 unchanged. Re-ranking added a median of about 2 seconds.

## After building it in (same questions, same judge, production code path)

Shipped: AI question-reading on weak parses, AI synonyms for every concept, AI re-ranking of up to 20 records, and loose matching for extracted descriptive phrases. Each step falls back to the rule-based search on any failure.

| | Before | After |
|---|---|---|
| Directly relevant per question (of 5) | 2.13 | **3.21** |
| Shown results at least related | 91% | 93% |
| Searches with no results | 3 | **0** |
| Questions better / worse / same | | 13 / 4 / 7 |
| Search time, median / 90th percentile | ~3 s | 6.0 s / 7.2 s |

`production.mjs` runs the production functions (`retrieveResearchContext`, then `searchSourceCandidatesForScope` with `rerank: true`); results in `production-judged.json`. Still weak: gentrification of long-term residents (few relevant records retrieved). Some per-question drops (e.g., Toni Morrison 4 to 1) involve results the strict judge rated "related" rather than "direct"; a librarian should review them.

## Failure patterns found before the change

1. **Over-quoted phrases.** Generic phrases become exact-phrase searches ("history redlining", "long-term residents", "student achievement gaps", "religious responses"), so results are empty or sparse.
2. **The relevance filter requires every word of a phrase.** That shrinks the candidate pool to 5-6 records for many questions, leaving ranking little to choose from.
3. **Keyword ranking, not question ranking.** Records that mention the words outrank records that answer the question (e.g., "parental involvement in homework" above "does homework improve achievement").
4. **News and trade items in scholarly mode.** The public Primo response labels them as articles.

## Files

- `rules-judged.json`, `ai-judged.json`, `rerank-judged.json`, `expand-judged.json`: top-5 results with judge ratings for each variant
- `run.mjs`, `rerank.mjs`, `expand.mjs`, `judge.mjs`: scripts used (run from the repository root with a server-side `GEMINI_API_KEY`)
