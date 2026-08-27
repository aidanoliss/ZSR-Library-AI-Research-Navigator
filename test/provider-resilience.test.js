import assert from "node:assert/strict";
import test from "node:test";

import {
  createCircuitBreaker,
  providerHttpError,
  runProviderOperation,
} from "../server/providerResilience.js";
import {
  generateChatResponse,
  streamChatResponse,
} from "../server/gemini.js";

process.env.GEMINI_API_KEY = "test-only-key";

const history = [{ role: "user", content: "How should I search for media effects?" }];

function geminiJson(reply = { message: "Complete" }) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }],
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function sseEvent(text) {
  return `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;
}

test("provider operation retries only a bounded number with exponential jitter", async () => {
  let calls = 0;
  const delays = [];
  const circuit = createCircuitBreaker({ failureThreshold: 5 });
  const result = await runProviderOperation(async () => {
    calls += 1;
    if (calls < 3) throw providerHttpError(503);
    return "ok";
  }, {
    retries: 2,
    timeoutMs: 1_000,
    baseDelayMs: 100,
    random: () => 0.4,
    sleep: async (delay) => delays.push(delay),
    circuit,
  });

  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [110, 220]);
  assert.equal(circuit.snapshot().state, "closed");
});

test("provider timeout aborts the operation and surfaces a generic retryable error", async () => {
  const circuit = createCircuitBreaker({ failureThreshold: 5 });
  await assert.rejects(
    () => runProviderOperation(({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }), {
      timeoutMs: 20,
      retries: 0,
      circuit,
    }),
    (error) => {
      assert.equal(error.code, "PROVIDER_TIMEOUT");
      assert.equal(error.retryable, true);
      assert.doesNotMatch(error.message, /key|endpoint|body/i);
      return true;
    }
  );
});

test("caller cancellation is never retried and does not open the provider circuit", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("Client disconnected", "AbortError"));
  let calls = 0;
  const circuit = createCircuitBreaker({ failureThreshold: 1 });
  await assert.rejects(
    () => runProviderOperation(async () => {
      calls += 1;
    }, { signal: controller.signal, retries: 3, circuit }),
    (error) => error.code === "PROVIDER_ABORTED" && error.retryable === false
  );
  assert.equal(calls, 0);
  assert.equal(circuit.snapshot().state, "closed");
});

test("circuit breaker opens, cools down, and closes after a successful probe", () => {
  let now = 1_000;
  const circuit = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1_000, now: () => now });
  circuit.failure();
  circuit.failure();
  assert.equal(circuit.snapshot().state, "open");
  assert.throws(() => circuit.acquire(), (error) => error.code === "PROVIDER_CIRCUIT_OPEN");

  now += 1_001;
  circuit.acquire();
  assert.equal(circuit.snapshot().state, "open");
  circuit.success();
  assert.equal(circuit.snapshot().state, "closed");
  assert.equal(circuit.snapshot().failures, 0);
});

test("non-retryable provider rejections do not poison the availability circuit", async () => {
  const circuit = createCircuitBreaker({ failureThreshold: 1 });
  await assert.rejects(
    () => runProviderOperation(async () => {
      throw providerHttpError(400);
    }, { retries: 3, circuit }),
    (error) => error.status === 400 && error.retryable === false
  );
  assert.equal(circuit.snapshot().state, "closed");
  assert.equal(circuit.snapshot().failures, 0);
});

test("buffered Gemini retries transient status responses and never exposes provider bodies", async () => {
  let calls = 0;
  const circuit = createCircuitBreaker({ failureThreshold: 5 });
  const result = await generateChatResponse(history, [], "scholarly", "answer", "auto", {
    fetchImpl: async (_url, options) => {
      calls += 1;
      assert.ok(options.signal instanceof AbortSignal);
      if (calls < 3) return new Response("private provider diagnostic", { status: 500 });
      return geminiJson({ message: "Recovered" });
    },
    retries: 2,
    timeoutMs: 1_000,
    sleep: async () => {},
    random: () => 0,
    circuit,
  });
  assert.deepEqual(result, { message: "Recovered" });
  assert.equal(calls, 3);

  await assert.rejects(
    () => generateChatResponse(history, [], "scholarly", "answer", "auto", {
      fetchImpl: async () => new Response("SECRET INTERNAL BODY", { status: 400 }),
      retries: 0,
      timeoutMs: 1_000,
      circuit: createCircuitBreaker({ failureThreshold: 5 }),
    }),
    (error) => {
      assert.equal(error.code, "GEMINI_ERROR");
      assert.equal(error.status, 400);
      assert.doesNotMatch(error.message, /SECRET|INTERNAL BODY/);
      return true;
    }
  );
});

test("Gemini streaming retries before output but never replays after a visible delta", async () => {
  let calls = 0;
  const deltas = [];
  const recovered = await streamChatResponse(history, [], (message) => deltas.push(message), "scholarly", "answer", "auto", {
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return new Response("temporary", { status: 503 });
      return new Response(sseEvent('{"message":"Recovered"}').trimEnd(), { status: 200 });
    },
    retries: 1,
    timeoutMs: 1_000,
    sleep: async () => {},
    circuit: createCircuitBreaker({ failureThreshold: 5 }),
  });
  assert.deepEqual(recovered, { message: "Recovered" });
  assert.deepEqual(deltas, ["Recovered"]);
  assert.equal(calls, 2);

  calls = 0;
  const partialDeltas = [];
  const brokenStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(sseEvent('{"message":"Partial')));
      setTimeout(() => controller.error(new Error("SECRET STREAM FAILURE")), 0);
    },
  });
  await assert.rejects(
    () => streamChatResponse(history, [], (message) => partialDeltas.push(message), "scholarly", "answer", "auto", {
      fetchImpl: async () => {
        calls += 1;
        return new Response(brokenStream, { status: 200 });
      },
      retries: 2,
      timeoutMs: 1_000,
      sleep: async () => {},
      circuit: createCircuitBreaker({ failureThreshold: 5 }),
    }),
    (error) => {
      assert.equal(error.retryable, false);
      assert.doesNotMatch(error.message, /SECRET STREAM FAILURE/);
      return true;
    }
  );
  assert.deepEqual(partialDeltas, ["Partial"]);
  assert.equal(calls, 1);
});
