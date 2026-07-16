import test from "node:test";
import assert from "node:assert/strict";
import { activeResearchConversation, submittedResearchContext } from "../src/conversationContext.js";

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
