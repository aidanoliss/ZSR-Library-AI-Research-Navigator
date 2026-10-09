import assert from "node:assert/strict";
import test from "node:test";

import { ChatRequestError, chatFailureMessage, requestChatReply } from "../src/chatTransport.js";

test("sources arrive before generation and survive a broken stream without repeating the paid request", async () => {
  let calls = 0;
  let release;
  const sourceEvent = { type: "sources", reply: { message: "Research guidance", guidance_policy: "evidence_only" }, liveResults: [{ title: "Retrieved record" }] };
  let streamController;
  const stream = new ReadableStream({ start(controller) { streamController = controller; controller.enqueue(new TextEncoder().encode(JSON.stringify(sourceEvent) + "\n")); } });
  const seen = new Promise((resolve) => { release = resolve; });
  const resultPromise = requestChatReply({}, { fetchImpl: async () => { calls += 1; return new Response(stream); }, onSources: release });
  assert.deepEqual((await seen).liveResults, sourceEvent.liveResults);
  streamController.error(new Error("connection interrupted after sources"));
  const result = await resultPromise;
  assert.equal(calls, 1);
  assert.equal(result.guidanceUnavailable, true);
  assert.deepEqual(result.liveResults, sourceEvent.liveResults);
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("uses a complete streaming reply without a buffered retry", async () => {
  const calls = [];
  const deltas = [];
  const fetchImpl = async (path) => {
    calls.push(path);
    return new Response([
      JSON.stringify({ type: "delta", message: "Working" }),
      JSON.stringify({ type: "done", reply: { message: "Complete" }, matchedResources: [] }),
    ].join("\n"));
  };

  const result = await requestChatReply({ messages: [] }, {
    fetchImpl,
    onDelta: (message) => deltas.push(message),
  });

  assert.equal(result.reply.message, "Complete");
  assert.deepEqual(calls, ["/api/chat/stream"]);
  assert.deepEqual(deltas, ["Working"]);
});

test("retries an incomplete stream through the buffered endpoint", async () => {
  const calls = [];
  const fetchImpl = async (path) => {
    calls.push(path);
    if (path.endsWith("/stream")) {
      return new Response(`${JSON.stringify({ type: "delta", message: "Partial" })}\n`);
    }
    return jsonResponse({ reply: { message: "Recovered" }, matchedResources: ["resource"] });
  };

  const result = await requestChatReply({ messages: [] }, { fetchImpl });

  assert.equal(result.reply.message, "Recovered");
  assert.equal(result.recoveredFromStream, true);
  assert.deepEqual(calls, ["/api/chat/stream", "/api/chat"]);
});

test("retries a stream error event and accepts a trailing event without a newline", async () => {
  const calls = [];
  const fetchImpl = async (path) => {
    calls.push(path);
    if (path.endsWith("/stream")) {
      return new Response(JSON.stringify({ type: "error", error: "Provider stream stopped." }));
    }
    return jsonResponse({ reply: { message: "Recovered after provider error" } });
  };

  const result = await requestChatReply({ messages: [] }, { fetchImpl });

  assert.equal(result.reply.message, "Recovered after provider error");
  assert.deepEqual(calls, ["/api/chat/stream", "/api/chat"]);
});

test("does not retry an actionable 4xx response", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse({ error: "Too many requests. Please wait before trying again." }, 429);
  };

  await assert.rejects(
    () => requestChatReply({ messages: [] }, { fetchImpl }),
    (err) => {
      assert.ok(err instanceof ChatRequestError);
      assert.equal(err.status, 429);
      assert.match(err.message, /Too many requests/);
      return true;
    }
  );
  assert.equal(calls, 1);
});

test("keeps actionable service errors and clarifies unrecovered interruptions", () => {
  assert.equal(
    chatFailureMessage(new ChatRequestError("Gemini is not configured.", { status: 503 })),
    "Gemini is not configured."
  );
  assert.match(chatFailureMessage(new ChatRequestError("Network failed.")), /automatic retry/);
});

test("cancelling a request forwards its signal and never launches a buffered retry", async () => {
  const controller = new AbortController();
  const calls = [];
  const fetchImpl = async (path, options) => {
    calls.push(path);
    assert.equal(options.signal, controller.signal);
    return new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
    });
  };
  const request = requestChatReply({ messages: [] }, { fetchImpl, signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { name: "AbortError" });
  assert.deepEqual(calls, ["/api/chat/stream"]);
});
