import test from "node:test";
import assert from "node:assert/strict";
import {
  activeResearchConversation,
  isSourceOnlyFollowup,
  submittedResearchContext,
  submittedResearchTopicContext,
} from "../src/conversationContext.js";

test("submitted context ignores unsent draft text by accepting messages only", () => {
  const messages = [
    { role: "user", content: "protein folding and disease" },
    { role: "assistant", content: "Submitted response" },
  ];

  assert.equal(submittedResearchContext(messages), "protein folding and disease");
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
