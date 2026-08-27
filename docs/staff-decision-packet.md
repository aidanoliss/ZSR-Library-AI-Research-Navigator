# Staff Decision Packet

## Decisions needed

| Decision | Recommended pilot default | Why it matters |
| --- | --- | --- |
| Initial subjects | Psychology/communication, biology/health, and education | These are common student workflows and have strong named-database routes in the current evaluation set. |
| Human evaluation scope | Review all 47 prompts once, then maintain a smaller release gate | Automated checks cannot judge disciplinary usefulness. |
| Acceptance threshold | Average human score at least 4/5 in each category; no unsafe or clearly unrelated route | A high average must not hide a harmful recommendation. |
| Catalog display threshold | Show only records passing the relevance filter; disclose zero or uncertain results | Sparse results are safer than off-topic citations. |
| Resource metadata owner | One named ZSR unit plus a reviewer for each subject area | Database names, licenses, and guidance change. |
| Review cadence | Quarterly and whenever a database, API, or policy changes | Prevents stale routing and access claims. |
| Query logging | Off | Research topics can be sensitive and no retention purpose is approved. |
| Handoff contact retention | Off | Contact data is unnecessary for email-draft generation. |
| Browser-local work | Keep local and unsynced | Avoids creating an unreviewed student-record system. |
| AI provider | Institutionally approved account and model | Defines procurement, privacy, billing, and incident ownership. |
| Hosting | ZSR/WFU-controlled Node environment | The app requires a server API and protected secrets. |
| Authentication | None for the first limited pilot | Add only if a concrete protected workflow requires it. |
| Primo access | Approved API in staging before wider rollout | Public discovery calls are best effort and not an official integration. |
| LibGuides/A-Z source | ZSR-owned reviewed export | Replaces hand-maintained prototype metadata. |
| Accessibility sign-off | ZSR/WFU accessibility review | Prototype tests are not a WCAG conformance claim. |
| Support escalation | Ask ZSR general fallback plus a named technical owner | Students and staff need separate content and outage routes. |

## Human scoring form

For each evaluation prompt, score 1-5:

1. **Path relevance:** Are the named databases the right places to search?
2. **Search-term quality:** Are the Boolean/keyword searches anchored, varied, and executable?
3. **Catalog precision:** Would the displayed source leads be safe to show a student?
4. **Fallback safety:** Do recovery suggestions narrow or broaden one concept without losing the topic?

Record missing resources, incorrect labels, questionable wording, and the recommended replacement. A score of 1 or 2 blocks release for that case even if the overall average passes.

## Proposed meeting outcome

The next staff meeting should produce:

- selected pilot subjects
- assigned resource/configuration owner
- API and metadata-access contacts
- approved privacy defaults
- agreed human-review threshold
- accessibility reviewer
- hosting and support owner
- a go/no-go date for replacing the frozen demo
