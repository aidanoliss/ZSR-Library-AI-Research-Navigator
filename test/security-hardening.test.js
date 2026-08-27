import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import test from "node:test";

import {
  applySecurityHeaders,
  clientKey,
  isAdminAuthorized,
  releaseMetadata,
  trustProxyHops,
} from "../server/httpSecurity.js";
import { rateLimit, resetRateLimits } from "../server/ratelimit.js";

process.env.NODE_ENV = "test";
process.env.ADMIN_TOKEN = "test-admin-token";
process.env.LOG_QUERIES = "off";
process.env.LOG_FEEDBACK = "off";
process.env.LOG_HANDOFFS = "off";
process.env.GEMINI_API_KEY = "";

const { handleApi } = await import("../server/native.js");

class MockRequest extends Readable {
  constructor({ method = "GET", headers = {}, body = "", remoteAddress = "127.0.0.1" } = {}) {
    super();
    this.method = method;
    this.headers = { host: "localhost", ...headers };
    this.socket = { remoteAddress, encrypted: false };
    this.body = Buffer.from(body);
  }

  _read() {
    if (this.body) {
      this.push(this.body);
      this.body = null;
    }
    this.push(null);
  }
}

class MockResponse extends EventEmitter {
  constructor(req) {
    super();
    this.__request = req;
    this.statusCode = 200;
    this.headers = new Map();
    this.chunks = [];
    this.headersSent = false;
    this.writableEnded = false;
    this.destroyed = false;
    applySecurityHeaders(this);
  }

  setHeader(name, value) {
    this.headers.set(String(name).toLowerCase(), String(value));
  }

  getHeader(name) {
    return this.headers.get(String(name).toLowerCase());
  }

  writeHead(status, headers = {}) {
    this.statusCode = status;
    for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
    this.headersSent = true;
  }

  write(chunk) {
    this.headersSent = true;
    this.chunks.push(Buffer.from(chunk));
    return true;
  }

  end(chunk) {
    if (chunk) this.chunks.push(Buffer.from(chunk));
    this.headersSent = true;
    this.writableEnded = true;
    this.emit("finish");
  }

  json() {
    return JSON.parse(Buffer.concat(this.chunks).toString("utf8") || "{}");
  }

  text() {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

async function request(path, options = {}) {
  const req = new MockRequest(options);
  const res = new MockResponse(req);
  await handleApi(req, res, path);
  return res;
}

test("proxy-aware client keys ignore X-Forwarded-For until bounded trust is explicit", () => {
  const req = {
    headers: { "x-forwarded-for": "spoofed, 198.51.100.8" },
    socket: { remoteAddress: "::ffff:127.0.0.1" },
  };
  assert.equal(clientKey(req, "off"), "127.0.0.1");
  assert.equal(clientKey(req, "1"), "198.51.100.8");
  assert.equal(clientKey(req, "2"), "spoofed");
  assert.equal(trustProxyHops("true"), 1);
  assert.equal(trustProxyHops("999"), 5);
});

test("admin authorization requires a configured, exact Bearer token", () => {
  const requestWith = (authorization) => ({ headers: { authorization } });
  assert.equal(isAdminAuthorized(requestWith("Bearer test-admin-token"), "test-admin-token"), true);
  assert.equal(isAdminAuthorized(requestWith("Bearer wrong"), "test-admin-token"), false);
  assert.equal(isAdminAuthorized(requestWith("Bearer test-admin-token"), ""), false);
  assert.equal(isAdminAuthorized(requestWith("Basic test-admin-token"), "test-admin-token"), false);
});

test("rate-limit scopes are isolated and bounded", () => {
  resetRateLimits();
  assert.equal(rateLimit("client", { scope: "chat", maxRequests: 1, windowMs: 10_000, now: 1_000 }).allowed, true);
  const blocked = rateLimit("client", { scope: "chat", maxRequests: 1, windowMs: 10_000, now: 1_001 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 10);
  assert.equal(rateLimit("client", { scope: "feedback", maxRequests: 1, windowMs: 10_000, now: 1_001 }).allowed, true);
});

test("public diagnostics include a release but no local path or secrets", async () => {
  const health = await request("/api/health");
  assert.equal(health.statusCode, 200);
  assert.equal(health.getHeader("x-content-type-options"), "nosniff");
  assert.equal(health.getHeader("x-frame-options"), "DENY");
  assert.match(health.getHeader("content-security-policy") || "", /frame-ancestors 'none'/);
  assert.notEqual(health.getHeader("access-control-allow-origin"), "*");
  assert.ok(health.json().releaseId);

  const status = await request("/api/pilot/status");
  const statusText = status.text();
  assert.equal(status.statusCode, 200);
  assert.doesNotMatch(statusText, /Users\/|ZSR AI Assistant|GEMINI_API_KEY|PRIMO_API_KEY/);
  const payload = status.json();
  assert.equal(payload.releaseId, releaseMetadata().releaseId);
  assert.equal(payload.canonicalPath, undefined);
  assert.equal(payload.privacy.queryLoggingEnabled, false);
  assert.equal(payload.privacy.queryTextStorageEnabled, false);
  assert.equal(payload.privacy.feedbackTextStorageEnabled, false);
  assert.equal(payload.privacy.feedbackTopicStorageEnabled, false);
  assert.equal(payload.privacy.handoffDetailStorageEnabled, false);
  assert.ok(payload.privacy.retentionDays >= 1);

  const ready = await request("/api/ready");
  assert.equal(ready.statusCode, 503);
  assert.doesNotMatch(ready.text(), /api[_ -]?key|Users\//i);
});

test("admin and feedback reads are hidden without a valid Bearer token", async () => {
  for (const path of ["/api/admin/summary", "/api/feedback"]) {
    const hidden = await request(path);
    assert.equal(hidden.statusCode, 404);
    const invalid = await request(path, { headers: { authorization: "Bearer wrong" } });
    assert.equal(invalid.statusCode, 404);
  }

  const authorized = await request("/api/admin/summary", {
    headers: { authorization: "Bearer test-admin-token" },
  });
  assert.equal(authorized.statusCode, 200);
  assert.ok(authorized.json().releaseId);
});

test("CORS permits same-origin requests and rejects unlisted foreign origins", async () => {
  const sameOrigin = await request("/api/health", {
    headers: { origin: "http://localhost" },
  });
  assert.equal(sameOrigin.statusCode, 200);
  assert.equal(sameOrigin.getHeader("access-control-allow-origin"), "http://localhost");

  const foreign = await request("/api/health", {
    headers: { origin: "https://attacker.invalid" },
  });
  assert.equal(foreign.statusCode, 403);
  assert.equal(foreign.getHeader("access-control-allow-origin"), undefined);
});

test("JSON parsing rejects malformed, primitive, and oversized write bodies", async () => {
  const body = JSON.stringify({ rating: "up", note: "x".repeat(140 * 1024) });
  const response = await request("/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) },
    body,
  }).catch((error) => error);
  // handleApi throws typed body errors; the outer native server converts this
  // exact error to its concise 413 JSON response.
  assert.equal(response.status, 413);
  assert.equal(response.code, "BODY_TOO_LARGE");

  const malformed = await request("/api/feedback", { method: "POST", body: "{" }).catch((error) => error);
  assert.equal(malformed.status, 400);
  assert.equal(malformed.code, "INVALID_JSON");

  const primitive = await request("/api/feedback", { method: "POST", body: "null" });
  assert.equal(primitive.statusCode, 400);
  assert.match(primitive.json().error, /invalid rating/i);
});

test("chat fallback remains deterministic and exposes an auditable release plan", async () => {
  resetRateLimits();
  const body = JSON.stringify({
    mode: "scholarly",
    responseStyle: "answer",
    assignmentContext: "First-year paper requiring peer-reviewed sources from the last ten years.",
    messages: [{ role: "user", content: "College student sleep quality and academic performance" }],
  });
  const response = await request("/api/chat", { method: "POST", body });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.ok(payload.reply);
  assert.ok(payload.releaseId);
  assert.ok(payload.researchSpec);
  assert.equal(payload.planMeta.modeId, "scholarly");
  assert.match(payload.planMeta.planHash, /^(?:rp-)?[a-f0-9]{8,64}$/i);
  assert.equal(payload.planMeta.planHash, payload.researchPlan.planHash);
  assert.equal(payload.planMeta.validation.valid, true);
  assert.ok(payload.researchPlan.recommendations.length > 0);
  assert.ok(payload.researchPlan.recommendations.every((resource) => resource.name && resource.accessUrl));
});

test("a bounded student-corrected ResearchSpec governs the returned plan trace", async () => {
  resetRateLimits();
  const correctedTopic = "medieval women and manuscript culture";
  const body = JSON.stringify({
    mode: "scholarly",
    responseStyle: "answer",
    researchSpec: {
      topic: correctedTopic,
      mode: "books",
      disciplines: ["history"],
      concepts: [
        { preferredTerm: "medieval women", required: true },
        { preferredTerm: "manuscript culture", required: true },
      ],
      facets: { timePeriod: "medieval period", documentType: "books" },
    },
    messages: [{ role: "user", content: "Apply my corrected interpretation and rebuild the plan." }],
  });
  const response = await request("/api/chat", { method: "POST", body });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.researchSpec.topic, correctedTopic);
  assert.equal(payload.researchSpec.mode, "books");
  assert.equal(payload.planMeta.modeId, "books");
  assert.equal(payload.planMeta.planHash, payload.researchPlan.planHash);
  assert.match(JSON.stringify(payload.researchPlan), /medieval women/i);
  assert.match(JSON.stringify(payload.researchPlan), /manuscript culture/i);
});

test("feedback and handoff write routes enforce independent endpoint limits", async () => {
  const priorFeedback = process.env.RATE_FEEDBACK_MAX;
  const priorHandoff = process.env.RATE_HANDOFF_MAX;
  process.env.RATE_FEEDBACK_MAX = "1";
  process.env.RATE_HANDOFF_MAX = "1";
  resetRateLimits();
  try {
    const feedbackBody = JSON.stringify({ rating: "up" });
    const firstFeedback = await request("/api/feedback", { method: "POST", body: feedbackBody });
    assert.equal(firstFeedback.statusCode, 200);
    const secondFeedback = await request("/api/feedback", { method: "POST", body: feedbackBody });
    assert.equal(secondFeedback.statusCode, 429);
    assert.ok(Number(secondFeedback.getHeader("retry-after")) >= 1);

    const handoffBody = JSON.stringify({ topic: "A test topic" });
    const firstHandoff = await request("/api/handoff", { method: "POST", body: handoffBody });
    assert.equal(firstHandoff.statusCode, 200);
    const secondHandoff = await request("/api/handoff", { method: "POST", body: handoffBody });
    assert.equal(secondHandoff.statusCode, 429);
  } finally {
    if (priorFeedback === undefined) delete process.env.RATE_FEEDBACK_MAX;
    else process.env.RATE_FEEDBACK_MAX = priorFeedback;
    if (priorHandoff === undefined) delete process.env.RATE_HANDOFF_MAX;
    else process.env.RATE_HANDOFF_MAX = priorHandoff;
    resetRateLimits();
  }
});
