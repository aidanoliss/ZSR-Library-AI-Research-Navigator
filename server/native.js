import "dotenv/config";
import { createReadStream, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { retrieveResources, loadResources, getSearchTools } from "./retrieve.js";
import { generateChatResponse, streamChatResponse } from "./gemini.js";
import { validateReply } from "./validate.js";
import {
  logFeedback,
  logHandoff,
  logQuery,
  loggingStatus,
  readFeedback,
  readHandoffs,
  readQuerySummary,
} from "./log.js";
import { rateLimit } from "./ratelimit.js";
import { screenMessage, blockedReply } from "./screen.js";
import { searchPrimo } from "./primo.js";
import { buildPrimoRequest } from "./primoApi.js";
import {
  DEFAULT_MODE_ID,
  DEFAULT_RESPONSE_STYLE_ID,
  getResponseStyle,
  getSearchMode,
} from "../config/libraryLinks.js";
import { DEFAULT_SUBJECT_FOCUS_ID, getSubjectFocus, resolveSubjectFocus } from "../config/subjectFocus.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const ASK_ZSR_EMAIL = process.env.ASK_ZSR_EMAIL || "askzsr@wfu.edu";
const DIST_DIR = join(__dirname, "..", "dist");

function sendJson(res, status, payload) {
  if (res.writableEnded) return;
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload));
}

function sendNdjsonHead(res, status = 200) {
  if (res.writableEnded) return false;
  if (res.headersSent) return true;
  res.writeHead(status, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
  });
  return true;
}

function writeNdjson(res, obj) {
  if (res.writableEnded) return;
  if (!res.headersSent) sendNdjsonHead(res);
  res.write(JSON.stringify(obj) + "\n");
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  return JSON.parse(raw);
}

function parseChatRequest(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || messages.length === 0) return { error: "Please enter a research topic or question to get started." };
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !String(last.content || "").trim()) return { error: "The latest message must be from the student." };
  if (String(last.content).length > 2000) return { error: "That message is very long — please shorten it to under 2000 characters." };
  if (messages.length > 40) return { error: "This conversation is quite long. Please start a new chat." };

  const history = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .map((m) => ({ role: m.role, content: String(m.content).trim() }));

  const studentText = history.filter((m) => m.role === "user").map((m) => m.content).join(" ");
  const mode = getSearchMode(body?.mode || DEFAULT_MODE_ID).id;
  const responseStyle = getResponseStyle(body?.responseStyle || DEFAULT_RESPONSE_STYLE_ID).id;
  const subjectFocusId = getSubjectFocus(body?.subjectFocusId || DEFAULT_SUBJECT_FOCUS_ID).id;
  return { history, studentText, last, mode, responseStyle, subjectFocusId };
}

function gate(req) {
  const key = req.socket?.remoteAddress || "unknown";
  const limit = rateLimit(key);
  if (limit.allowed) return null;
  return {
    status: 429,
    payload: {
      error: `You've sent a lot of requests in a short time. Please wait about ${Math.ceil(limit.retryAfter / 60)} minute(s) and try again.`,
    },
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

function catalogSearchText(history, studentText, modeId = DEFAULT_MODE_ID, subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID) {
  const mode = getSearchMode(modeId);
  const subjectFocus = resolveSubjectFocus(subjectFocusId, studentText);
  const focusTerms = subjectFocus.id === "interdisciplinary" ? "" : subjectFocus.keywords.slice(0, 2).join(" ");
  const userTurns = history.filter((m) => m.role === "user");
  const latest = userTurns[userTurns.length - 1]?.content || "";
  if (userTurns.length <= 1) return `${studentText} ${focusTerms} ${mode.termSuffixes.slice(0, 2).join(" ")}`.trim();
  const substantiveWords = latest
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^(find|show|give|provide|article|articles|source|sources|about|with|help|peer|reviewed|scholarly)$/.test(w));
  if (substantiveWords.length >= 2) return `${latest} ${focusTerms} ${mode.termSuffixes.slice(0, 2).join(" ")}`.trim();
  return `${userTurns[0]?.content || ""} ${latest} ${focusTerms} ${mode.termSuffixes.slice(0, 2).join(" ")}`.trim();
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

function withCatalogFoundIntro(reply, liveResults, latestText) {
  if (!reply || !liveResults?.length) return reply;
  if (!sourceRequestIntent(latestText)) return reply;
  return { ...reply, message: "Here's what I found in ZSR's catalog. Open each record to confirm access, format, and fit." };
}

function catalogResultFocusedTurn(history, latestText, liveResults) {
  const userTurns = history.filter((m) => m.role === "user").length;
  if (userTurns <= 1 || !liveResults?.length) return false;
  const wantsSources = sourceRequestIntent(latestText);
  const wantsWhereToSearch = /\b(database|databases|resource|resources|where|starting point|guide|guides|search tool)\b/i.test(latestText);
  return wantsSources && !wantsWhereToSearch;
}

function prepareReply(reply, history, liveResults, latestText, responseStyle = DEFAULT_RESPONSE_STYLE_ID) {
  if (responseStyle === "answer" && !sourceRequestIntent(latestText)) return stripSourceHeavyFields(reply);
  const withIntro = withCatalogFoundIntro(reply, liveResults, latestText);
  if (!catalogResultFocusedTurn(history, latestText, liveResults)) return withIntro;
  const { starting_points, source_evaluation, academic_integrity_note, limitations, key_journals, database_strategy, suggested_followups, ...focused } = withIntro;
  return focused;
}

function sourceResultsFallback(liveResults, modeId = DEFAULT_MODE_ID) {
  if (!liveResults?.length) return null;
  const mode = getSearchMode(modeId);
  return {
    message: `Here's what I found in ZSR's catalog for ${mode.shortLabel.toLowerCase()} research. Open each record to confirm access, format, and fit.`,
    search_terms: [],
  };
}

function startingPoint(resources, id, why) {
  const resource = resources.find((r) => r.id === id);
  if (!resource) return null;
  return { resource_name: resource.name, url: resource.url, why };
}

function fallbackDatabaseStrategy(original, modeId = DEFAULT_MODE_ID) {
  const topic = String(original || "").toLowerCase();
  if (modeId === "scholarly" && topic.includes("social media") && /(adolescent|teen|youth)/.test(topic)) {
    return [
      {
        database: "PsycINFO",
        az_area: "Psychology",
        why: "Best first stop for psychology research on adolescent development, anxiety, depression, and well-being.",
        search_inside: ["subject terms for adolescents", "peer-reviewed filter", "age group filter"],
        journals_or_sources: ["Journal of Adolescent Health", "Developmental Psychology", "Journal of Youth and Adolescence"],
      },
      {
        database: "Communication & Mass Media Complete",
        az_area: "Communication / Media Studies",
        why: "Best for media-effects, platform-use, and online-behavior research.",
        search_inside: ["platform names", "media effects terms", "communication research subject terms"],
        journals_or_sources: ["New Media & Society", "Journal of Computer-Mediated Communication", "Social Media + Society"],
      },
      {
        database: "PubMed / MEDLINE",
        az_area: "Health Sciences / Medicine",
        why: "Useful for clinical, public-health, and adolescent-health studies tied to mental-health outcomes.",
        search_inside: ["adolescent filters", "MeSH-style health terms", "depression or anxiety outcomes"],
        journals_or_sources: ["JAMA Pediatrics", "Pediatrics", "Journal of Adolescent Health"],
      },
    ];
  }
  const mode = getSearchMode(modeId);
  return mode.recommended.slice(0, 3).map(([database, , bestFor]) => ({
    database,
    az_area: mode.label,
    why: bestFor,
    search_inside: mode.termStrategies.slice(0, 3),
    journals_or_sources: mode.termSuffixes.slice(0, 4),
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
      title: "Mechanism-focused angle",
      research_question: `What mechanism explains the relationship between ${topic} and the outcome I care about?`,
      why: "A mechanism gives the search concrete concepts instead of one broad topic phrase.",
      source_types: ["Peer-reviewed articles", "Theory/background sources"],
      search_terms: [`${topic} mechanism`, `${topic} effects`],
    },
    {
      title: "Population-focused angle",
      research_question: `How does ${topic} affect one specific population or community?`,
      why: "A population limit makes databases and filters much easier to use.",
      source_types: ["Scholarly articles", "Data/statistics"],
      search_terms: [`${topic} adolescents`, `${topic} college students`],
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
  const suggested_followups = ["Help me narrow this into a research question", "Suggest stronger search terms", "Help me evaluate sources I find"];

  if (topicOptionIntent(latest)) {
    return {
      message: "Here are researchable angles you could choose from. Pick the one that best matches the assignment, then use it to build search terms and choose databases.",
      topic_options: fallbackTopicOptions(original),
      suggested_followups: ["Turn one option into a research question", "Find ZSR databases for one option", "Build search terms for one option"],
    };
  }

  if (/peer|scholarly|article|journal/.test(latest)) {
    return {
      message: "Here's what I found: open the live catalog leads below first, then use the search terms if you need more results.",
      search_terms: [`"${original}" AND (${mode.termSuffixes.slice(0, 3).join(" OR ")})`, `${original} AND (${mode.termStrategies.slice(0, 3).join(" OR ")})`],
      suggested_followups,
    };
  }
  if (/narrow|focus|question|scope/.test(latest)) {
    return {
      message: "Narrow the topic by choosing one platform, one mental-health outcome, one age range, and a date range.",
      search_terms: ['Instagram AND adolescent* AND anxiety', 'TikTok AND teen* AND "body image"', '"social comparison" AND youth AND depression'],
      suggested_followups: ["Focus on one platform", "Focus on anxiety or depression", "Turn this into a research question"],
    };
  }
  if (/citat|cite|apa|mla|zotero|bibliograph/.test(latest)) {
    return {
      message: "For psychology, health, and communication topics, APA style is often the right starting point unless your instructor says otherwise.",
      starting_points: [startingPoint(resources, "citation-zotero", "Use this for citation style help and Zotero setup.")].filter(Boolean),
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
      message: "Use a psychology database, a communication database, and a health database so the topic is covered from more than one discipline.",
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
    search_terms: [original, `${original} ${mode.termSuffixes[0] || "research"}`, `${original} ${mode.termSuffixes[1] || "evidence"}`],
    suggested_followups,
  };
}

function resourceSummary(resources = []) {
  const byType = {};
  const missing = [];
  for (const resource of resources) {
    byType[resource.type || "unknown"] = (byType[resource.type || "unknown"] || 0) + 1;
    const missingFields = ["id", "name", "type", "url", "description", "access"].filter((field) => !resource[field]);
    if (missingFields.length) missing.push({ id: resource.id || resource.name || "(unnamed)", missingFields });
  }
  return {
    count: resources.length,
    byType,
    searchableTools: resources.filter((resource) => resource.search_url_template).length,
    paywalled: resources.filter((resource) => resource.paywalled).length,
    missing: missing.slice(0, 20),
  };
}

function envConfigured(name) {
  return Boolean(String(process.env[name] || "").trim());
}

function integrationStatus() {
  const primoRequest = buildPrimoRequest("test", DEFAULT_MODE_ID);
  return {
    gemini: { configured: envConfigured("GEMINI_API_KEY"), model: process.env.GEMINI_MODEL || "gemini-2.5-flash" },
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

function compactLines(items, render, limit = 6) {
  return (items || []).slice(0, limit).map(render).filter(Boolean).join("\n");
}

function handoffEmailBody({ topic, mode, responseStyle, subjectFocus, note, contact, searchTerms, liveResults, matchedResources, librarianRoutes }) {
  const terms = compactLines(searchTerms, (term) => `- ${term}`, 10);
  const results = compactLines(liveResults, (item) => `- ${item.title || "Untitled"}${item.type ? ` (${item.type})` : ""}${item.url ? `\n  ${item.url}` : ""}`, 8);
  const resources = compactLines(matchedResources, (item) => `- ${item.name || item.resource_name || item.id}${item.url ? `\n  ${item.url}` : ""}`, 8);
  const routes = compactLines(librarianRoutes, (item) => `- ${item.label || item.unit || "ZSR support"}${item.unit ? ` (${item.unit})` : ""}${item.reason ? `\n  ${item.reason}` : ""}${item.href ? `\n  ${item.href}` : ""}`, 3);
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

async function handleChat(req, res, stream = false) {
  const blocked = gate(req);
  if (blocked) return sendJson(res, blocked.status, blocked.payload);
  const body = await readJson(req);
  const parsed = parseChatRequest(body);
  if (parsed.error) return sendJson(res, 400, { error: parsed.error });
  const { history, studentText, last, mode, responseStyle, subjectFocusId } = parsed;

  const screen = screenMessage(last.content);
  if (screen.block) {
    logQuery({ topic: last.content.trim(), matchedIds: [], blocked: true });
    if (!stream) return sendJson(res, 200, { reply: blockedReply(screen.message), matchedResources: [] });
    sendNdjsonHead(res);
    writeNdjson(res, { type: "delta", message: screen.message });
    writeNdjson(res, { type: "done", reply: blockedReply(screen.message), matchedResources: [] });
    return res.end();
  }

  let resources = [];
  let primoPromise = Promise.resolve([]);
  try {
    resources = await retrieveResources(studentText, 6, mode, subjectFocusId);
    const shouldLookupCatalog = responseStyle !== "answer" || sourceRequestIntent(last.content);
    primoPromise = shouldLookupCatalog ? searchPrimo(catalogSearchText(history, studentText, mode, subjectFocusId), 10, mode) : Promise.resolve([]);

    if (!stream) {
      const rawReply = await generateChatResponse(history, resources, mode, responseStyle, subjectFocusId);
      const liveResults = await primoPromise;
      const { reply: validatedReply } = validateReply(rawReply, resources);
      const reply = prepareReply(validatedReply, history, liveResults, last.content, responseStyle);
      logQuery({ topic: last.content.trim(), matchedIds: resources.map((r) => r.id) });
      return sendJson(res, 200, { reply, matchedResources: resources, searchTools: await getSearchTools(), liveResults });
    }

    sendNdjsonHead(res);
    const write = (obj) => writeNdjson(res, obj);
    const rawReply = await streamChatResponse(history, resources, (message) => write({ type: "delta", message }), mode, responseStyle, subjectFocusId);
    const liveResults = await primoPromise;
    const { reply: validatedReply } = validateReply(rawReply, resources);
    const reply = prepareReply(validatedReply, history, liveResults, last.content, responseStyle);
    logQuery({ topic: last.content.trim(), matchedIds: resources.map((r) => r.id) });
    write({ type: "done", reply, matchedResources: resources, searchTools: await getSearchTools(), liveResults });
    return res.end();
  } catch (err) {
    const fallback = followupFallback(history, resources, mode);
    const liveResults = await primoPromise.catch(() => []);
    const reply = fallback || sourceResultsFallback(liveResults, mode);
    if (reply) {
      const payload = { reply: prepareReply(reply, history, liveResults, last.content, responseStyle), matchedResources: resources, searchTools: await getSearchTools(), liveResults };
      if (!stream) return sendJson(res, 200, payload);
      writeNdjson(res, { type: "done", ...payload });
      return res.end();
    }
    const msg = err.code === "NO_API_KEY"
      ? "The server is missing a Gemini API key. Add GEMINI_API_KEY to your .env file (see .env.example)."
      : "Could not generate a reply right now. Please try again.";
    if (!stream) return sendJson(res, err.code === "NO_API_KEY" ? 503 : 502, { error: msg });
    if (!res.headersSent) sendNdjsonHead(res, 502);
    writeNdjson(res, { type: "error", error: msg });
    return res.end();
  }
}

async function handleApi(req, res, path) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    return res.end();
  }

  if (req.method === "GET" && path === "/api/health") {
    const resources = await loadResources();
    return sendJson(res, 200, { ok: true, resourceCount: resources.length });
  }
  if (req.method === "GET" && path === "/api/pilot/status") return sendJson(res, 200, await pilotStatusPayload());
  if (req.method === "GET" && path === "/api/admin/summary") {
    const [status, feedback, handoffs, querySummary] = await Promise.all([pilotStatusPayload(), readFeedback(100), readHandoffs(50), readQuerySummary(200)]);
    const feedbackCounts = feedback.reduce((counts, item) => {
      counts[item.rating] = (counts[item.rating] || 0) + 1;
      return counts;
    }, {});
    return sendJson(res, 200, {
      ...status,
      feedback: { counts: feedbackCounts, recent: feedback.slice(0, 25) },
      handoffs: { totalRecent: handoffs.length, recent: handoffs.slice(0, 25) },
      querySummary,
    });
  }
  if (req.method === "GET" && path === "/api/feedback") return sendJson(res, 200, { feedback: await readFeedback() });
  if (req.method === "POST" && path === "/api/feedback") {
    const { rating, note, topic } = await readJson(req);
    if (!["up", "down", "gap"].includes(rating)) return sendJson(res, 400, { error: "Invalid rating." });
    await logFeedback({ rating, note: String(note || "").slice(0, 1000), topic: String(topic || "").slice(0, 2000) });
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === "POST" && path === "/api/handoff") {
    const body = await readJson(req);
    const payload = {
      topic: String(body.topic || "").slice(0, 2000),
      mode: String(body.mode || "").slice(0, 80),
      responseStyle: String(body.responseStyle || "").slice(0, 80),
      subjectFocus: String(body.subjectFocus || "").slice(0, 120),
      note: String(body.note || "").slice(0, 1000),
      contact: String(body.contact || "").slice(0, 300),
      searchTerms: Array.isArray(body.searchTerms) ? body.searchTerms : [],
      liveResults: Array.isArray(body.liveResults) ? body.liveResults : [],
      matchedResources: Array.isArray(body.matchedResources) ? body.matchedResources : [],
      librarianRoutes: Array.isArray(body.librarianRoutes) ? body.librarianRoutes : [],
    };
    if (!payload.topic.trim()) return sendJson(res, 400, { error: "A topic is required for librarian handoff." });
    await logHandoff(payload);
    const subject = `Research help request: ${payload.topic.slice(0, 80)}`;
    const bodyText = handoffEmailBody(payload);
    return sendJson(res, 200, {
      ok: true,
      askEmail: ASK_ZSR_EMAIL,
      mailto: `mailto:${ASK_ZSR_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`,
      body: bodyText,
    });
  }
  if (req.method === "POST" && path === "/api/chat") return handleChat(req, res, false);
  if (req.method === "POST" && path === "/api/chat/stream") return handleChat(req, res, true);

  return sendJson(res, 404, { error: "Not found." });
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function serveStatic(res, pathname) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidate = safePath === "/" ? join(DIST_DIR, "index.html") : join(DIST_DIR, safePath);
  const filePath = existsSync(candidate) && (await stat(candidate)).isFile() ? candidate : join(DIST_DIR, "index.html");
  const type = mime[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  createReadStream(filePath).pipe(res);
}

export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url.pathname);
    return await serveStatic(res, url.pathname);
  } catch (err) {
    console.error("[native]", err.message);
    if (res.writableEnded) return;
    if (res.headersSent) return res.end();
    return sendJson(res, 500, { error: "Internal server error." });
  }
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, HOST, () => {
    console.log(`ZSR Research Navigator listening on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  });
}
