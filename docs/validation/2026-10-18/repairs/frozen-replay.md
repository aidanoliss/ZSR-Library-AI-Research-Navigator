# Frozen retrieval replay — October 18, 2026

**This is a deterministic regression replay, not an accuracy metric or human review.** No network/provider/model calls were made. Earlier model judgments are retained as comparison labels, not treated as ground truth.

## Method

Rebuilt each of the twelve audited research plans with the original explicit source mode, then ranked its already-captured records against the repaired interpretation. Recomputed requirements and relevance, and grouped possible editions/versions. The input contains only the old run's returned records: it cannot show whether new queries retrieve better sources or resolve previously empty searches. Exact input/code SHA-256 hashes, plans, routes, queries, per-record checks and exclusions are in [frozen-replay.json](frozen-replay.json). This is the working-tree snapshot at 2026-10-18T22:53:50.981Z, not proof of a deployment.

## Observations

- **32 frozen records → 26 retained records → 24 displayed work groups.**
- All **6/6 earlier model-labeled candidate records remain**; no candidate loss was observed within this small fixed pool. Two are editions of the same Ostrom book. This is not a retrieval recall estimate.
- **Five of six earlier wrong-constraint records are excluded:** the meta-analysis requested as an RCT, both WWI records requested as WWII, and two original studies requested as systematic reviews.
- The sixth is a different book about the commons: retained as **related-work / partial**, not a matched requested item. Its separation from qualified sources depends on the results UI.
- One additional prior partial nursing record is excluded because the repaired question retains the readmission outcome and that outcome is absent from its metadata. It was not previously judged a complete-request candidate. A librarian may still want it as an explicitly broadened background lead.
- The Bangladesh record discussing women in another country's case study remains **partial**, with population, geography and their relationship unverified. It is not promoted to a complete match.
- Six records across five work groups are metadata-supported by current checks. This is a software classification, **not a claim that five works are academically correct or sufficient**.

| Audited request ID | Frozen records | Retained records | Work groups | Metadata-supported groups |
|---|---:|---:|---:|---:|
| sanctions-comparison | 10 | 10 | 10 | 2 |
| population-geography-method | 1 | 0 | 0 | 0 |
| historical-period | 6 | 4 | 3 | 0 |
| humanities-books | 1 | 1 | 1 | 1 |
| known-book | 3 | 3 | 2 | 1 |
| nursing-review | 2 | 1 | 1 | 0 |
| local-data | 0 | 0 | 0 | 0 |
| historical-primary | 0 | 0 | 0 | 0 |
| education-comparison | 0 | 0 | 0 | 0 |
| science-review | 5 | 3 | 3 | 1 |
| geography-method | 4 | 4 | 4 | 0 |
| negative-known-item | 0 | 0 | 0 | 0 |

## Interpretation and routing checks

- CBT versus mindfulness and AI writing assistants versus peer feedback are now the actual comparison arms; “comparing” is absent from concepts. First-year college students remain the population.
- World War II remains distinct from World War I; 1939–45 remains the subject period and publication since 2020 remains a publication filter. The historical request now leads with Historical Abstracts, excludes PubMed, and retains Britain as its geography. Clinical women studies still route to medical tools.
- Primary datasets select data mode and the existing ICPSR/Statista routes. Archival letters/diaries compile as alternatives and lead to Special Collections/Digital Collections. No new holdings or access claims are made.
- The invented book's author is Amelia Quasar; “published in 2024” is a publication requirement, not author text or historical scope. The frozen empty pool remains empty, which does not test the new query against live providers.
- Ostrom's 1990/2015 records group as possible editions while preserving their identifiers. The two Women and the ACT chapters group as possible versions. Neither operation destructively merges citations.

## Remaining uncertainty and follow-up

Partial nursing, historical and migration records retain unverified population/method/period checks. The original empty data, archives and education pools are still empty by construction; the new routing needs live task completion testing. Run fresh constrained retrieval and have independent ZSR reviewers assess full-request fit, then verify the UI keeps partial/related material separate. No empirical claim about improved search accuracy follows from this replay.

Final replay includes the later comparison-arm eligibility, scoping-versus-systematic review, and bounded educational ellipsis repairs. The original frozen pool contains no online-teaching request; that defect is covered by separate regression tests and needs its own fresh-provider check.
