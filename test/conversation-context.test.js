import test from "node:test";
import assert from "node:assert/strict";
import { submittedResearchContext } from "../src/conversationContext.js";

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
