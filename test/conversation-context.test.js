import test from "node:test";
import assert from "node:assert/strict";
import {
  activeResearchConversation,
  isSourceOnlyFollowup,
  isSearchRefinementFollowup,
  submittedResearchContext,
  submittedResearchTopicContext,
  startsIndependentResearchTurn,
} from "../src/conversationContext.js";
import { parseChatRequest } from "../server/chatRequest.js";
import { buildResearchPlan } from "../config/researchAgent.js";
import { buildResearchSpec, continueResearchSpec, researchSpecQuery } from "../config/researchSpec.js";

test("submitted context ignores unsent draft text by accepting messages only", () => {
  const messages = [
    { role: "user", content: "protein folding and disease" },
    { role: "assistant", content: "Submitted response" },
  ];

  assert.equal(submittedResearchContext(messages), "protein folding and disease");
});

test("ordinary source and process follow-ups preserve the topic rather than becoming keywords", () => {
  const topic = "medieval Italian trade networks";
  for (const followup of ["Find peer reviewed articles", "Find peer-reviewed articles", "Which databases should I use?", "Can you explain the scope?", "Only sources since 2021", "I need five peer-reviewed sources", "Last 5 years"]) {
    const messages = [{ role: "user", content: topic }, { role: "assistant", content: "Plan" }, { role: "user", content: followup }];
    assert.equal(startsIndependentResearchTurn(followup, true), false, followup);
    assert.equal(activeResearchConversation(messages).length, 3, followup);
    assert.equal(submittedResearchTopicContext(messages), topic, followup);
  }
});

test("several process follow-ups retain the original topic anchor", () => {
  const topic = "medieval Italian trade networks";
  const messages = [topic, "Find articles", "Which databases should I use?", "Can you explain the scope?", "Find more sources", "Show books"].map((content) => ({ role: "user", content }));
  assert.equal(submittedResearchTopicContext(messages), topic);
});

test("submitted context removes navigation setup after a real topic is sent", () => {
  const messages = [
    { role: "user", content: "Help me navigate ZSR" },
    { role: "assistant", content: "Choose a path" },
    { role: "user", content: "The impact of surveillance on citizens" },
    { role: "assistant", content: "Narrow the topic" },
    { role: "user", content: "impact on trust" },
  ];

  assert.equal(
    submittedResearchContext(messages),
    "The impact of surveillance on citizens impact on trust"
  );
});

test("assistant responses receive only context submitted before their position", () => {
  const messages = [
    { role: "user", content: "surveillance and public trust" },
    { role: "assistant", content: "First response" },
    { role: "user", content: "focus on local government" },
    { role: "assistant", content: "Second response" },
  ];

  assert.equal(submittedResearchContext(messages, 1), "surveillance and public trust");
  assert.equal(
    submittedResearchContext(messages, 3),
    "surveillance and public trust focus on local government"
  );
});

test("a complete new topic replaces stale research context", () => {
  const economics = "Help me explore the differences between Keynesian and Neoclassical economics for this topic and suggest focused research angles I can search in ZSR.";
  const messages = [
    { role: "user", content: "the effect of phones on our eyes" },
    { role: "assistant", content: "Earlier answer" },
    { role: "user", content: economics },
  ];

  assert.equal(submittedResearchContext(messages), economics);
  assert.deepEqual(activeResearchConversation(messages), [messages[2]]);
});

test("dependent follow-ups keep the active topic and its recent assistant context", () => {
  const messages = [
    { role: "user", content: "surveillance and public trust" },
    { role: "assistant", content: "Choose a government level" },
    { role: "user", content: "focus on local government" },
  ];

  assert.equal(activeResearchConversation(messages).length, 3);
  assert.equal(submittedResearchContext(messages), "surveillance and public trust focus on local government");
});

test("source-only follow-ups do not become part of the research topic", () => {
  const topic = "The psychology of powerful and cruel leaders in dominate countries";
  const messages = [
    { role: "user", content: topic },
    { role: "assistant", content: "Here is a starting plan." },
    { role: "user", content: "can you provide sources i can use?" },
  ];

  assert.equal(isSourceOnlyFollowup(messages[2].content), true);
  assert.equal(submittedResearchContext(messages), `${topic} can you provide sources i can use?`);
  assert.equal(submittedResearchTopicContext(messages), topic);
});

test("topic-bearing source requests remain part of the research topic", () => {
  const messages = [
    { role: "user", content: "Find peer-reviewed sources about climate policy and coastal cities" },
  ];

  assert.equal(isSourceOnlyFollowup(messages[0].content), false);
  assert.equal(submittedResearchTopicContext(messages), messages[0].content);
});

test("a short country follow-up retains the subject and explicit source requirements", () => {
  const topic = "economic sanctions; peer-reviewed sources since 2020, not literature reviews";
  const previous = buildResearchSpec(topic);
  const followup = "What about Russia?";
  const request = parseChatRequest({ messages: [{ role: "user", content: topic }, { role: "assistant", content: "Sources" }, { role: "user", content: followup }], previousResearchSpec: previous });
  assert.equal(startsIndependentResearchTurn(followup, true), false);
  assert.ok(request.previousResearchSpec);
  const spec = continueResearchSpec(buildResearchSpec(request.studentText), request.previousResearchSpec, followup);
  assert.match(researchSpecQuery(spec), /sanctions.*Russia/i);
  assert.equal(spec.sourceRequirements.publicationYearFrom, 2020);
  assert.equal(spec.sourceRequirements.peerReviewed, true);
  assert.deepEqual(spec.methodRequirements.exclude, ["literature review"]);
});

test("a complete Russia question replaces a prior comparison without erasing visible chat history", () => {
  const topic = "sanctions in authoritarian regimes versus democracies";
  const prompt = "Examples of Russia having sanctions used against them and the result";
  const messages = [{ role: "user", content: topic }, { role: "assistant", content: "Earlier sources" }, { role: "user", content: prompt }];
  const request = parseChatRequest({ messages, previousResearchSpec: buildResearchSpec(topic) });
  assert.equal(request.previousResearchSpec, null);
  assert.equal(request.studentText, prompt);
  assert.equal(messages.length, 3, "context selection must not mutate UI messages");
  const spec = buildResearchSpec(request.studentText);
  assert.equal(spec.comparison, null);
  assert.equal(researchSpecQuery(spec), "Russia AND sanctions");
});


function followupPlan(previous, latest) {
  const parsed = parseChatRequest({
    messages: [{ role: "user", content: previous.topic }, { role: "assistant", content: "Earlier source results" }, { role: "user", content: latest }],
    previousResearchSpec: previous,
  });
  assert.ok(parsed.previousResearchSpec, `the brief should survive: ${latest}`);
  return buildResearchPlan(parsed.studentText, 5, parsed.subjectFocusId, parsed.mode, parsed).researchSpec;
}

test("short refinement and recovery requests retain topic, requirements and exclusions without becoming keywords", () => {
  const previous = buildResearchSpec("Urban tree canopy and summer temperatures; five peer-reviewed sources published between 2020 and 2022, not literature reviews, excluding indoor temperatures");
  const snapshot = JSON.stringify(previous);
  for (const latest of ["recent peer reviewed only", "any stronger studies", "give more sources", "more", "more please", "no results", "try again", "change time range", "Compare two approaches"]) {
    assert.equal(startsIndependentResearchTurn(latest, true), false, latest);
    assert.equal(isSearchRefinementFollowup(latest), true, latest);
    const next = followupPlan(previous, latest);
    assert.equal(next.topic, previous.topic);
    const meaning = concepts => concepts.map(({ source, ...concept }) => concept);
    assert.deepEqual(meaning(next.concepts), meaning(previous.concepts));
    assert.deepEqual(next.sourceRequirements, previous.sourceRequirements);
    assert.deepEqual(next.methodRequirements, previous.methodRequirements);
    assert.deepEqual(next.excludedTerms, previous.excludedTerms);
    assert.doesNotMatch(researchSpecQuery(next), /stronger|recent|time range|two approaches|more please/i);
  }
  assert.equal(JSON.stringify(previous), snapshot, "continuation must not mutate the earlier search record");
});

test("population and geography followups update the actual facets while retaining the research subject", () => {
  const previous = buildResearchSpec("vaccines and autism; peer-reviewed articles published since 2020");
  const children = followupPlan(previous, "What about children in the United States?");
  assert.equal(children.facets.population, "child*");
  assert.equal(children.facets.geography, "United States");
  assert.match(researchSpecQuery(children), /vaccines.*autism.*United States.*child\*/);
  assert.equal(isSearchRefinementFollowup("What about children?"), true);
  const adults = followupPlan(children, "Focus on adults instead of children");
  assert.equal(adults.facets.population, "adults");
  assert.equal(adults.facets.geography, "United States");
  assert.doesNotMatch(researchSpecQuery(adults), /child|instead/i);
  const nurses = followupPlan(adults, "Change the population to nurses");
  assert.equal(nurses.facets.population, "nurses");
  assert.equal(nurses.facets.geography, "United States");
  assert.deepEqual(nurses.sourceRequirements, previous.sourceRequirements);
});

test("feedback about a wrong population does not convert the unwanted group or correction words into a new topic", () => {
  const previous = buildResearchSpec("food insecurity among college students");
  const next = followupPlan(previous, "These sources are about school children but I need adults in the United States");
  assert.equal(next.topic, previous.topic);
  assert.equal(next.facets.population, "adults");
  assert.equal(next.facets.geography, "United States");
  assert.doesNotMatch(researchSpecQuery(next), /school|child|but|need|college/i);
  assert.match(researchSpecQuery(next), /food insecurity.*adults/);
});

test("stated study designs replace only the requested method field and retain independent constraints", () => {
  const previous = buildResearchSpec("tutoring and reading achievement; peer-reviewed studies since 2020, not literature reviews");
  const trials = followupPlan(previous, "Make it randomized controlled trials only");
  assert.deepEqual(trials.methodRequirements, { include: ["randomized controlled trial"], exclude: ["literature review"] });
  assert.equal(trials.facets.method, "randomized controlled trial");
  assert.equal(trials.sourceRequirements.publicationYearFrom, 2020);
  assert.equal(trials.sourceRequirements.peerReviewed, true);
  assert.doesNotMatch(researchSpecQuery(trials), /Make|only/);
  const reviews = followupPlan(trials, "systematic reviews only");
  assert.deepEqual(reviews.methodRequirements.include, ["systematic review"]);
  assert.deepEqual(reviews.methodRequirements.exclude, ["literature review"]);
  for (const latest of ["any study design", "no study design requirement", "remove the method filter"]) {
    const any = followupPlan(reviews, latest);
    assert.deepEqual(any.methodRequirements, { include: [], exclude: [] });
    assert.deepEqual(any.sourceRequirements, previous.sourceRequirements);
    assert.doesNotMatch(researchSpecQuery(any), /requirement|filter|study design/i);
  }
});

test("an explicit short comparison adds its sides to the current subject and survives later followups", () => {
  const previous = buildResearchSpec("vaccines and autism; peer-reviewed articles since 2020");
  const comparison = followupPlan(previous, "compare vaccinated vs unvaccinated");
  assert.deepEqual(comparison.comparison.terms, ["vaccinated", "unvaccinated"]);
  assert.match(researchSpecQuery(comparison), /vaccines AND autism AND \(vaccinated OR unvaccinated\)/);
  const next = followupPlan(comparison, "What about children?");
  assert.deepEqual(next.comparison, comparison.comparison);
  assert.equal(next.facets.population, "child*");
  assert.deepEqual(next.sourceRequirements, previous.sourceRequirements);
});

test("publication-bound changes remove obsolete bounds and keep historical scope independent", () => {
  const previous = buildResearchSpec("women abolitionists before 1865; peer-reviewed sources published between 2020 and 2022");
  const recent = followupPlan(previous, "since 2023");
  assert.equal(recent.sourceRequirements.publicationYearFrom, 2023);
  assert.equal(recent.sourceRequirements.publicationYearTo, null);
  assert.equal(recent.facets.timePeriod, "before 1865");
  const older = followupPlan(recent, "published before 2021");
  assert.equal(older.sourceRequirements.publicationYearFrom, null);
  assert.equal(older.sourceRequirements.publicationYearTo, 2020);
  for (const latest of ["Only from 2020 onwards", "Only from 2020 onward"]) {
    const next = followupPlan(previous, latest);
    assert.equal(next.sourceRequirements.publicationYearFrom, 2020);
    assert.equal(next.sourceRequirements.publicationYearTo, null);
    assert.doesNotMatch(researchSpecQuery(next), /onward/i);
  }
  for (const latest of ["no date limit", "any time period", "Any publication date"]) {
    const next = followupPlan(previous, latest);
    assert.equal(next.sourceRequirements.publicationYearFrom, null);
    assert.equal(next.sourceRequirements.publicationYearTo, null);
    assert.equal(next.facets.timePeriod, "before 1865");
    assert.equal(next.sourceRequirements.peerReviewed, true);
    assert.doesNotMatch(researchSpecQuery(next), /date limit|any time/i);
  }
});

test("explicitly dropping peer review changes that field without deleting publication limits", () => {
  const previous = buildResearchSpec("coastal erosion; peer-reviewed sources published between 2020 and 2024");
  for (const latest of ["not necessarily peer reviewed", "remove the peer review requirement", "peer review not required"]) {
    const next = followupPlan(previous, latest);
    assert.equal(next.sourceRequirements.peerReviewed, false, latest);
    assert.equal(next.sourceRequirements.publicationYearFrom, 2020);
    assert.equal(next.sourceRequirements.publicationYearTo, 2024);
    assert.doesNotMatch(researchSpecQuery(next), /necessarily|requirement|peer/i);
  }
});

test("legacy guided recency becomes publication dates and remains present on later turns", () => {
  const plannerContext = "What time period should the search prioritize?: Last 5 years\nWhat source types should ZSR scan first?: Peer-reviewed articles\nHow would you like to narrow your topic?: Compare two approaches";
  const previous = buildResearchSpec("do vaccines cause autism", { plannerContext });
  const currentYear = new Date().getFullYear();
  assert.equal(previous.sourceRequirements.publicationYearFrom, currentYear - 4);
  assert.equal(previous.sourceRequirements.publicationYearTo, currentYear);
  assert.equal(previous.sourceRequirements.peerReviewed, true);
  assert.equal(previous.facets.timePeriod, "");
  assert.equal(previous.comparison, null, "a menu preference does not supply actual comparison groups");
  assert.doesNotMatch(researchSpecQuery(previous), /Last 5 years|approaches/i);
  assert.doesNotMatch(previous.searchIntent.neutralQuestion, /Last 5 years/i);
  const next = followupPlan(previous, "What about children?");
  assert.deepEqual(next.sourceRequirements, previous.sourceRequirements);
});

test("actual planner scope values become fields and comparison groups without including their labels", () => {
  const spec = buildResearchSpec("training outcomes", { plannerContext: "Population: nurses\nGeography: Denmark\nComparison: online versus in-person teaching\nStudy period: before 2020\nPublished in the last 5 years" });
  assert.equal(spec.facets.population, "nurses");
  assert.equal(spec.facets.geography, "Denmark");
  assert.equal(spec.facets.timePeriod, "before 2020");
  assert.deepEqual(spec.comparison.terms, ["online teaching", "in-person teaching"]);
  assert.match(researchSpecQuery(spec), /training\b.*\boutcomes.*online\b.*\bteaching.*in-person\b.*\bteaching.*nurses.*Denmark/);
  assert.doesNotMatch(researchSpecQuery(spec), /Population|Geography|Comparison|Study period|Published/i);
});

test("complete new-topic requests still replace the prior brief and source-discussion wording is not a retrieval refinement", () => {
  const previous = buildResearchSpec("vaccines and autism; peer reviewed sources since 2020");
  for (const latest of ["New topic: climate change and migration", "Help me explore the differences between Keynesian and Neoclassical economics for a seminar research project"]) {
    const parsed = parseChatRequest({ messages: [{ role: "user", content: previous.topic }, { role: "assistant", content: "Results" }, { role: "user", content: latest }], previousResearchSpec: previous });
    assert.equal(parsed.previousResearchSpec, null);
    assert.equal(parsed.studentText, latest);
  }
  assert.equal(isSearchRefinementFollowup("Which of these sources supports the claim?"), false);
});


test("compact population, place and date answers update scope without losing the current subject", () => {
  const previous = buildResearchSpec("tutoring and reading achievement among college students; peer-reviewed studies published between 2020 and 2022");
  const children = followupPlan(previous, "children");
  assert.equal(isSearchRefinementFollowup("children"), true);
  assert.equal(children.facets.population, "child*");
  assert.doesNotMatch(researchSpecQuery(children), /college/);
  const unitedStates = followupPlan(children, "United States");
  assert.equal(isSearchRefinementFollowup("United States"), true);
  assert.equal(unitedStates.facets.geography, "United States");
  assert.equal(unitedStates.facets.population, "child*");
  const canada = followupPlan(unitedStates, "Change geography to Canada");
  assert.equal(canada.facets.geography, "Canada");
  assert.doesNotMatch(researchSpecQuery(canada), /United States/);
  for (const latest of ["last 5 years", "only the last 5 years"]) {
    assert.equal(isSearchRefinementFollowup(latest), true);
    const next = followupPlan(previous, latest);
    assert.equal(next.sourceRequirements.publicationYearFrom, new Date().getFullYear() - 4);
    assert.equal(next.sourceRequirements.publicationYearTo, new Date().getFullYear());
    assert.equal(next.facets.timePeriod, "");
    assert.doesNotMatch(researchSpecQuery(next), /last|years/i);
  }
  const historical = followupPlan(previous, "Study period: last 5 years");
  assert.equal(historical.facets.timePeriod, "last 5 years");
  assert.deepEqual(historical.sourceRequirements, previous.sourceRequirements);
  assert.equal(historical.topic, previous.topic);
  assert.equal(startsIndependentResearchTurn("Children and media literacy", true), true);
  assert.equal(startsIndependentResearchTurn("United States foreign policy", true), true);
});
