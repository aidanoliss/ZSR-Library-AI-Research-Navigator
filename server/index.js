import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

import { retrieveResources, loadResources, getSearchTools } from "./retrieve.js";
import { generateChatResponse, streamChatResponse } from "./gemini.js";
import { validateReply } from "./validate.js";
import {
  logQuery,
  logFeedback,
  logHandoff,
  loggingStatus,
  readFeedback,
  readHandoffs,
  readQuerySummary,
} from "./log.js";
import { rateLimit } from "./ratelimit.js";
import { screenMessage, blockedReply } from "./screen.js";
import { searchSourceCandidates } from "./primo.js";
import { shouldLookupCatalog } from "./catalogIntent.js";
import { appendRequestContextForAi, requestContextFromBody } from "./requestContext.js";
import { applySourceContract, transparentSourceFallback } from "./sourceContract.js";
import { buildPrimoRequest } from "./primoApi.js";
import {
  DEFAULT_MODE_ID,
  DEFAULT_RESPONSE_STYLE_ID,
  getResponseStyle,
  getSearchMode,
} from "../config/libraryLinks.js";
import { DEFAULT_SUBJECT_FOCUS_ID, getSubjectFocus, resolveSubjectFocus } from "../config/subjectFocus.js";
import {
  buildCatalogSearchQueries,
  buildResearchPlan,
  buildSearchTermSuggestions,
  isSubstantiveResearchRequest,
} from "../config/researchAgent.js";
import {
  activeResearchConversation,
  submittedResearchTopicContext,
} from "../src/conversationContext.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const ASK_ZSR_EMAIL = process.env.ASK_ZSR_EMAIL || "askzsr@wfu.edu";

export const app = express();
app.use(cors());
app.use(express.json());

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
app.get("/api/health", async (_req, res) => {
  const resources = await loadResources();
  res.json({ ok: true, resourceCount: resources.length });
});

function envConfigured(name) {
  return Boolean(String(process.env[name] || "").trim());
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
  const primoRequest = buildPrimoRequest("test", DEFAULT_MODE_ID);
  return {
    gemini: {
      configured: envConfigured("GEMINI_API_KEY"),
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    },
    primoPublicLookup: {
      configured: (process.env.PRIMO_LIVE || "on").toLowerCase() !== "off",
      note: "Best-effort public Primo lookup; not an approved authenticated ZSR API.",
    },
    primoApi: {
      configured: primoRequest.configured,
      endpointConfigured: Boolean(primoRequest.endpoint),
      keyConfigured: envConfigured("PRIMO_API_KEY"),
    },
    libkey: {
      libraryIdConfigured: envConfigured("VITE_WFU_LIBKEY_LIBRARY_ID") || envConfigured("WFU_LIBKEY_LIBRARY_ID"),
      note: "Without a Wake Forest LibKey library ID, the app uses LibKey choose-library links.",
    },
  };
}

async function pilotStatusPayload() {
  const resources = await loadResources();
  return {
    ok: true,
    prototype: true,
    canonicalPath: "/Users/aidanoliss/Desktop/ZSR AI Assistant",
    privacy: loggingStatus(),
    resources: resourceSummary(resources),
    integrations: integrationStatus(),
  };
}

app.get("/api/pilot/status", async (_req, res) => {
  res.json(await pilotStatusPayload());
});

app.get("/api/admin/summary", async (_req, res) => {
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

/**
 * Validate + normalize an incoming chat request body.
 * Returns { error } on bad input, or normalized message, mode, focus, and model-only context on success.
 */
function parseChatRequest(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return { error: "Please enter a research topic or question to get started." };
  }
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !String(last.content || "").trim()) {
    return { error: "The latest message must be from the student." };
  }
  if (String(last.content).length > 2000) {
    return { error: "That message is very long — please shorten it to under 2000 characters." };
  }
  if (messages.length > 40) {
    return { error: "This conversation is quite long. Please start a new chat." };
  }

  const normalizedHistory = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .map((m) => ({ role: m.role, content: String(m.content).trim() }));
  const history = activeResearchConversation(normalizedHistory);

  const studentText = submittedResearchTopicContext(history) || String(last.content).trim();

  const mode = getSearchMode(body?.mode || DEFAULT_MODE_ID).id;
  const responseStyle = getResponseStyle(body?.responseStyle || DEFAULT_RESPONSE_STYLE_ID).id;
  const subjectFocusId = getSubjectFocus(body?.subjectFocusId || DEFAULT_SUBJECT_FOCUS_ID).id;
  return { history, studentText, last, mode, responseStyle, subjectFocusId, ...requestContextFromBody(body) };
}

function noKeyResponse(res) {
  return res.status(503).json({
    error:
      "The server is missing a Gemini API key. Add GEMINI_API_KEY to your .env file (see .env.example).",
  });
}

/** Shared gate: rate limit + relevance/abuse screen. Returns null if OK. */
function gate(req, res) {
  const key = req.ip || req.socket?.remoteAddress || "unknown";
  const limit = rateLimit(key);
  if (!limit.allowed) {
    res.status(429).json({
      error: `You've sent a lot of requests in a short time. Please wait about ${Math.ceil(
        limit.retryAfter / 60
      )} minute(s) and try again.`,
    });
    return true;
  }
  return false;
}

function startingPoint(resources, id, why) {
  const resource = resources.find((r) => r.id === id);
  if (!resource) return null;
  return { resource_name: resource.name, url: resource.url, why };
}

function catalogSearchQueries(history, studentText, _modeId = DEFAULT_MODE_ID, subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID) {
  const subjectFocus = resolveSubjectFocus(subjectFocusId, studentText);
  const focusId = subjectFocus.selectedId || subjectFocus.id;
  return buildCatalogSearchQueries(studentText, focusId, 6);
}

function withCatalogFoundIntro(reply, liveResults, latestText) {
  if (!reply || !liveResults?.length) return reply;
  if (!sourceRequestIntent(latestText)) {
    return reply;
  }
  return {
    ...reply,
    message:
      "Here's what I found in ZSR's catalog. Open each record to confirm access, format, and fit.",
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

function prepareReply(reply, history, liveResults, latestText, responseStyle = DEFAULT_RESPONSE_STYLE_ID, resources = [], subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID) {
  const researchText = submittedResearchTopicContext(history) || latestText;
  const deterministicPlan = isSubstantiveResearchRequest(researchText)
    ? buildResearchPlan(researchText, 6, subjectFocusId)
    : null;
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
  const withSources = applySourceContract(withIntro, resources, deterministicPlan, liveResults, responseStyle);
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
    message:
      `Here's what I found in ZSR's catalog for ${mode.shortLabel.toLowerCase()} research. Open each record to confirm access, format, and fit.`,
    search_terms: [],
  };
}

function fallbackDatabaseStrategy(original, modeId = DEFAULT_MODE_ID) {
  const plan = buildResearchPlan(original, 4);
  return plan.recommendations.map((resource) => ({
    database: resource.name,
    az_area: resource.subjectArea,
    why: resource.whyFits,
    search_inside: [
      `Run: ${resource.searchTerms[0]}`,
      ...resource.filters,
    ].filter(Boolean),
    journals_or_sources: [resource.expect].filter(Boolean),
  }));
}

function fallbackTopicOptions(original) {
  const topic = String(original || "the topic").trim();
  if (/\b(ptsd|trauma)\b/i.test(topic) && /\b(tv|television|watching)\b/i.test(topic)) {
    return [
      {
        title: "Fictional trauma portrayals and viewer distress",
        research_question: "How do fictional television portrayals of trauma shape viewers' anxiety, distress, or perceptions of PTSD?",
        why: "It narrows the topic to media representation and audience effects, which fits communication and psychology databases.",
        source_types: ["Peer-reviewed articles", "Media-effects studies", "Psychology research"],
        search_terms: ['television trauma portrayal AND PTSD', '"media effects" AND trauma AND viewers'],
      },
      {
        title: "News exposure and secondary traumatic stress",
        research_question: "Can repeated television news exposure to disasters or violence contribute to secondary traumatic stress symptoms?",
        why: "It creates a clearer causal mechanism and lets the student compare journalism, psychology, and public-health sources.",
        source_types: ["Peer-reviewed articles", "News studies", "Public-health research"],
        search_terms: ['"secondary traumatic stress" AND television news', 'disaster coverage AND viewer distress'],
      },
      {
        title: "True crime, violence, and perceived safety",
        research_question: "How does frequent exposure to true-crime or violent television content affect perceived safety and trauma-related symptoms?",
        why: "It gives the project a recognizable content genre and measurable outcomes.",
        source_types: ["Communication studies", "Psychology articles", "Audience research"],
        search_terms: ['true crime television AND anxiety', 'violent media AND perceived safety AND trauma'],
      },
      {
        title: "Content warnings and trauma-sensitive viewing",
        research_question: "Do content warnings before traumatic television scenes reduce distress for viewers with trauma histories?",
        why: "It is focused enough for a research paper and points toward intervention/evaluation literature.",
        source_types: ["Psychology articles", "Media studies", "Ethics/commentary"],
        search_terms: ['content warnings AND trauma AND television', 'trigger warnings AND PTSD AND media'],
      },
    ];
  }

  return [
    {
      title: "Process or cause",
      research_question: `Which processes, causes, or institutions shaped ${topic}, and what evidence best explains them?`,
      why: "A process or cause gives the search concrete explanatory concepts instead of one broad topic phrase.",
      source_types: ["Peer-reviewed articles", "Theory/background sources"],
      search_terms: [`${topic} causes`, `${topic} process institutions`],
    },
    {
      title: "Define the scope",
      research_question: `How did ${topic} vary within one defined place, community, or time period?`,
      why: "A concrete scope makes database terms, date limits, and subject filters easier to choose.",
      source_types: ["Scholarly articles", "Books/background sources", "Data or primary sources when relevant"],
      search_terms: [`${topic} case study`, `${topic} historical context`],
    },
    {
      title: "Comparison angle",
      research_question: `How does ${topic} differ across two groups, time periods, platforms, or settings?`,
      why: "A comparison creates a stronger analytical structure for a paper.",
      source_types: ["Peer-reviewed articles", "News/current context", "Data"],
      search_terms: [`${topic} comparison`, `${topic} differences`],
    },
  ];
}

function followupFallback(history, resources, modeId = DEFAULT_MODE_ID) {
  const userTurns = history.filter((m) => m.role === "user").length;
  if (userTurns <= 1) return null;

  const latest = String(history[history.length - 1]?.content || "").toLowerCase();
  const original = history.filter((m) => m.role === "user")[0]?.content || "your topic";
  const mode = getSearchMode(modeId);
  const suggested_followups = [
    "Help me narrow this into a research question",
    "Suggest stronger search terms",
    "Help me evaluate sources I find",
  ];

  if (topicOptionIntent(latest)) {
    return {
      message:
        "Here are researchable angles you could choose from. Pick the one that best matches the assignment, then use it to build search terms and choose databases.",
      topic_options: fallbackTopicOptions(original),
      suggested_followups: ["Turn one option into a research question", "Find ZSR databases for one option", "Build search terms for one option"],
    };
  }

  if (/peer|scholarly|article|journal/.test(latest)) {
    return {
      message:
        "Here's what I found: open the live catalog leads below first, then use the search terms if you need more results.",
      search_terms: buildSearchTermSuggestions(original, [], DEFAULT_SUBJECT_FOCUS_ID, 6),
      suggested_followups,
    };
  }

  if (/narrow|focus|question|scope/.test(latest)) {
    return {
      message:
        "Narrow the topic by choosing one platform, one mental-health outcome, one age range, and a date range.",
      search_terms: [
        'Instagram AND adolescent* AND anxiety',
        'TikTok AND teen* AND "body image"',
        '"social comparison" AND youth AND depression',
      ],
      suggested_followups: [
        "Focus on one platform",
        "Focus on anxiety or depression",
        "Turn this into a research question",
      ],
    };
  }

  if (/citat|cite|apa|mla|zotero|bibliograph/.test(latest)) {
    return {
      message:
        "For psychology, health, and communication topics, APA style is often the right starting point unless your instructor says otherwise.",
      starting_points: [
        startingPoint(resources, "citation-zotero", "Use this for citation style help and Zotero setup."),
      ].filter(Boolean),
      citation_tips: [
        "Save the DOI, author list, journal title, volume, issue, pages, and publication date as soon as you open a source.",
        "Use Zotero or another citation manager while searching, not after you finish reading.",
        "Check your assignment prompt before assuming APA, MLA, or Chicago style.",
      ],
      suggested_followups,
    };
  }

  if (/database|resource|source|where/.test(latest)) {
    return {
      message:
        "Use a psychology database, a communication database, and a health database so the topic is covered from more than one discipline.",
      starting_points: [
        startingPoint(resources, "psycinfo", "Psychology and adolescent mental-health research."),
        startingPoint(resources, "communication-mass-media-complete", "Communication and media-effects research."),
        startingPoint(resources, "pubmed-medline", "Health and clinical research."),
      ].filter(Boolean),
      database_strategy: fallbackDatabaseStrategy(original, modeId),
      suggested_followups,
    };
  }

  return {
    message: `Here is a practical ${mode.shortLabel.toLowerCase()} next step: turn the request into two or three searchable concepts, then test those terms in the right ZSR search tool.`,
    search_terms: buildSearchTermSuggestions(original, [], DEFAULT_SUBJECT_FOCUS_ID, 6),
    suggested_followups,
  };
}

// Buffered endpoint: full conversation in, complete structured reply out.
app.post("/api/chat", async (req, res) => {
  if (gate(req, res)) return;
  const parsed = parseChatRequest(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { history, studentText, last, mode, responseStyle, subjectFocusId, assignmentContext, plannerContext } = parsed;
  const aiHistory = appendRequestContextForAi(history, { assignmentContext, plannerContext });

  // Relevance / abuse screen — redirect clear-cut cases without a model call.
  const screen = screenMessage(last.content);
  if (screen.block) {
    logQuery({ topic: last.content.trim(), matchedIds: [], blocked: true });
    return res.json({ reply: blockedReply(screen.message), matchedResources: [] });
  }

  let resources = [];
  let primoPromise = Promise.resolve([]);
  try {
    resources = await retrieveResources(studentText, 6, mode, subjectFocusId);
    // Run the AI plan and the live ZSR catalog lookup in parallel.
    const lookupCatalog = shouldLookupCatalog(last.content, responseStyle, history.filter((message) => message.role === "user").length);
    primoPromise = lookupCatalog
      ? searchSourceCandidates(catalogSearchQueries(history, studentText, mode, subjectFocusId), 10, mode)
      : Promise.resolve([]);
    const rawReply = await generateChatResponse(aiHistory, resources, mode, responseStyle, subjectFocusId);
    const liveResults = await primoPromise;

    const { reply: validatedReply, report } = validateReply(rawReply, resources);
    const reply = prepareReply(validatedReply, history, liveResults, last.content, responseStyle, resources, subjectFocusId);
    if (report.dropped.length || report.corrected.length) {
      console.warn("[/api/chat] link guard:", JSON.stringify(report));
    }
    logQuery({ topic: last.content.trim(), matchedIds: resources.map((r) => r.id) });

    res.json({ reply, matchedResources: resources, searchTools: await getSearchTools(), liveResults });
  } catch (err) {
    console.error("[/api/chat]", err.message);
    const fallback = transparentSourceFallback(responseStyle) || followupFallback(history, resources, mode);
    if (fallback) {
      const liveResults = await primoPromise.catch(() => []);
      return res.json({
        reply: prepareReply(fallback, history, liveResults, last.content, responseStyle, resources, subjectFocusId),
        matchedResources: resources,
        searchTools: await getSearchTools(),
        liveResults,
      });
    }
    const liveResults = await primoPromise.catch(() => []);
    const sourceFallback = sourceResultsFallback(liveResults, mode);
    if (sourceFallback) {
      return res.json({
        reply: prepareReply(sourceFallback, history, liveResults, last.content, responseStyle, resources, subjectFocusId),
        matchedResources: resources,
        searchTools: await getSearchTools(),
        liveResults,
      });
    }
    if (err.code === "NO_API_KEY") return noKeyResponse(res);
    res.status(502).json({ error: "Could not generate a reply right now. Please try again." });
  }
});

// Streaming endpoint: emits newline-delimited JSON events as the reply forms.
//   {type:"delta", message}            ← conversational text so far
//   {type:"done", reply, matchedResources}
//   {type:"error", error}
app.post("/api/chat/stream", async (req, res) => {
  if (gate(req, res)) return;
  const parsed = parseChatRequest(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { history, studentText, last, mode, responseStyle, subjectFocusId, assignmentContext, plannerContext } = parsed;
  const aiHistory = appendRequestContextForAi(history, { assignmentContext, plannerContext });

  // Relevance / abuse screen — redirect clear-cut cases without a model call.
  const screen = screenMessage(last.content);
  if (screen.block) {
    logQuery({ topic: last.content.trim(), matchedIds: [], blocked: true });
    res.setHeader("Content-Type", "application/x-ndjson");
    res.write(JSON.stringify({ type: "delta", message: screen.message }) + "\n");
    res.write(JSON.stringify({ type: "done", reply: blockedReply(screen.message), matchedResources: [] }) + "\n");
    return res.end();
  }

  let resources;
  try {
    resources = await retrieveResources(studentText, 6, mode, subjectFocusId);
  } catch (err) {
    console.error("[/api/chat/stream] retrieve", err.message);
    return res.status(502).json({ error: "Could not generate a reply right now. Please try again." });
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  const write = (obj) => res.write(JSON.stringify(obj) + "\n");
  let primoPromise = Promise.resolve([]);

  try {
    const lookupCatalog = shouldLookupCatalog(last.content, responseStyle, history.filter((message) => message.role === "user").length);
    primoPromise = lookupCatalog
      ? searchSourceCandidates(catalogSearchQueries(history, studentText, mode, subjectFocusId), 10, mode)
      : Promise.resolve([]); // in parallel with streaming
    const rawReply = await streamChatResponse(
      aiHistory,
      resources,
      (message) => write({ type: "delta", message }),
      mode,
      responseStyle,
      subjectFocusId
    );

    const liveResults = await primoPromise;
    const { reply: validatedReply, report } = validateReply(rawReply, resources);
    const reply = prepareReply(validatedReply, history, liveResults, last.content, responseStyle, resources, subjectFocusId);
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
    });
    res.end();
  } catch (err) {
    console.error("[/api/chat/stream]", err.message);
    const fallback = transparentSourceFallback(responseStyle) || followupFallback(history, resources, mode);
    if (fallback) {
      const liveResults = await primoPromise.catch(() => []);
      write({
        type: "done",
        reply: prepareReply(fallback, history, liveResults, last.content, responseStyle, resources, subjectFocusId),
        matchedResources: resources,
        searchTools: await getSearchTools(),
        liveResults,
      });
      return res.end();
    }
    const liveResults = await primoPromise.catch(() => []);
    const sourceFallback = sourceResultsFallback(liveResults, mode);
    if (sourceFallback) {
      write({
        type: "done",
        reply: prepareReply(sourceFallback, history, liveResults, last.content, responseStyle, resources, subjectFocusId),
        matchedResources: resources,
        searchTools: await getSearchTools(),
        liveResults,
      });
      return res.end();
    }
    const msg =
      err.code === "NO_API_KEY"
        ? "The server is missing a Gemini API key. Add GEMINI_API_KEY to your .env file (see .env.example)."
        : "Could not generate a reply right now. Please try again.";
    // If we haven't streamed yet, a clean JSON error is friendlier.
    if (!res.headersSent) return res.status(502).json({ error: msg });
    write({ type: "error", error: msg });
    res.end();
  }
});

// Students rate a reply or report a gap; librarians read it back.
app.post("/api/feedback", async (req, res) => {
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
    results ? `Catalog leads to review:\n${results}` : "",
    "",
    "Please help me confirm the best databases, search terms, and next steps.",
  ].filter((line) => line !== "").join("\n");
}

app.post("/api/handoff", async (req, res) => {
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
    await logHandoff(payload);
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
app.get("/api/feedback", async (_req, res) => {
  res.json({ feedback: await readFeedback() });
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
