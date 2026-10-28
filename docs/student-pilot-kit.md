# Controlled Student Pilot Kit

## Decision before recruitment

Treat this as a formative usability pilot, not evidence that the tool is institutionally approved or statistically validated. Before posting a recruitment message, ask Amanda, a faculty advisor, and the Wake Forest IRB for a written determination about whether the activity is internal service evaluation or human-subjects research.

Wake Forest states that only the IRB can make that determination and that recruiting cannot begin before required review. If the findings may be published, presented outside an internal product review, or used as generalizable research, assume formal review may be needed. A student-led research protocol also needs a faculty advisor.

Default privacy posture:

- use participant IDs such as `P01`, never names in the scorecard;
- do not collect student IDs, course grades, health information, or private assignment text;
- use synthetic topics or participant-volunteered non-sensitive topics;
- do not record screens, audio, or video unless the approved protocol explicitly permits it;
- keep application query logging and detailed feedback storage off;
- allow participants to skip any question or stop at any time; and
- set a deletion date before collecting data.

## Pilot question

Can students use ZSR Research Navigator to move from an assignment-sized topic to an appropriate database, an executable search, and one plausible source lead with less confusion than their normal starting process?

This pilot is intended to find usability failures and unsafe claims. It is not designed to prove learning gains, compare student groups, or replace librarian judgment.

## Participants

Recruit 8 to 12 volunteers:

| Cohort | Target at n=12 | Minimum at n=8 |
| --- | ---: | ---: |
| First-year writing students, mixed intended majors | 4 | 3 |
| Humanities or social-science students with a research assignment | 4 | 3 |
| STEM students with a research assignment | 4 | 2 |

Aim for variation in prior library experience and self-reported research confidence. Do not recruit only friends, power users, or students from one course.

## Roles

- **ZSR partner:** approves task framing, observes selected sessions, and reviews route/source relevance.
- **Faculty advisor:** owns student-research oversight if the IRB treats the work as research.
- **Moderator:** reads the same script, avoids coaching, and marks observable events.
- **Timekeeper/note-taker:** records timestamps and confusion events using participant IDs.
- **Technical observer:** logs defects separately without changing the session.

One person can fill multiple roles, but the moderator should not code or debug during a session.

## Schedule

1. **Week 0:** send the co-design request to Amanda and obtain the IRB determination.
2. **Week 1:** have one librarian review the tasks and expected database/source routes.
3. **Week 1:** run two dry runs with non-participants; fix only blocking defects.
4. **Weeks 2-3:** conduct 8 to 12 individual 25-minute sessions.
5. **Week 3:** have a librarian blind-review route relevance and the first source lead.
6. **Week 4:** summarize findings, prioritize defects, and review them with ZSR before changing pilot claims.

## Session protocol (25 minutes)

### 1. Introduction and permission (3 minutes)

Read:

> We are testing the tool, not you. Please work as you normally would and say what you expect before clicking. You may skip a question or stop at any time. The prototype can be wrong and does not guarantee access. Do not enter personal, medical, disciplinary, or otherwise sensitive information.

Confirm the approved consent/permission process. Assign the participant ID.

### 2. Baseline (2 minutes)

Ask:

- Where would you normally start this task?
- How confident are you that you could find one useful source now? (1-5)

Do not ask them to complete a full control condition in this first formative pilot.

### 3. Core tasks (15 minutes)

Use one topic from the participant's cohort. Keep the assignment constraints fixed:

- First-year writing: `How does social media use relate to adolescent sleep quality?`
- Humanities/social sciences: `How has public memory of a historical event changed across newspapers and personal accounts?`
- STEM: `How does biodiversity contribute to climate resilience in urban ecosystems?`

Task A - Interpret and choose:

> Enter the topic. Check how the tool interpreted it, refine one concept or angle if useful, and choose the ZSR path you would try first. Tell us why.

Task B - Search and inspect:

> Use one suggested query in the recommended database or ZSR path. Find one result you would inspect for the assignment. You do not need to obtain full text.

Task C - Recover:

> Assume that search was too broad, too narrow, or off-topic. Use the tool to make one controlled change and run the revised search.

Neutral moderator prompts:

- What are you looking for now?
- What did you expect that control to do?
- What makes that result look useful or not useful?
- What would you try next?

Do not explain a button, recommend a database, or repair a query until the participant is blocked for 60 seconds. Record a moderator rescue when help is given.

### 4. Debrief (5 minutes)

Ask the post-session questions below, then remind the participant that all sources and access must be confirmed in the library record.

## Operational definitions

- **Appropriate database:** supports the requested source type and discipline, and receives a librarian relevance rating of at least 4/5.
- **Executable query:** can be pasted or followed in the linked tool without rewriting it as a natural-language question.
- **Useful source lead:** the title/metadata appears on-topic, matches the requested source type, and has a record or access route worth inspecting. It need not be full text.
- **Confusion event:** the participant states confusion, makes two unsuccessful attempts at the same action, chooses an unrelated path due to wording, or cannot predict the next step.
- **Moderator rescue:** any task-specific instruction beyond the neutral prompts.
- **Search-term success:** the query runs and returns at least one plausibly relevant lead, followed by librarian review of the query and lead.

## Measurements

Use `docs/student-pilot-scorecard.csv`. Record:

- time to first appropriate database;
- time to first useful source lead;
- task completion without rescue;
- route relevance (student and librarian, 1-5);
- query usefulness (student and librarian, 1-5);
- source-mode correctness;
- number and location of confusion events;
- whether the first visible source lead is worth inspecting;
- recovery strategy success;
- trust calibration: whether the student notices access/AI limitations; and
- likelihood of using the tool again (1-5).

Do not average away severe failures. Report wrong-database routing, fabricated claims, mislabeled access, privacy exposure, and inaccessible blockers individually.

## Proposed success thresholds

These are go/no-go targets for a second pilot, not claims about the current product:

- at least 75% complete Tasks A-C without moderator rescue;
- median time to first appropriate database is at most 4 minutes;
- median time to first useful source lead is at most 7 minutes;
- at least 80% of first-choice routes receive librarian relevance of 4 or 5;
- at least 80% of primary queries receive librarian usefulness of 4 or 5;
- at least 70% answer 4 or 5 for “I would use this again”;
- zero guest-sandbox records, fabricated sources, false access promises, or exposed secrets;
- zero severe keyboard, screen-reader, zoom, or mobile blockers; and
- every failed discovery request retains an honest next step or librarian handoff.

Stop and fix before continuing if a session exposes personal data, guest demo data appears as ZSR data, a source is fabricated, an access claim is false, or a severe accessibility blocker prevents task completion.

## Post-session questions

Use a 1-5 scale unless marked open text:

1. The tool helped me understand how to narrow the topic.
2. The first database recommendation fit the task.
3. The suggested query was understandable and usable.
4. I understood why the source lead might or might not be relevant.
5. I understood that access and AI-generated guidance still require checking.
6. I would use this tool for a future research assignment.
7. What was the most confusing moment? (open text)
8. What was the most useful part? (open text)
9. What would you change first? (open text)

## Fizz demand pulse

Use Fizz only after the approval/IRB determination and only as demand discovery. Do not treat anonymous interest as usability evidence.

Suggested post:

> When you start a research assignment, what slows you down most?
>
> - choosing the right ZSR database
> - turning a topic into useful keywords
> - finding sources that actually fit
> - getting full text
> - evaluating or citing sources
>
> I built a student prototype that helps with those steps and links back to ZSR. Would you try a 25-minute usability session? Please use the approved signup link rather than posting personal or assignment details in comments.

Suggested pulse questions:

1. Which step is hardest? (choose up to two)
2. Where do you usually start? (ZSR, Google Scholar, Google, AI tool, ask someone, other)
3. Would you try a library-guided research navigator? (yes/maybe/no)
4. Which feature would matter most? (database choice, keywords, source leads, access, evaluation/citation)

## Email to Amanda, Kyle, and Thomas

**Subject:** Co-designing a small ZSR Navigator student usability pilot

Hi Amanda, Kyle, and Thomas,

I would like to run a small formative usability pilot of the revised ZSR Research Navigator this fall and share the findings with you. My proposed scope is 8 to 12 volunteer students across first-year writing, humanities/social sciences, and STEM. Each student would complete the same short workflow: refine a topic, choose a ZSR path, execute one suggested query, identify one source lead, and recover from a weak search.

The measures would be time to an appropriate database and first useful source, route and query relevance, confusion points, moderator rescue, and whether the student would use it again. I would keep query logging off, use participant IDs and non-sensitive topics, and avoid recordings unless an approved protocol permits them.

Before recruiting anyone, I would like your input on the tasks and a written determination from the Wake Forest IRB about whether this is internal service evaluation or requires review. Would one of you be willing to co-review the task set and help judge database/source relevance? I want to test this with ZSR, not present student feedback as library approval.

In parallel, I have implemented a server-side Ex Libris Primo Search API adapter and guest-sandbox contract test. Guest data is isolated from student results; it validates request and response handling only. The next technical ask would be a read-only WFU staging key plus confirmed endpoint, view, tab, scope, quota, and owner so results can be evaluated against actual WFU metadata.

Thank you,

Aidan

## Reporting template

Report:

1. participant mix and any recruitment bias;
2. task completion and time distributions, not just averages;
3. librarian route/query/source ratings;
4. the five most frequent confusion events;
5. all severe correctness, access, privacy, and accessibility failures;
6. representative de-identified observations;
7. changes proposed, changes rejected, and why; and
8. recommendation to stop, revise and retest, or seek a limited institutional pilot.

Do not call the pilot successful solely because participants liked the interface.
