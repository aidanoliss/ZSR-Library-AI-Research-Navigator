# Retrieval reliability and full-request ranking — October 16, 2026

Implemented after the df328d5 design release. Evidence distinguishes deterministic regressions, replay of captured metadata, local live-provider checks, and public deployment verification.

## Changes

- Public Primo, institutional Primo, Crossref and OpenAlex requests now bound headers and body consumption with a rejecting deadline as well as AbortSignal. One transient-error retry fits within the original request budget. Caller cancellation never retries; permanent HTTP errors and 429 without a usable Retry-After do not trigger immediate retries. Discovery retains explicit timeout/error outcomes and retry telemetry.
- A shared DOI extractor preserves balanced suffix parentheses in catalog records, research-plan parsing and access links, without inventing missing characters.
- The first five ranked sources receive a bounded, cached Crossref DOI/title corroboration check (up to two additional seconds shared across checks). Missing/unavailable registry records remain unverified. A title discrepancy is flagged on the result card and both titles remain inspectable in Details; no silent metadata replacement and no claim of verified findings.
- Complete request matches outrank keyword density. Partial matches are ordered by established population, geography, methods, study period and comparison evidence. Unknown metadata is retained and labeled, rather than treated as either confirmed fit or proof of incompatibility.
- Undergraduate-only requests preserve that narrower population. Geography checks require study-setting evidence rather than subject tags, affiliations or prior-study mentions. Explicit method subtitles are recognized. CBT and its expanded spelling share controlled-vocabulary alternatives.

## Observed evidence

The frozen October 16 source pool is replayed unchanged in `frozen-pool-replay.json`. The explicit offshore-wind systematic review moves from rank 4 to rank 1. The undergraduate-sample record moves from rank 2 to rank 1 in the AI/critical-thinking case; other college/university samples remain partial. This tests ordering and scope labels, not causal relevance or scientific accuracy.

Eight selected queries were run against public bibliographic providers using the updated local backend, with no AI generation (`live-provider-check.json`). The three originally timed-out cases returned 10 therapy-comparison sources, 10 background-book sources and 3 exact-title book records. The first timing run also had two anomalously long wall-clock intervals (~21.6 and ~16.8 minutes); these are preserved, not discarded or counted as passing latency evidence. Their cause was not established.

A separate instrumented follow-up (`timing-followup.json`) returned 10 sanctions sources in 3.239 seconds, 10 Bangladesh migration sources in 1.655 seconds, and 5 offshore-wind sources in 1.008 seconds. Maximum 100ms-timer gaps were 161ms, 104ms and 102ms. The systematic review ranked first in that live follow-up. These observations do not establish a service-level guarantee or explain the earlier wall-clock anomalies.

The corrected DOI `10.4335/12.1.145-162(2014)` resolves in Crossref. Crossref supplies “Electoral System Changes and Voter Turnout: Reflections on New Zealand Local Elections”; the captured catalog title says General Elections. `registry-defect-check.json` preserves the actual registry comparison and the resulting title-difference flag. This is an identity-metadata defect, not evidence that the publication was invented.

## Limits

No independent human relevance scores, full-text scientific judgments, generated-claim accuracy, comprehensive recall or zero-hallucination guarantees were established. A metadata-supported label means the inspected fields support the requested constraints; it does not establish that the paper answers every aspect of the research question. Partial searches can still occur when some providers time out, and Render cold starts remain outside the per-provider deadline.

## Released and checked in production

Commit `ab979a370ad297c546d77cdf59562cebebc8fbdb` is live on Render; GitHub Actions succeeded. Final release checks: 411 tests passed, resource audit, strict developer evaluation, synthetic browser fixture self-test, and production build.

`production-check.json` preserves five fresh public streaming-API source-stage checks:

| Query | Sources | Source-stage wall time |
|---|---:|---:|
| Electoral systems | 9 | 3.938 s |
| CBT / mindfulness comparison | 10 | 7.187 s |
| Offshore wind systematic reviews | 5 | 1.580 s |
| Environmental-justice books | 10 | 3.095 s |
| Exact Ostrom book | 3 | 0.550 s |

The systematic review is first in production and was also confirmed in the browser (`live-ranking.png`); remaining method-unconfirmed records explicitly say scope needs checking. The electoral record now carries the complete DOI. Its live registry check was unavailable in this run and is correctly marked unverified; the separate successful registry check remains the evidence for its title discrepancy. Other title/subtitle differences were surfaced in the public result payload.

The three earlier timed-out questions returned sources in this production check. That is evidence of successful delivery on this run, not proof that retries caused every recovery or that intermittent failures cannot recur. Generated claim accuracy remains unmeasured.
