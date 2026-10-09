import { getDiscoveryReadiness } from "./discoveryReadiness.js";
import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

import { retrieveResearchContext, loadResources, getSearchTools } from "./retrieve.js";
import { generateChatResponse, geminiResilienceStatus, streamChatResponse } from "./gemini.js";
import { validateReply } from "./validate.js";
import { needsFreshSourceEvidence, prepareSourceEvidence, validateEvidenceNotes } from "./sourceEvidence.js";
import {
  logQuery,
  logFeedback,
  logHandoff,
  loggingStatus,
  probePilotStorage,
  readFeedback,
  readHandoffs,
  readQuerySummary,
} from "./log.js";
import { rateLimit } from "./ratelimit.js";
import { acquireChatSlot } from "./activeChatLimit.js";
import {
  JSON_BODY_LIMIT_BYTES,
  applySecurityHeaders,
  clientKey,
  corsHeaders,
  isAdminAuthorized,
  isCorsRequestAllowed,
  releaseMetadata,
  trustProxyHops,
} from "./httpSecurity.js";
import { screenMessage, screenPromptOverride, blockedReply } from "./screen.js";
import {
  searchSourceCandidatesForScope,
  sourceDiscoveryStatus,
} from "./sourceDiscovery.js";
import { shouldLookupCatalog } from "./catalogIntent.js";
import { appendRequestContextForAi } from "./requestContext.js";
import { applySourceContract, transparentSourceFallback } from "./sourceContract.js";
import { getPrimoApiStatus } from "./primoApi.js";
import { parseChatRequest } from "./chatRequest.js";
import {
  DEFAULT_MODE_ID,
  DEFAULT_RESPONSE_STYLE_ID,
  getSearchMode,
} from "../config/libraryLinks.js";
import { DEFAULT_SUBJECT_FOCUS_ID } from "../config/subjectFocus.js";
import { liveSearchQueries } from "./liveSearchQueries.js";
import { getOpenAlexStatus } from "./openalex.js";
import {
  RESEARCH_INTEGRATION_POLICY,
  RESEARCH_INTEGRATION_POLICY_VERSION,
} from "../config/researchIntegrationPolicy.js";
import {
  isSubstantiveResearchRequest,
} from "../config/researchAgent.js";
import {
  submittedResearchTopicContext,
} from "../src/conversationContext.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const ASK_ZSR_EMAIL = process.env.ASK_ZSR_EMAIL || "askzsr@wfu.edu";

export const app = express();
app.disable("x-powered-by");
const proxyHops = trustProxyHops();
if (proxyHops) app.set("trust proxy", proxyHops);
app.use((req, res, next) => {
  applySecurityHeaders(res);
  if (req.path?.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  if (!isCorsRequestAllowed(req)) return res.status(403).json({ error: "Origin is not allowed." });
  for (const [name, value] of Object.entries(corsHeaders(req))) res.setHeader(name, value);
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
    return res.status(204).end();
  }
  next();
});
app.use(express.json({ limit: JSON_BODY_LIMIT_BYTES }));

// Keep the ZSR preview fast and isolated. The older Venture Radar API imports a
// larger experimental pipeline, so load it only if that namespace is requested.
app.use("/api/venture", async (req, res, next) => {
  try {
    const { ventureRouter } = await import("./venture.js");
    return ventureRouter(req, res, next);
  } catch (err) {
    console.error("[/api/venture lazy-load]", err.message);
    return res.status(503).json({ ok: false, error: "Venture Radar tools are not available right now." });
  }
});

// Health + visibility into what the curated file currently holds.
app.get("/api/discovery/status", (_req, res) => res.json(getDiscoveryReadiness()));
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ...releaseMetadata() });
});

app.get("/api/ready", async (_req, res) => {
  const resources = await loadResources();
  const gemini = geminiResilienceStatus();
  const configured = envConfigured("GEMINI_API_KEY");
  const discovery = getDiscoveryReadiness();
    const storage = await probePilotStorage();
    const ready = resources.length > 0 && discovery.atLeastOneConfigured && (!storage.enabled || storage.writable === true);
  res.status(ready ? 200 : 503).json({
    ok: ready,
    ...releaseMetadata(),
    checks: {
      resources: { ok: resources.length > 0, count: resources.length },
      gemini: { configured, circuit: gemini.circuit.state, requiredForSources: false },
        discovery,
        pilotStorage: storage,
    },
  });
});

function envConfigured(name) {
  const value = String(process.env[name] || "").trim();
  if (name === "GEMINI_API_KEY" && value === "your_api_key_here") return false;
  return Boolean(value);
}

function resourceSummary(resources = []) {
  const byType = {};
  const missing = [];
  for (const resource of resources) {
    byType[resource.type || "unknown"] = (byType[resource.type || "unknown"] || 0) + 1;
    const missingFields = ["id", "name", "type", "url", "description", "access"].filter((field) => !resource[field]);
    if (missingFields.length) {
      missing.push({ id: resource.id || resource.name || "(unnamed)", missingFields });
    }
  }

  return {
    count: resources.length,
    byType,
    searchableTools: resources.filter((resource) => resource.search_url_template).length,
    paywalled: resources.filter((resource) => resource.paywalled).length,
    missing: missing.slice(0, 20),
  };
}

function integrationStatus() {
  const primoApi = getPrimoApiStatus();
  return {
    gemini: {
      configured: envConfigured("GEMINI_API_KEY"),
      ...geminiResilienceStatus(),
    },
    primoPublicLookup: {
      configured: (process.env.PRIMO_LIVE || "on").toLowerCase() !== "off",
      note: "Best-effort public Primo lookup; not an approved authenticated ZSR API.",
    },
    primoApi,
    libkey: {
      libraryIdConfigured: envConfigured("VITE_WFU_LIBKEY_LIBRARY_ID") || envConfigured("WFU_LIBKEY_LIBRARY_ID"),
      note: "Without a Wake Forest LibKey library ID, the app uses LibKey choose-library links.",
    },
    openAlex: getOpenAlexStatus(),
    governedFutureCapabilities: {
      policyVersion: RESEARCH_INTEGRATION_POLICY_VERSION,
      ...RESEARCH_INTEGRATION_POLICY,
    },
  };
}

async function pilotStatusPayload() {
  const resources = await loadResources();
  return {
    ok: true,
    prototype: true,
    ...releaseMetadata(),
    privacy: loggingStatus(),
    resources: resourceSummary(resources),
    integrations: integrationStatus(),
  };
}

app.get("/api/pilot/status", async (_req, res) => {
  res.json(await pilotStatusPayload());
});

app.get("/api/admin/summary", async (req, res) => {
  if (!isAdminAuthorized(req)) return res.status(404).json({ error: "Not found." });
  const [status, feedback, handoffs, querySummary] = await Promise.all([
    pilotStatusPayload(),
    readFeedback(100),
    readHandoffs(50),
    readQuerySummary(200),
  ]);

  const feedbackCounts = feedback.reduce((counts, item) => {
    counts[item.rating] = (counts[item.rating] || 0) + 1;
    return counts;
  }, {});

  res.json({
    ...status,
    feedback: {
      counts: feedbackCounts,
      recent: feedback.slice(0, 25),
    },
    handoffs: {
      totalRecent: handoffs.length,
      recent: handoffs.slice(0, 25),
    },
    querySummary,
  });
});

function noKeyResponse(res) {
  return res.status(503).json({
    error: "AI generation is not configured on this deployment.",
  });
}

/** Shared gate: rate limit + relevance/abuse screen. Returns null if OK. */
function gate(req, res, scope = "chat") {
  const limit = rateLimit(clientKey(req), { scope });
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    res.status(429).json({
      error: `You've sent a lot of requests in a short time. Please wait about ${Math.ceil(
        limit.retryAfter / 60
      )} minute(s) and try again.`,
    });
    return true;
  }
  return false;
}

function responsePlanContext(plan) {
  const releaseId = releaseMetadata().releaseId;
  if (!plan) return { releaseId };
  const planMeta = {
    modeId: plan.modeId,
    configVersion: plan.configVersion,
    planHash: plan.planHash,
    sourceMode: plan.sourceMode,
    safety: plan.safety,
    safeFailure: plan.safeFailure,
    validation: plan.validation,
  };
  return {
    releaseId,
    researchSpec: {
      ...plan.researchSpec,
      planHash: plan.planHash,
      configVersion: plan.configVersion,
    },
    planMeta,
    researchPlan: {
      ...planMeta,
      researchSpec: plan.researchSpec,
      recommendations: (plan.recommendations || []).map((resource) => ({
        id: resource.id,
        name: resource.name,
        description: resource.description,
        subjectArea: resource.subjectArea,
        whyFits: resource.whyFits,
        accessUrl: resource.accessUrl,
        searchTerms: resource.searchTerms,
        filters: resource.filters,
        expect: resource.expect,
        queryValidation: resource.queryValidation,
        provenance: resource.provenance,
      })),
      fallbacks: plan.fallbacks,
      transparencyNote: plan.transparencyNote,
    },
  };
}

function withCatalogFoundIntro(reply, liveResults, latestText) {
  if (!reply || !liveResults?.length || reply.generation_unavailable) return reply;
  if (!sourceRequestIntent(latestText)) {
    return reply;
  }
  return {
    ...reply,
    message:
      "Here are source leads from the discovery providers. Open each record to confirm access, format, and fit.",
  };
}

function topicOptionIntent(text) {
  const value = String(text || "");
  return /\b(brainstorm|options?|angles?|possible topics?|topic ideas?|research questions?|narrow|focus)\b/i.test(value);
}

function sourceRequestIntent(text) {
  const value = String(text || "");
  const explicitSource = /\b(articles?|books?|sources?|evidence|results?|database|databases|catalog|journal|journals|citation|cite|search terms?|keywords?|pdf|full[-\s]?text)\b/i.test(value);
  if (explicitSource) return true;
  if (topicOptionIntent(value)) return false;
  return /\b(find|show|get|give|provide)\b.{0,48}\b(articles?|books?|sources?|evidence|results?|databases?|catalog|journals?|citations?|keywords?)\b/i.test(value);
}

function stripSourceHeavyFields(reply) {
  if (!reply) return reply;
  const {
    starting_points,
    search_terms,
    source_evaluation,
    academic_integrity_note,
    limitations,
    key_journals,
    database_strategy,
    citation_tips,
    ...direct
  } = reply;
  return direct;
}

function catalogResultFocusedTurn(history, latestText, liveResults) {
  const userTurns = history.filter((m) => m.role === "user").length;
  if (userTurns <= 1 || !liveResults?.length) return false;
  const wantsSources = sourceRequestIntent(latestText);
  const wantsWhereToSearch = /\b(database|databases|resource|resources|where|starting point|guide|guides|search tool)\b/i.test(latestText);
  return wantsSources && !wantsWhereToSearch;
}

function prepareReply(reply, history, liveResults, latestText, responseStyle = DEFAULT_RESPONSE_STYLE_ID, resources = [], subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID, mode = DEFAULT_MODE_ID, deterministicPlan = null) {
  if (reply) reply = { ...reply, ...validateEvidenceNotes(reply, liveResults).fields };
  const researchText = submittedResearchTopicContext(history) || latestText;
  if (reply?.search_terms?.length) {
    reply = { ...reply, search_terms: deterministicPlan?.searchTerms || [] };
  } else if (isSubstantiveResearchRequest(researchText) && !topicOptionIntent(latestText)) {
    reply = { ...reply, search_terms: deterministicPlan?.searchTerms || [] };
  }
  if (responseStyle === "answer" && !sourceRequestIntent(latestText) && !isSubstantiveResearchRequest(researchText)) {
    return stripSourceHeavyFields(reply);
  }
  const withIntro = responseStyle === "hybrid"
    ? reply
    : withCatalogFoundIntro(reply, liveResults, latestText);
  const withSources = applySourceContract(withIntro, resources, deterministicPlan, liveResults, responseStyle, {
    topic: latestText,
    modeId: mode,
  });
  if (["hybrid", "sources"].includes(responseStyle)) return withSources;
  if (!catalogResultFocusedTurn(history, latestText, liveResults)) return withSources;

  const {
    starting_points,
    academic_integrity_note,
    limitations,
    key_journals,
    database_strategy,
    suggested_followups,
    ...focused
  } = withSources;
  return focused;
}

function sourceResultsFallback(liveResults, modeId = DEFAULT_MODE_ID) {
  if (!liveResults?.length) return null;
  const mode = getSearchMode(modeId);
  return {
    generation_unavailable: true,
    message:
      `The AI overview is unavailable. The discovery providers returned source leads for ${mode.shortLabel.toLowerCase()} research; open each record to confirm access, format, and fit.`,
    search_terms: [],
  };
}

function deterministicPlanFallback(plan, resources = []) {
  if (!plan) return null;
  const premiseNotice = plan.safety?.requiresPremiseCheck
    ? " The wording includes a premise that should be tested rather than accepted; compare appropriate evidence and keep correlation, causation, and uncertainty distinct."
    : "";
  return {
    generation_unavailable: true,
    message: `The generated research orientation is temporarily unavailable. The routes and searches below are a deterministic plan built from the governed resource registry, not a research conclusion.${premiseNotice}`,
    search_terms: plan.searchTerms || [],
    starting_points: resources.map((resource) => ({
      resource_name: resource.name,
      url: resource.url,
      why: resource.why || resource.description,
    })),
    database_strategy: resources
      .filter((resource) => resource.recommended_query)
      .map((resource) => ({
        database: resource.name,
        az_area: resource.type,
        why: resource.why || resource.description,
        search_inside: [resource.recommended_query, ...(resource.recommended_filters || [])],
        journals_or_sources: [resource.expect].filter(Boolean),
      })),
    limitations: "No provider-generated overview was substituted. Verify each route, result, and claim, and ask a librarian when the plan does not fit the assignment.",
  };
}

// Buffered endpoint: full conversation in, complete structured reply out.
app.post("/api/chat", async (req, res) => {
  if (gate(req, res, "chat")) return;
  const parsed = parseChatRequest(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { history, studentText, last, mode, responseStyle, subjectFocusId, accessScope, assignmentContext, plannerContext, researchSpec, previousResearchSpec, latestUserText } = parsed;
  let aiHistory = appendRequestContextForAi(history, { assignmentContext, plannerContext });

  // Relevance / abuse screen — redirect clear-cut cases without a model call.
  const screen = screenMessage(last.content);
  const contextScreen = [assignmentContext, plannerContext, researchSpec, previousResearchSpec]
    .map((value) => screenPromptOverride(typeof value === "object" ? JSON.stringify(value) : value))
    .find((result) => result.block);
  if (screen.block || contextScreen) {
    const blocked = screen.block ? screen : contextScreen;
    logQuery({ topic: last.content.trim(), matchedIds: [], blocked: true });
    return res.json({ reply: blockedReply(blocked.message), matchedResources: [], sourceDiscovery: sourceDiscoveryStatus(accessScope, []), ...responsePlanContext(null) });
  }

  const releaseChatSlot = acquireChatSlot(clientKey(req));
  if (!releaseChatSlot) {
    res.setHeader("Retry-After", "2");
    return res.status(429).json({ error: "The research service is busy. Please try again shortly." });
  }

  const providerAbort = new AbortController();
  const abortProvider = () => providerAbort.abort(new DOMException("Client disconnected", "AbortError"));
  const abortIfIncomplete = () => {
    if (!res.writableEnded) abortProvider();
  };
  req.once("aborted", abortProvider);
  res.once("close", abortIfIncomplete);
  let resources = [];
  let plan = null;
  let primoPromise = Promise.resolve([]);
  let discoveryOutcomes = {};
  try {
    const researchContext = await retrieveResearchContext(studentText, 6, mode, subjectFocusId, {
      assignmentContext,
      plannerContext,
      researchSpec,
      previousResearchSpec,
      latestUserText,
    });
    plan = researchContext.plan;
    aiHistory = appendRequestContextForAi(history, { assignmentContext, plannerContext, researchSpec: plan?.researchSpec });
    resources = researchContext.resources;
    const effectiveMode = plan?.modeId || mode;
    // Retrieve evidence before asking the model to interpret any source.
    const lookupCatalog = needsFreshSourceEvidence(last.content, previousResearchSpec) || shouldLookupCatalog(last.content, responseStyle, history.filter((message) => message.role === "user").length, { correctedResearchSpec: Boolean(researchSpec) });
    primoPromise = (lookupCatalog
      ? searchSourceCandidatesForScope(liveSearchQueries(plan, studentText), 10, effectiveMode, accessScope, { signal: providerAbort.signal, researchSpec: plan?.researchSpec, onStatus: (outcomes) => { discoveryOutcomes = outcomes; } })
      : Promise.resolve([])).then((results) => prepareSourceEvidence(results).sources);
    const liveResults = await primoPromise;
    const rawReply = await generateChatResponse(aiHistory, resources, effectiveMode, responseStyle, subjectFocusId, { signal: providerAbort.signal, liveResults });

    const { reply: validatedReply, report } = validateReply(rawReply, resources, liveResults);
    const reply = prepareReply(validatedReply, history, liveResults, last.content, responseStyle, resources, subjectFocusId, effectiveMode, plan);
    if (report.dropped.length || report.corrected.length) {
      console.warn("[/api/chat] link guard:", JSON.stringify(report));
    }
    logQuery({ topic: last.content.trim(), matchedIds: resources.map((r) => r.id) });

    res.json({
      reply,
      matchedResources: resources,
      searchTools: await getSearchTools(),
      liveResults,
      sourceDiscovery: sourceDiscoveryStatus(accessScope, liveResults, discoveryOutcomes, plan?.researchSpec),
      ...responsePlanContext(plan),
    });
  } catch (err) {
    if (res.destroyed || res.writableEnded || providerAbort.signal.aborted) return;
    console.error(`[/api/chat] ${err?.code || "ERROR"}`);
    const effectiveMode = plan?.modeId || mode;
    const fallback = plan && (transparentSourceFallback(responseStyle)
      || deterministicPlanFallback(plan, resources));
    if (fallback) {
      const liveResults = await primoPromise.catch(() => []);
      return res.json({
        reply: prepareReply(fallback, history, liveResults, last.content, responseStyle, resources, subjectFocusId, effectiveMode, plan),
        matchedResources: resources,
        searchTools: await getSearchTools(),
        liveResults,
        sourceDiscovery: sourceDiscoveryStatus(accessScope, liveResults, discoveryOutcomes, plan?.researchSpec),
        ...responsePlanContext(plan),
      });
    }
    const liveResults = await primoPromise.catch(() => []);
    const sourceFallback = sourceResultsFallback(liveResults, effectiveMode);
    if (sourceFallback) {
      return res.json({
        reply: prepareReply(sourceFallback, history, liveResults, last.content, responseStyle, resources, subjectFocusId, effectiveMode, plan),
        matchedResources: resources,
        searchTools: await getSearchTools(),
        liveResults,
        sourceDiscovery: sourceDiscoveryStatus(accessScope, liveResults, discoveryOutcomes, plan?.researchSpec),
        ...responsePlanContext(plan),
      });
    }
    if (err.code === "NO_API_KEY") return noKeyResponse(res);
    res.status(502).json({ error: "Could not generate a reply right now. Please try again." });
  } finally {
    releaseChatSlot();
    req.removeListener("aborted", abortProvider);
    res.removeListener("close", abortIfIncomplete);
  }
});

// Streaming transport buffers model text until evidence checks finish.
//   {type:"done", reply, matchedResources}
//   {type:"error", error}
app.post("/api/chat/stream", async (req, res) => {
  if (gate(req, res, "chat")) return;
  const parsed = parseChatRequest(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { history, studentText, last, mode, responseStyle, subjectFocusId, accessScope, assignmentContext, plannerContext, researchSpec, previousResearchSpec, latestUserText } = parsed;
  let aiHistory = appendRequestContextForAi(history, { assignmentContext, plannerContext });

  // Relevance / abuse screen — redirect clear-cut cases without a model call.
  const screen = screenMessage(last.content);
  const contextScreen = [assignmentContext, plannerContext, researchSpec, previousResearchSpec]
    .map((value) => screenPromptOverride(typeof value === "object" ? JSON.stringify(value) : value))
    .find((result) => result.block);
  if (screen.block || contextScreen) {
    const blocked = screen.block ? screen : contextScreen;
    logQuery({ topic: last.content.trim(), matchedIds: [], blocked: true });
    res.setHeader("Content-Type", "application/x-ndjson");
    res.write(JSON.stringify({ type: "delta", message: blocked.message }) + "\n");
    res.write(JSON.stringify({ type: "done", reply: blockedReply(blocked.message), matchedResources: [], sourceDiscovery: sourceDiscoveryStatus(accessScope, []), ...responsePlanContext(null) }) + "\n");
    return res.end();
  }

  let resources;
  let plan;
  try {
    const researchContext = await retrieveResearchContext(studentText, 6, mode, subjectFocusId, {
      assignmentContext,
      plannerContext,
      researchSpec,
      previousResearchSpec,
      latestUserText,
    });
    plan = researchContext.plan;
    aiHistory = appendRequestContextForAi(history, { assignmentContext, plannerContext, researchSpec: plan?.researchSpec });
    resources = researchContext.resources;
  } catch (err) {
    console.error("[/api/chat/stream] retrieve", err.message);
    return res.status(502).json({ error: "Could not generate a reply right now. Please try again." });
  }

  const releaseChatSlot = acquireChatSlot(clientKey(req));
  if (!releaseChatSlot) {
    res.setHeader("Retry-After", "2");
    return res.status(429).json({ error: "The research service is busy. Please try again shortly." });
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  const write = (obj) => res.write(JSON.stringify(obj) + "\n");
  let primoPromise = Promise.resolve([]);
  let discoveryOutcomes = {};
  const providerAbort = new AbortController();
  const abortProvider = () => providerAbort.abort(new DOMException("Client disconnected", "AbortError"));
  const abortIfIncomplete = () => {
    if (!res.writableEnded) abortProvider();
  };
  req.once("aborted", abortProvider);
  res.once("close", abortIfIncomplete);

  try {
    const effectiveMode = plan?.modeId || mode;
    const lookupCatalog = needsFreshSourceEvidence(last.content, previousResearchSpec) || shouldLookupCatalog(last.content, responseStyle, history.filter((message) => message.role === "user").length, { correctedResearchSpec: Boolean(researchSpec) });
    primoPromise = (lookupCatalog
      ? searchSourceCandidatesForScope(liveSearchQueries(plan, studentText), 10, effectiveMode, accessScope, { signal: providerAbort.signal, researchSpec: plan?.researchSpec, onStatus: (outcomes) => { discoveryOutcomes = outcomes; } })
      : Promise.resolve([])).then((results) => prepareSourceEvidence(results).sources);
    const liveResults = await primoPromise;
    const initial = validateReply({ evidence_notes: [] }, resources, liveResults).reply;
    write({
      type: "sources", guidancePending: true,
      reply: prepareReply(initial, history, liveResults, last.content, responseStyle, resources, subjectFocusId, effectiveMode, plan),
      matchedResources: resources, searchTools: await getSearchTools(), liveResults,
      sourceDiscovery: sourceDiscoveryStatus(accessScope, liveResults, discoveryOutcomes, plan?.researchSpec),
      ...responsePlanContext(plan),
    });
    const rawReply = await streamChatResponse(
      aiHistory,
      resources,
      undefined,
      effectiveMode,
      responseStyle,
      subjectFocusId,
      { signal: providerAbort.signal, liveResults }
    );

    const { reply: validatedReply, report } = validateReply(rawReply, resources, liveResults);
    const reply = prepareReply(validatedReply, history, liveResults, last.content, responseStyle, resources, subjectFocusId, effectiveMode, plan);
    if (report.dropped.length || report.corrected.length) {
      console.warn("[/api/chat/stream] link guard:", JSON.stringify(report));
    }
    logQuery({ topic: last.content.trim(), matchedIds: resources.map((r) => r.id) });

    write({
      type: "done",
      reply,
      matchedResources: resources,
      searchTools: await getSearchTools(),
      liveResults,
      sourceDiscovery: sourceDiscoveryStatus(accessScope, liveResults, discoveryOutcomes, plan?.researchSpec),
      ...responsePlanContext(plan),
    });
    res.end();
  } catch (err) {
    if (res.destroyed || res.writableEnded || providerAbort.signal.aborted) return;
    console.error(`[/api/chat/stream] ${err?.code || "ERROR"}`);
    const effectiveMode = plan?.modeId || mode;
    const fallback = plan && (transparentSourceFallback(responseStyle)
      || deterministicPlanFallback(plan, resources));
    if (fallback) {
      const liveResults = await primoPromise.catch(() => []);
      write({
        type: "done",
        reply: prepareReply(fallback, history, liveResults, last.content, responseStyle, resources, subjectFocusId, effectiveMode, plan),
        matchedResources: resources,
        searchTools: await getSearchTools(),
        liveResults,
        sourceDiscovery: sourceDiscoveryStatus(accessScope, liveResults, discoveryOutcomes, plan?.researchSpec),
        ...responsePlanContext(plan),
      });
      return res.end();
    }
    const liveResults = await primoPromise.catch(() => []);
    const sourceFallback = sourceResultsFallback(liveResults, effectiveMode);
    if (sourceFallback) {
      write({
        type: "done",
        reply: prepareReply(sourceFallback, history, liveResults, last.content, responseStyle, resources, subjectFocusId, effectiveMode, plan),
        matchedResources: resources,
        searchTools: await getSearchTools(),
        liveResults,
        sourceDiscovery: sourceDiscoveryStatus(accessScope, liveResults, discoveryOutcomes, plan?.researchSpec),
        ...responsePlanContext(plan),
      });
      return res.end();
    }
    const msg =
      err.code === "NO_API_KEY"
        ? "AI generation is not configured on this deployment."
        : "Could not generate a reply right now. Please try again.";
    // If we haven't streamed yet, a clean JSON error is friendlier.
    if (!res.headersSent) return res.status(502).json({ error: msg });
    write({ type: "error", error: msg });
    res.end();
  } finally {
    releaseChatSlot();
    req.removeListener("aborted", abortProvider);
    res.removeListener("close", abortIfIncomplete);
  }
});

// Students rate a reply or report a gap; librarians read it back.
app.post("/api/feedback", async (req, res) => {
  if (gate(req, res, "feedback")) return;
  const { rating, note, topic } = req.body || {};
  if (!["up", "down", "gap"].includes(rating)) {
    return res.status(400).json({ error: "Invalid rating." });
  }
  try {
    await logFeedback({ rating, note: String(note || "").slice(0, 1000), topic: String(topic || "").slice(0, 2000) });
    res.json({ ok: true });
  } catch (err) {
    console.error("[/api/feedback]", err.message);
    res.status(500).json({ error: "Could not save feedback." });
  }
});

function compactLines(items, render, limit = 6) {
  return (items || [])
    .slice(0, limit)
    .map(render)
    .filter(Boolean)
    .join("\n");
}

function handoffEmailBody({ topic, mode, responseStyle, subjectFocus, note, contact, searchTerms, liveResults, matchedResources, librarianRoutes, researchWorkspace }) {
  const terms = compactLines(searchTerms, (term) => `- ${term}`, 10);
  const results = compactLines(
    liveResults,
    (item) => `- ${item.title || "Untitled"}${item.type ? ` (${item.type})` : ""}${item.url ? `\n  ${item.url}` : ""}`,
    8
  );
  const resources = compactLines(
    matchedResources,
    (item) => `- ${item.name || item.resource_name || item.id}${item.url ? `\n  ${item.url}` : ""}`,
    8
  );
  const routes = compactLines(
    librarianRoutes,
    (item) => `- ${item.label || item.unit || "ZSR support"}${item.unit ? ` (${item.unit})` : ""}${item.reason ? `\n  ${item.reason}` : ""}${item.href ? `\n  ${item.href}` : ""}`,
    3
  );
  const assignment = researchWorkspace?.assignment || {};
  const assignmentLines = [
    assignment.course ? `- Course: ${assignment.course}` : "",
    assignment.assignmentType ? `- Assignment: ${assignment.assignmentType}` : "",
    assignment.dueDate ? `- Due date: ${assignment.dueDate}` : "",
    assignment.sourceCount ? `- Source target: ${assignment.sourceCount}` : "",
    assignment.sourceTypes ? `- Required source types: ${assignment.sourceTypes}` : "",
    assignment.dateRange ? `- Date expectations: ${assignment.dateRange}` : "",
    assignment.constraints ? `- Other constraints: ${assignment.constraints}` : "",
  ].filter(Boolean).join("\n");
  const savedTrail = compactLines(researchWorkspace?.trail, (item) => `- ${item.title || "Saved lead"} [${item.status || "promising"}]${item.url ? `\n  ${item.url}` : ""}${item.notes ? `\n  Notes: ${item.notes}` : ""}${item.citation ? `\n  Citation details: ${item.citation}` : ""}`, 12);
  const triedSearches = compactLines(researchWorkspace?.searchHistory, (item) => `- ${item.query || ""}${item.tool ? ` (${item.tool})` : ""}${item.resultNote ? `\n  Result note: ${item.resultNote}` : ""}`, 12);

  return [
    "Hello ZSR,",
    "",
    "I used the ZSR Research Navigator and would like help with this research question.",
    "",
    `Topic: ${topic || "(not provided)"}`,
    `Research mode: ${mode || "(not provided)"}`,
    `Response style: ${responseStyle || "(not provided)"}`,
    subjectFocus ? `Subject focus: ${subjectFocus}` : "",
    contact ? `Student contact: ${contact}` : "",
    note ? `Student note: ${note}` : "",
    "",
    assignmentLines ? `Assignment brief:\n${assignmentLines}` : "",
    "",
    triedSearches ? `Searches tried:\n${triedSearches}` : "",
    "",
    savedTrail ? `Saved research trail:\n${savedTrail}` : "",
    "",
    routes ? `Recommended ZSR support routes:\n${routes}` : "",
    "",
    terms ? `Search terms tried or suggested:\n${terms}` : "",
    "",
    resources ? `Recommended ZSR paths:\n${resources}` : "",
    "",
    results ? `Source leads to review:\n${results}` : "",
    "",
    "Please help me confirm the best databases, search terms, and next steps.",
  ].filter((line) => line !== "").join("\n");
}

app.post("/api/handoff", async (req, res) => {
  if (gate(req, res, "handoff")) return;
  const body = req.body || {};
  const topic = String(body.topic || "").slice(0, 2000);
  if (!topic.trim()) {
    return res.status(400).json({ error: "A topic is required for librarian handoff." });
  }

  const payload = {
    topic,
    mode: String(body.mode || "").slice(0, 80),
    responseStyle: String(body.responseStyle || "").slice(0, 80),
    subjectFocus: String(body.subjectFocus || "").slice(0, 120),
    note: String(body.note || "").slice(0, 1000),
    contact: String(body.contact || "").slice(0, 300),
    searchTerms: Array.isArray(body.searchTerms) ? body.searchTerms : [],
    liveResults: Array.isArray(body.liveResults) ? body.liveResults : [],
    matchedResources: Array.isArray(body.matchedResources) ? body.matchedResources : [],
    librarianRoutes: Array.isArray(body.librarianRoutes) ? body.librarianRoutes : [],
    researchWorkspace: body.researchWorkspace && typeof body.researchWorkspace === "object" ? {
      assignment: body.researchWorkspace.assignment && typeof body.researchWorkspace.assignment === "object" ? {
        course: String(body.researchWorkspace.assignment.course || "").slice(0, 160),
        assignmentType: String(body.researchWorkspace.assignment.assignmentType || "").slice(0, 160),
        dueDate: String(body.researchWorkspace.assignment.dueDate || "").slice(0, 40),
        sourceCount: String(body.researchWorkspace.assignment.sourceCount || "").slice(0, 80),
        sourceTypes: String(body.researchWorkspace.assignment.sourceTypes || "").slice(0, 500),
        dateRange: String(body.researchWorkspace.assignment.dateRange || "").slice(0, 300),
        constraints: String(body.researchWorkspace.assignment.constraints || "").slice(0, 1000),
      } : {},
      trail: Array.isArray(body.researchWorkspace.trail) ? body.researchWorkspace.trail.slice(0, 12).map((item) => ({
        title: String(item?.title || "").slice(0, 300),
        url: String(item?.url || "").slice(0, 1000),
        status: String(item?.status || "").slice(0, 40),
        notes: String(item?.notes || "").slice(0, 1000),
        citation: String(item?.citation || "").slice(0, 1000),
      })) : [],
      searchHistory: Array.isArray(body.researchWorkspace.searchHistory) ? body.researchWorkspace.searchHistory.slice(0, 12).map((item) => ({
        query: String(item?.query || "").slice(0, 500),
        tool: String(item?.tool || "").slice(0, 160),
        resultNote: String(item?.resultNote || "").slice(0, 500),
      })) : [],
    } : {},
  };

  try {
    await logHandoff(payload).catch(() => console.warn("[handoff] aggregate event was not retained"));
    const subject = `Research help request: ${payload.topic.slice(0, 80)}`;
    const bodyText = handoffEmailBody(payload);
    const mailto = `mailto:${ASK_ZSR_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    res.json({
      ok: true,
      askEmail: ASK_ZSR_EMAIL,
      mailto,
      body: bodyText,
    });
  } catch (err) {
    console.error("[/api/handoff]", err.message);
    res.status(500).json({ error: "Could not prepare the librarian handoff." });
  }
});

// Simple librarian view of recent feedback.
app.get("/api/feedback", async (req, res) => {
  if (!isAdminAuthorized(req)) return res.status(404).json({ error: "Not found." });
  res.json({ feedback: await readFeedback() });
});

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

app.use((err, _req, res, next) => {
  if (err?.type === "entity.too.large" || err?.status === 413) {
    return res.status(413).json({ error: "Request body is too large." });
  }
  if (err instanceof SyntaxError && err?.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  console.error(`[express] ${err?.code || "INTERNAL_ERROR"}`);
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: "Internal server error." });
});

// In production, serve the built frontend from the same server.
const distDir = join(__dirname, "..", "dist");
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(join(distDir, "index.html")));
}

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, HOST, () => {
    console.log(`ZSR Research Navigator listening on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  });
}
