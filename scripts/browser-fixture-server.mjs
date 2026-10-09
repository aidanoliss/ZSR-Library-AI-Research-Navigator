/** Local UI fixtures only. Does not import providers, dotenv, or production servers. */
import http from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildResearchPlan } from "../config/researchAgent.js";
import { parseChatRequest } from "../server/chatRequest.js";
import { assessSourceRequirements } from "../src/sourceAssessment.js";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURE_TIME = "2026-09-15T12:00:00.000Z";
const BODY_LIMIT = 131072;
const TAG_RE = /\[fixture:(delay|error|empty|timeout|rate-limit|stream-retry)\]/gi;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2" };

function fixtureControls(body) {
  const last = body?.messages?.at(-1)?.content;
  return new Set([...String(last || "").matchAll(TAG_RE)].map((match) => match[1].toLowerCase()));
}

function cleanedRequest(body) {
  return { ...body, messages: Array.isArray(body?.messages) ? body.messages.map((message) => ({ ...message, content: typeof message?.content === "string" ? message.content.replace(TAG_RE, "").trim() : message?.content })) : body?.messages };
}

function fixtureSources(plan, origin, scope) {
  const topic = String(plan.researchSpec?.topic || "Research topic").slice(0, 120);
  const topics = (plan.researchSpec?.concepts || []).map((concept) => concept.preferredTerm);
  const records = [
    { id: "current-article", name: "Current journal article", type: "journal-article", sourceKind: "scholarly-article", year: 2025, peerReviewed: true, author: "Alex Fixture", authors: [{ given: "Alex", family: "Fixture" }], venue: "Synthetic Journal of Interface Testing" },
    { id: "unknown-review", name: "Review with unverified peer review", type: "journal-article", sourceKind: "scholarly-article", year: 2024, peerReviewed: null, author: "Morgan Fixture", authors: [{ given: "Morgan", family: "Fixture" }], venue: "Synthetic Research Review" },
    { id: "older-book", name: "Older background book", type: "book", sourceKind: "book", year: 2018, peerReviewed: false, author: "Taylor Fixture", authors: [{ given: "Taylor", family: "Fixture" }], venue: "Synthetic Teaching Press" },
  ];
  return records.map((record, index) => {
    const accessScope = scope === "open-access" || (scope === "both" && index === 1) ? "open-access" : "library";
    const url = `${origin}/__fixtures__/source/${record.id}`;
    const source = {
      id: `synthetic-${record.id}`,
      title: `[SYNTHETIC TEST FIXTURE] ${record.name}: ${topic}`,
      url,
      author: record.author,
      authors: record.authors,
      type: record.type,
      sourceKind: record.sourceKind,
      sourceMode: plan.modeId,
      date: String(record.year),
      publicationYear: record.year,
      peerReviewed: record.peerReviewed,
      containerTitle: record.venue,
      publisher: "Synthetic Test Publisher",
      // Deliberately no plausible DOI/PMID/ISBN: these records do not exist.
      doi: "", pmid: "", isbn: "", issn: "", cover: null,
      subjects: topics,
      sourceProvider: accessScope === "open-access" ? "SYNTHETIC open-access fixture" : "SYNTHETIC library fixture",
      accessScope,
      retrievedAt: FIXTURE_TIME,
      description: "Synthetic metadata for browser regression tests. This is not a real publication, library holding, or access claim.",
      abstractExcerpt: `Synthetic abstract for interface testing only. Topic terms: ${topics.join(", ") || topic}. No research findings are asserted.`,
      ...(index === 0 && plan.researchSpec?.facets?.population ? { abstractText: `Synthetic test data only. We recruited ${plan.researchSpec.facets.population.replace(/adolescent\*/g, "adolescents").replace(/child\*/g, "children").replace(/\*/g, "")} as participants. No real study or findings are asserted.` } : {}),
      abstractSource: "Synthetic test fixture",
      detailPoints: ["Test data only. Do not cite this record or treat it as a library result."],
      citation: { title: `[SYNTHETIC TEST FIXTURE] ${record.name}: ${topic}`, authors: record.authors, year: record.year, venue: record.venue, type: record.type },
      provenance: { provider: "SYNTHETIC browser fixture", recordType: record.type, metadataOnly: true, accessVerified: false, synthetic: true, peerReviewed: record.peerReviewed, retrievedAt: FIXTURE_TIME },
      matchExplanation: { status: "meets", matchedConcepts: topics, missingConcepts: [], explanation: "Synthetic record repeats the requested concepts to exercise the fit explanation UI. This is not evidence of real source relevance." },
      ...(accessScope === "open-access" ? { openAccess: { status: "synthetic", isOpenAccess: true, license: "Synthetic license field", version: "publishedVersion", landingPageUrl: url, pdfUrl: "" } } : {}),
    };
    return { ...source, sourceAssessment: assessSourceRequirements(source, plan.researchSpec) };
  });
}

/** Pure export for fixture-shape assertions; uses the same request parser/planner as the app. */
export function buildFixturePayload(body, origin = "http://127.0.0.1:3004") {
  const parsed = parseChatRequest(cleanedRequest(body));
  if (parsed.error) throw Object.assign(new Error(parsed.error), { status: 400 });
  const plan = buildResearchPlan(parsed.studentText, 5, parsed.subjectFocusId, parsed.mode, {
    assignmentContext: parsed.assignmentContext,
    plannerContext: parsed.plannerContext,
    researchSpec: parsed.researchSpec,
    previousResearchSpec: parsed.previousResearchSpec,
    latestUserText: parsed.latestUserText,
  });
  const controls = fixtureControls(body);
  const empty = ["empty", "timeout", "rate-limit"].some((tag) => controls.has(tag));
  const liveResults = empty ? [] : fixtureSources(plan, origin, parsed.accessScope);
  const outcome = controls.has("timeout") ? "timeout" : controls.has("rate-limit") ? "rate_limited" : empty ? "empty" : "success";
  const lane = (scope) => {
    const requested = scope === "library" ? parsed.accessScope !== "open-access" : parsed.accessScope !== "library";
    return { requested, enabled: true, configured: true, provider: "Synthetic fixture", resultCount: liveResults.filter((source) => source.accessScope === scope).length, status: requested ? outcome : "not_requested", outcome: requested ? outcome : "not_requested", errorCode: outcome === "timeout" ? "FIXTURE_TIMEOUT" : outcome === "rate_limited" ? "FIXTURE_RATE_LIMIT" : null, retrievesFullText: false };
  };
  return {
    fixture: true,
    releaseId: "synthetic-browser-fixture-v1",
    reply: {
      message: "SYNTHETIC BROWSER TEST: This local response uses the real research planner and invented source records. Choose a database, check the interpreted requirements, or save test sources to exercise your workspace.",
      source_notice: "Synthetic fixtures only. These records are not real publications or ZSR holdings.",
      search_terms: plan.searchTerms || [],
      starting_points: plan.recommendations.map((resource) => ({ resource_name: resource.name, url: resource.accessUrl, why: resource.whyFits || resource.description, type: "database" })),
      source_evaluation: ["Verify publication date, source type, and peer review in the record. In this test server all records are synthetic."],
      limitations: "Local synthetic test server. No provider requests, credentials, account access, or research evidence are used.",
      suggested_followups: ["Find 3 peer-reviewed sources from 2022-2026", "Change the publication date to 2024-2026"],
    },
    matchedResources: plan.recommendations,
    searchTools: [],
    liveResults,
    sourceDiscovery: { accessScope: parsed.accessScope, lanes: { library: lane("library"), openAccess: lane("open-access") } },
    researchSpec: { ...plan.researchSpec, planHash: plan.planHash, configVersion: plan.configVersion },
    researchPlan: plan,
  };
}

function json(res, status, payload) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-ZSR-Synthetic-Fixture": "true", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(payload));
}

async function bodyJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw Object.assign(new Error("Fixture request exceeds 128 KiB."), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Fixture request must be JSON."), { status: 400 }); }
}

function responseDelay(res, milliseconds) {
  return new Promise((done) => {
    const finish = (completed) => { clearTimeout(timer); res.removeListener("close", onClose); done(completed); };
    const onClose = () => finish(false);
    const timer = setTimeout(() => finish(true), milliseconds);
    res.once("close", onClose);
  });
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }

/** Creating a server has no listening side effect. The CLI binds loopback only. */
export function createFixtureServer({ distDir = resolve(PROJECT_ROOT, "dist"), delayMs = 15000 } = {}) {
  const root = resolve(distDir);
  const server = http.createServer(async (req, res) => {
    try {
      const origin = `http://127.0.0.1:${server.address()?.port || 3004}`;
      const path = decodeURIComponent(new URL(req.url, origin).pathname);
      if (req.method === "GET" && path === "/api/health") return json(res, 200, { ok: true, fixture: true, providerRequests: false, persistence: false, releaseId: "synthetic-browser-fixture-v1" });
      if (req.method === "GET" && path === "/api/discovery/status") return json(res, 200, { fixture: true, lanes: { library: { configured: true }, openAccess: { configured: true } } });
      if (req.method === "POST" && ["/api/chat", "/api/chat/stream"].includes(path)) {
        const body = await bodyJson(req);
        const controls = fixtureControls(body);
        if (controls.has("error")) return json(res, 503, { fixture: true, error: "Synthetic fixture failure. No provider was contacted." });
        const payload = buildFixturePayload(body, origin);
        if (path.endsWith("/stream")) {
          res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-ZSR-Synthetic-Fixture": "true" });
          res.write(`${JSON.stringify({ type: "delta", message: "Preparing synthetic browser fixtures…" })}\n`);
          if (controls.has("stream-retry")) return res.end();
          res.write(`${JSON.stringify({ ...payload, type: "sources", guidancePending: true })}\n`);
          if (controls.has("delay") && !await responseDelay(res, delayMs)) return;
          if (!res.destroyed && !res.writableEnded) res.end(`${JSON.stringify({ type: "done", ...payload })}\n`);
          return;
        }
        if (controls.has("delay") && !await responseDelay(res, delayMs)) return;
        return json(res, 200, payload);
      }
      if (req.method === "POST" && path === "/api/feedback") { await bodyJson(req); return json(res, 200, { ok: true, fixture: true, stored: false }); }
      if (path.startsWith("/api/")) return json(res, 404, { fixture: true, error: "This API is not implemented in the synthetic browser fixture server." });
      if (!["GET", "HEAD"].includes(req.method)) return json(res, 405, { error: "Method not allowed." });
      if (path.split("/").some((part) => part.startsWith("."))) return json(res, 404, { error: "Hidden paths are not served by the fixture server." });
      if (path.startsWith("/__fixtures__/source/")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Synthetic source fixture</title><main><h1>Synthetic source fixture</h1><p>${escapeHtml(path.split("/").at(-1))}</p><p>This page exists only for browser regression testing. It is not a real publication, source, or library holding.</p><a href="/">Return to Navigator fixtures</a></main></html>`);
      }
      let file = resolve(root, `.${path === "/" ? "/index.html" : path}`);
      if (file !== root && !file.startsWith(`${root}${sep}`)) return json(res, 403, { error: "Path outside fixture build." });
      try { file = await realpath(file); }
      catch { if (!extname(path)) file = resolve(root, "index.html"); else return json(res, 404, { error: "Build asset not found. Run npm run build." }); }
      const actualRoot = await realpath(root).catch(() => root);
      if (file !== actualRoot && !file.startsWith(`${actualRoot}${sep}`)) return json(res, 403, { error: "Path outside fixture build." });
      let content;
      try { content = await readFile(file); }
      catch { return json(res, 503, { error: "Production dist is missing. Run npm run build before starting browser fixtures." }); }
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store", "X-ZSR-Synthetic-Fixture": "true", "X-Content-Type-Options": "nosniff" });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 400, { fixture: true, error: error.status ? error.message : "Invalid fixture request." });
      else if (!res.writableEnded) res.end();
    }
  });
  return server;
}

async function selfTest() {
  const { default: assert } = await import("node:assert/strict");
  const body = { mode: "scholarly", responseStyle: "sources", accessScope: "both", messages: [{ role: "user", content: "Find 3 peer-reviewed sources from 2022-2026 about adolescent sleep" }] };
  const payload = buildFixturePayload(body);
  assert.equal(payload.liveResults.length, 3);
  assert.deepEqual(payload.liveResults.map((source) => source.sourceAssessment.status), ["meets", "unverified", "mismatch"]);
  assert.equal(payload.researchSpec.sourceRequirements.requestedSourceCount, 3);
  assert.equal(payload.researchSpec.sourceRequirements.publicationYearFrom, 2022);
  assert.equal(payload.researchSpec.planHash, payload.researchPlan.planHash);
  assert.deepEqual(buildFixturePayload(body), payload);
  assert.ok(payload.liveResults.every((source) => source.title.startsWith("[SYNTHETIC TEST FIXTURE]")));
  const server = createFixtureServer({ delayMs: 250 });
  await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => { server.removeListener("error", reject); done(); }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, value, signal) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value), signal });
  try {
    assert.equal((await (await fetch(`${base}/api/health`)).json()).providerRequests, false);
    const streamed = await (await post("/api/chat/stream", body)).text();
    const events = streamed.trim().split("\n").map(JSON.parse);
    assert.equal(events[0].type, "delta");
    assert.equal(events[1].type, "sources");
    assert.equal(events[2].type, "done");
    assert.equal(events[1].liveResults.length, 3);
    assert.match(events[1].liveResults[0].url, new RegExp(`:${server.address().port}/__fixtures__/source/`));
    const withTag = (tag) => ({ ...body, messages: [{ role: "user", content: `${body.messages[0].content} [fixture:${tag}]` }] });
    assert.equal((await post("/api/chat", withTag("error"))).status, 503);
    const timeout = await (await post("/api/chat", withTag("timeout"))).json();
    assert.equal(timeout.liveResults.length, 0);
    assert.equal(timeout.sourceDiscovery.lanes.library.outcome, "timeout");
    assert.doesNotMatch(timeout.researchSpec.topic, /fixture:/);
    const controller = new AbortController();
    const delayed = await post("/api/chat/stream", withTag("delay"), controller.signal);
    const pendingBody = delayed.text();
    controller.abort();
    await assert.rejects(pendingBody, { name: "AbortError" });
    assert.equal((await post("/api/chat", { messages: [] })).status, 400);
    assert.equal((await fetch(`${base}/.env`)).status, 404);
    assert.equal((await fetch(`${base}/__fixtures__/source/current-article`)).status, 200);
  } finally { server.closeAllConnections(); await new Promise((done) => server.close(done)); }
  process.stdout.write("Synthetic fixture self-test passed: deterministic planner/metadata, streaming, errors, timeout state, cancellation, and validation. No provider calls.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes("--self-test")) await selfTest();
  else {
    const rawPort = process.env.ZSR_FIXTURE_PORT || "3004";
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("ZSR_FIXTURE_PORT must be an integer from 1024 to 65535.");
    const server = createFixtureServer();
    server.on("error", (error) => { process.stderr.write(`Fixture server failed: ${error.message}\n`); process.exitCode = 1; });
    server.listen(port, "127.0.0.1", () => process.stdout.write(`SYNTHETIC browser fixtures: http://127.0.0.1:${port}\nServing production dist. No provider credentials, requests, or persistence.\n`));
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { server.closeAllConnections(); server.close(); });
  }
}
