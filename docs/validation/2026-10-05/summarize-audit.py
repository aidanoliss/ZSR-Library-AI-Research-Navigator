import json
from pathlib import Path
from collections import Counter
root=Path(__file__).parent
capture=json.loads((root/'provider-capture.json').read_text())
a=json.loads((root/'relevance-first-half.json').read_text())
b=json.loads((root/'relevance-second-half.json').read_text())
reviews=a['reviews']+b['reviews']
expected={(c['id'],s['rank']):s for c in capture['cases'] for s in c['candidates'][:5]}
assert len(reviews)==len(expected)==89
assert len({(r['caseId'],r['rank']) for r in reviews})==89
for r in reviews:
 assert expected[(r['caseId'],r['rank'])]['sourceId']==r['sourceId']
counts=Counter(r['category'] for r in reviews)
assert set(counts)<=set(['direct','supporting','unsuitable','uncertain'])
assert all(s['judgment'] is None for c in capture['cases'] for s in c['candidates'])
direct_cases={r['caseId'] for r in reviews if r['category']=='direct'}
metrics=json.loads((root/'quality-metrics.json').read_text())
metrics['aiAssistedRelevance']={'categories':dict(counts),'casesWithAtLeastOneDirect':len(direct_cases),'cases':28,'reviewedTopFiveRecords':89,'directAmongReturnedRate':counts['direct']/89,'directCaseRate':len(direct_cases)/28,'method':'AI-assisted reading of displayed title, date, type and provider abstract excerpts; provisional, not human or full-text validation.'}
metrics['notes']=[
 '100% DOI/title corroboration applies to the 78 DOI-bearing records out of 89 returned top-five records. It does not grade all metadata fields, relevance, study quality, peer review, access, or generated claims.',
 'Five Crossref 429 responses resolved through slow targeted retries; original responses are retained.',
 'The automated duplicate count of zero missed one same-chapter pair across ISBN-linked title/date variants.'
]
(root/'quality-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
rows=[]
for c in capture['cases']:
 ct=Counter(r['category'] for r in reviews if r['caseId']==c['id'])
 rows.append(f"| {c['id']} | {len(c['candidates'])} | {ct['direct']} | {ct['supporting']} | {ct['unsuitable']} | {ct['uncertain']} |")
report=f'''# Navigator layout and source audit — 5 October 2026

The layout update is complete. In this test set, publication identities checked well, while fit to the full research request remained uneven. There is no validated overall accuracy rate or zero-hallucination claim.

## Layout delivered

System fonts replace serif body and control text. Only the main toolbar retains a My sources shortcut. Folder rows expand individually and show topic counts; creation fields open on request, with normal Create and Cancel buttons. Folder removal is secondary, and topics remain preserved. Long topic names use two lines. Desktop and mobile spacing were checked, and the original pillar header remains.

All 326 automated tests pass. Production build passes with the existing bundle-size advisory. Browser checks covered desktop 1280×900 and mobile 390×844, one My sources button, folder expansion, field focus, blank submission disabled, Escape cancellation, and no horizontal page overflow. See [UI verification](ui-verification.md), [desktop screenshot](layout-desktop.jpg), and [mobile screenshot](layout-mobile.jpg).

## Measured retrieval and identity

| Measure | Result | Meaning |
|---|---:|---|
| Queries returning at least one source | 22/28 = 78.6% | Availability, not relevance or accuracy |
| Queries returning at least five sources | 15/28 = 53.6% | Enough records to fill the initial five slots |
| Returned top-five records reviewed | 89 | Across 140 possible slots; all empty queries remain in query denominators |
| DOI records registered and title-corroborated | 78/78 = 100% | DOI-bearing subset only; 11 records without DOIs are excluded from this percentage |
| Queries with a clearly direct match in the first five | {len(direct_cases)}/28 = {len(direct_cases)/28:.1%} | Provisional AI assessment from available metadata |
| Clearly direct matches among returned top-five records | {counts['direct']}/89 = {counts['direct']/89:.1%} | Full-request topical fit, not scientific validity |
| Human or librarian accuracy ratings | Not measured | Student and librarian review has not occurred |
| Factual accuracy of generated narratives | Not measured | This provider capture makes no generative AI requests |

The live capture used the current application planner, query compiler and retrieval path, up to ten candidates per query, and 28 existing benchmark prompts. It returned 149 total candidates. Average observed retrieval time was about 2.05 seconds; this excludes AI response generation. The previous 4 October capture also returned sources for 22/28 queries. This layout change provides no evidence of better retrieval coverage.

One Primo query alternative timed out, but other alternatives returned ten results for that topic. OpenAlex was disabled because its API key is not configured. Six topics returned no sources: rent control/housing supply, local night-shift transit, Indigenous language makerspaces, floating-wetland microplastic capture, the open-access-only query, and the mixed-access misinformation query. The last two were affected by disabled open-access retrieval; the mixed case also had an empty library result. Empty search results are not proof that relevant literature does not exist.

For DOI corroboration, 74 titles matched after punctuation/case/diacritic normalization. Four were confirmed on publisher pages as subtitle or review-label variations. All 78 DOI lookups succeeded after five rate-limited responses were retried slowly. Crossref and library indexes may share deposited metadata, so this is corroboration, not an independent audit of the research. The 11 no-DOI records were only partly spot-checked. [Raw identity checks](identity-verification.json), [original rate-limit responses](identity-verification-initial.json), and [publisher checks](publisher-review.json) preserve the evidence.

## Relevance screening

| AI-assessed category | Count | Share of the 89 returned records |
|---|---:|---:|
| Direct: requested facets supported in available metadata | {counts['direct']} | {counts['direct']/89:.1%} |
| Supporting: useful background or partial fit; some facets unconfirmed | {counts['supporting']} | {counts['supporting']/89:.1%} |
| Unsuitable: contradicted requirements or clearly wrong fit | {counts['unsuitable']} | {counts['unsuitable']/89:.1%} |
| Uncertain: insufficient information | {counts['uncertain']} | {counts['uncertain']/89:.1%} |

Two AI reviewers split the queries; they did not independently double-score every result. Ratings were based on source titles, bibliographic metadata and saved abstract excerpts, without treating the app's match labels as truth. The main reviewer checked the counts, source IDs and selected judgments. This is a diagnostic screen, not human-validated precision, an inter-rater reliability study, or a representative estimate for all student questions. Supporting does not mean a source meets the complete assignment. Repeated work can also inflate supporting counts.

A major limitation is in the app itself: `server/primo.js` keeps approximately the first two abstract sentences, capped at 360 characters. Methods and findings may be omitted. In the explicit interview query, all five sources look relevant but the saved excerpts do not establish interviews. Their supporting labels mean the requirement is unconfirmed, not that the papers use the wrong method. Full abstracts or full text could change these ratings. Provider-reported peer review is not independently certified.

| Benchmark case | Total returned | Direct in top five | Supporting | Unsuitable | Uncertain |
|---|---:|---:|---:|---:|---:|
'''+'\n'.join(rows)+'''

The original capture retains every human judgment as null. Detailed AI reasons are in [first-half review](relevance-first-half.json) and [second-half review](relevance-second-half.json).

## Concrete findings

- **Sanctions comparison:** ten sources returned. The leading Brooks paper explicitly compares authoritarian and democratic responses. Only one of the first five directly establishes the requested comparison in the saved evidence; the other four are supporting work about authoritarian targets or democratization.
- **Comparative therapies:** none of the first five clearly establishes a head-to-head CBT versus mindfulness comparison from the captured evidence. Combined interventions should not be presented as answering that comparison.
- **Dates and populations:** a 1978 newspaper item and a study of 2000–2007 restaurant employment do not cover an after-2015 study period. A high-school writing study does not satisfy an undergraduate population request.
- **Book search:** government hearings occupy the first two positions for introductory environmental-justice books. The first hearing is real, as [GovInfo confirms](https://www.govinfo.gov/app/details/CHRG-118shrg62383/CHRG-118shrg62383), but it does not meet the requested introduction/book purpose.
- **Source types:** the abolition query returns a newspaper review of a novel and a review of a historical book. A first-generation-student result is explicitly a [book review on its journal page](https://pubs.lib.umn.edu/index.php/jcotr/article/view/4869). Students need that distinction before treating it as original research.
- **Primary sources:** the Greensboro query retrieves Wichita oral-history material and an interview without enough metadata to establish fit. [The originating repository](https://www.thehistorymakers.org/node?page=343) confirms the Wichita context. A real oral history can still be the wrong source for this question.
- **Exact items:** the requested Ostrom book and original Hardin article rank first. [Cambridge confirms the Ostrom edition](https://www.cambridge.org/core/books/governing-the-commons/A8BB63BC4A1433A50A3FB92EDBBB97D5).
- **Duplicates:** automatic checks reported zero, but human-readable metadata inspection found the same Vogel chapter at ranks three and four of the Hardin query. Shared book ISBN, authorship and chapter contents establish the overlap despite title/date variation; see [Anthem's contents](https://anthempress.com/media/pdf/9781843318743.pdf). The detector's zero is not reliable evidence of duplicate-free results.
- **Metadata accuracy:** the 2013 sanctions working paper exists, but captured metadata calls it an article and lists a distributor as publisher. [GIGA identifies the originating working paper](https://www.giga-hamburg.de/de/publikationen/giga-working-papers/dictators-equal-selective-targeting-democratic-sanctions-authoritarian-regimes). Corroborating a title does not validate every field.

## What the results imply

The next source-quality priorities are retaining fuller abstracts internally while keeping cards concise; ranking on requested comparisons, methods, study periods and populations; distinguishing introductory books, government documents, reviews and news; grouping duplicate works across provider/title/edition variants; and restoring configured open-access retrieval with transparent recovery for sparse searches.

These checks are useful preparation for the student trial. Ask students to identify the source type, explain how it answers the exact question, and open the underlying work. Have a librarian independently grade the same returned set before reporting a validated relevance rate. Keep the brief excerpt and full-source judgments separate so missing metadata is not mistaken for a poor paper.

**Hallucinations remain possible.** No unregistered DOI or fabricated DOI/title pairing was found in the 78-record DOI subset. This does not establish zero fabricated sources elsewhere. More importantly, a real citation can accompany an invented or misgrounded AI claim. Exact quotation validation prevents invented quotation text from passing that check, but it does not prove the selection is relevant, complete or accurately interpreted. The current run did not measure generated narrative claim accuracy, full-text validity, retractions, access entitlement, or literature-search completeness.

## Reproduce and inspect

The live capture and identity scripts make read-only provider requests. Network access and provider limits apply.

```sh
node scripts/capture-search-quality.mjs --live --candidates 10 --write /tmp/zsr-new-capture.json
node scripts/evaluate-search-quality.mjs --input docs/validation/2026-10-05/provider-capture.json --before docs/validation/2026-10-04/provider-capture-after.json
node docs/validation/2026-10-05/verify-identities.mjs
python3 docs/validation/2026-10-05/summarize-audit.py
```

`verify-identities.mjs` uses the saved capture beside it and refreshes identity-verification.json. Do not rerun it over the archived audit without preserving that artifact first. AI relevance judgments and publisher spot-checks require a new review when the source capture changes. The unmodified [provider capture](provider-capture.json), [automated report](provider-report.md), and [metric definitions/counts](quality-metrics.json) are retained.
'''
(root/'audit-report.md').write_text(report)
print(json.dumps(metrics['aiAssistedRelevance'],indent=2))
