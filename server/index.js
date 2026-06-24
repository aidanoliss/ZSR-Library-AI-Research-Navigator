import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

import { retrieveResources, loadResources, getSearchTools } from "./retrieve.js";
import { generateChatResponse, streamChatResponse } from "./gemini.js";
import { validateReply } from "./validate.js";
import { logQuery, logFeedback, readFeedback } from "./log.js";
import { rateLimit } from "./ratelimit.js";
import { screenMessage, blockedReply } from "./screen.js";
import { searchPrimo } from "./primo.js";
import { ventureRouter } from "./venture.js";
import {
  DEFAULT_MODE_ID,
  DEFAULT_RESPONSE_STYLE_ID,
  getResponseStyle,
  getSearchMode,
} from "../config/libraryLinks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

export const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/venture", ventureRouter);

// Health + visibility into what the curated file currently holds.
app.get("/api/health", async (_req, res) => {
  const resources = await loadResources();
  res.json({ ok: true, resourceCount: resources.length });
});

/**
 * Validate + normalize an incoming chat request body.
 * Returns { error } on bad input, or { history, studentText, last, mode, responseStyle } on success.
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

  const history = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .map((m) => ({ role: m.role, content: String(m.content).trim() }));

  const studentText = history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  const mode = getSearchMode(body?.mode || DEFAULT_MODE_ID).id;
  const responseStyle = getResponseStyle(body?.responseStyle || DEFAULT_RESPONSE_STYLE_ID).id;
  return { history, studentText, last, mode, responseStyle };
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

function catalogSearchText(history, studentText, modeId = DEFAULT_MODE_ID) {
  const mode = getSearchMode(modeId);
  const userTurns = history.filter((m) => m.role === "user");
  const latest = userTurns[userTurns.length - 1]?.content || "";
  if (userTurns.length <= 1) return `${studentText} ${mode.termSuffixes.slice(0, 2).join(" ")}`.trim();

  // If the follow-up contains its own searchable concepts, let the catalog
  // search that directly. Otherwise keep the first topic as context.
  const substantiveWords = latest
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^(find|show|give|provide|article|articles|source|sources|about|with|help|peer|reviewed|scholarly)$/.test(w));
  if (substantiveWords.length >= 2) return `${latest} ${mode.termSuffixes.slice(0, 2).join(" ")}`.trim();
  return `${userTurns[0]?.content || ""} ${latest} ${mode.termSuffixes.slice(0, 2).join(" ")}`.trim();
}

function withCatalogFoundIntro(reply, liveResults, latestText) {
  if (!reply || !liveResults?.length) return reply;
  if (!/\b(find|show|get|give|provide|article|articles|source|sources|results)\b/i.test(latestText)) {
    return reply;
  }
  return {
    ...reply,
    message:
      "Here's what I found in ZSR's catalog. Open each record to confirm access, format, and fit.",
  };
}

function sourceRequestIntent(text) {
  return /\b(find|show|get|give|provide|articles?|books?|sources?|evidence|results?|database|databases|catalog|journal|journals|citation|cite|search terms?|keywords?|pdf|full[-\s]?text)\b/i.test(
    String(text || "")
  );
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
  const wantsSources = /\b(find|show|get|give|provide|articles?|books?|sources?|results)\b/i.test(latestText);
  const wantsWhereToSearch = /\b(database|databases|resource|resources|where|starting point|guide|guides|search tool)\b/i.test(latestText);
  return wantsSources && !wantsWhereToSearch;
}

function prepareReply(reply, history, liveResults, latestText, responseStyle = DEFAULT_RESPONSE_STYLE_ID) {
  if (responseStyle === "answer" && !sourceRequestIntent(latestText)) {
    return stripSourceHeavyFields(reply);
  }
  const withIntro = withCatalogFoundIntro(reply, liveResults, latestText);
  if (!catalogResultFocusedTurn(history, latestText, liveResults)) return withIntro;

  const {
    starting_points,
    source_evaluation,
    academic_integrity_note,
    limitations,
    key_journals,
    database_strategy,
    suggested_followups,
    ...focused
  } = withIntro;
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
  const topic = String(original || "").toLowerCase();
  if (
    modeId === "scholarly" &&
    topic.includes("social media") &&
    /(adolescent|teen|youth)/.test(topic)
  ) {
    return [
      {
        database: "PsycINFO",
        az_area: "Psychology",
        why: "Best first stop for psychology research on adolescent development, anxiety, depression, and well-being.",
        search_inside: ["subject terms for adolescents", "peer-reviewed filter", "age group filter", "methodology or empirical study filters"],
        journals_or_sources: ["Journal of Adolescent Health", "Developmental Psychology", "Journal of Youth and Adolescence", "Clinical Psychological Science"],
      },
      {
        database: "Communication & Mass Media Complete",
        az_area: "Communication / Media Studies",
        why: "Best for media-effects, platform-use, and online-behavior research.",
        search_inside: ["platform names such as TikTok or Instagram", "media effects terms", "audience studies", "communication research subject terms"],
        journals_or_sources: ["New Media & Society", "Journal of Computer-Mediated Communication", "Social Media + Society", "Communication Research"],
      },
      {
        database: "PubMed / MEDLINE",
        az_area: "Health Sciences / Medicine",
        why: "Useful for clinical, public-health, and adolescent-health studies tied to mental-health outcomes.",
        search_inside: ["adolescent filters", "MeSH-style health terms", "depression or anxiety outcomes", "systematic review filter"],
        journals_or_sources: ["JAMA Pediatrics", "Pediatrics", "Journal of Adolescent Health", "JAMA Psychiatry"],
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

  if (/peer|scholarly|article|journal/.test(latest)) {
    return {
      message:
        "Here's what I found: open the live catalog leads below first, then use the search terms if you need more results.",
      search_terms: [
        `"${original}" AND (${mode.termSuffixes.slice(0, 3).join(" OR ")})`,
        `${original} AND (${mode.termStrategies.slice(0, 3).join(" OR ")})`,
      ],
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
    search_terms: [
      original,
      `${original} ${mode.termSuffixes[0] || "research"}`,
      `${original} ${mode.termSuffixes[1] || "evidence"}`,
    ],
    suggested_followups,
  };
}

// Buffered endpoint: full conversation in, complete structured reply out.
app.post("/api/chat", async (req, res) => {
  if (gate(req, res)) return;
  const parsed = parseChatRequest(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { history, studentText, last, mode, responseStyle } = parsed;

  // Relevance / abuse screen — redirect clear-cut cases without a model call.
  const screen = screenMessage(last.content);
  if (screen.block) {
    logQuery({ topic: last.content.trim(), matchedIds: [], blocked: true });
    return res.json({ reply: blockedReply(screen.message), matchedResources: [] });
  }

  let resources = [];
  let primoPromise = Promise.resolve([]);
  try {
    resources = await retrieveResources(studentText, 6, mode);
    // Run the AI plan and the live ZSR catalog lookup in parallel.
    const shouldLookupCatalog = responseStyle !== "answer" || sourceRequestIntent(last.content);
    primoPromise = shouldLookupCatalog
      ? searchPrimo(catalogSearchText(history, studentText, mode), 10, mode)
      : Promise.resolve([]);
    const rawReply = await generateChatResponse(history, resources, mode, responseStyle);
    const liveResults = await primoPromise;

    const { reply: validatedReply, report } = validateReply(rawReply, resources);
    const reply = prepareReply(validatedReply, history, liveResults, last.content, responseStyle);
    if (report.dropped.length || report.corrected.length) {
      console.warn("[/api/chat] link guard:", JSON.stringify(report));
    }
    logQuery({ topic: last.content.trim(), matchedIds: resources.map((r) => r.id) });

    res.json({ reply, matchedResources: resources, searchTools: await getSearchTools(), liveResults });
  } catch (err) {
    console.error("[/api/chat]", err.message);
    const fallback = followupFallback(history, resources, mode);
    if (fallback) {
      const liveResults = await primoPromise.catch(() => []);
      return res.json({
        reply: prepareReply(fallback, history, liveResults, last.content, responseStyle),
        matchedResources: resources,
        searchTools: await getSearchTools(),
        liveResults,
      });
    }
    const liveResults = await primoPromise.catch(() => []);
    const sourceFallback = sourceResultsFallback(liveResults, mode);
    if (sourceFallback) {
      return res.json({
        reply: prepareReply(sourceFallback, history, liveResults, last.content, responseStyle),
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
  const { history, studentText, last, mode, responseStyle } = parsed;

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
    resources = await retrieveResources(studentText, 6, mode);
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
    const shouldLookupCatalog = responseStyle !== "answer" || sourceRequestIntent(last.content);
    primoPromise = shouldLookupCatalog
      ? searchPrimo(catalogSearchText(history, studentText, mode), 10, mode)
      : Promise.resolve([]); // in parallel with streaming
    const rawReply = await streamChatResponse(
      history,
      resources,
      (message) => write({ type: "delta", message }),
      mode,
      responseStyle
    );

    const liveResults = await primoPromise;
    const { reply: validatedReply, report } = validateReply(rawReply, resources);
    const reply = prepareReply(validatedReply, history, liveResults, last.content, responseStyle);
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
    const fallback = followupFallback(history, resources, mode);
    if (fallback) {
      const liveResults = await primoPromise.catch(() => []);
      write({
        type: "done",
        reply: prepareReply(fallback, history, liveResults, last.content, responseStyle),
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
        reply: prepareReply(sourceFallback, history, liveResults, last.content, responseStyle),
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
