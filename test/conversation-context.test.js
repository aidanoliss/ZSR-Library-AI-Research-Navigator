import test from "node:test";
import assert from "node:assert/strict";
import {
  activeResearchConversation,
  isSourceOnlyFollowup,
  submittedResearchContext,
  submittedResearchTopicContext,
  startsIndependentResearchTurn,
} from "../src/conversationContext.js";
import { parseChatRequest } from "../server/chatRequest.js";
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
