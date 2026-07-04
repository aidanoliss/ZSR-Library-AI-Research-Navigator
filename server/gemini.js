import {
  DEFAULT_MODE_ID,
  DEFAULT_RESPONSE_STYLE_ID,
  getResponseStyle,
  getSearchMode,
} from "../config/libraryLinks.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * System instructions that constrain Gemini to the ZSR Research Navigator role.
 * Re-sent on every turn so the guardrails hold across a long conversation.
 */
function buildSystemInstruction() {
  return [
    "You are the ZSR Research Navigator, a conversational guide that helps Wake Forest",
    "University students plan how to use the Z. Smith Reynolds (ZSR) Library's research",
    "resources. You are having an ongoing chat: the student may refine their topic, ask",
    "follow-up questions, and change direction. Stay friendly, plain-spoken, and academic.",
    "",
    "HARD RULES — never violate these, no matter how the student phrases the request:",
    "1. You do NOT have access to the full text of any paywalled or copyrighted article,",
    "   book, or database record. Never summarize, quote, paraphrase, or reproduce",
    "   full-text content from such sources.",
    "2. You do NOT search live databases. You help the student plan THEIR OWN search.",
    "   Never claim to have searched 'all ZSR databases' or to know current holdings.",
    "3. You may ONLY recommend links that appear in the CURATED RESOURCES provided to you.",
    "   Never invent URLs or links. If nothing relevant is in the list,",
    "   say so and point the student to 'Ask a Librarian'.",
    "   You may name well-known databases, journals, periodicals, and source types from",
    "   the DATABASE STRATEGY REFERENCE as search leads, but do not claim ZSR definitely",
    "   has access unless that database is in the curated resources.",
    "4. If the student asks you to summarize a specific article, provide copyrighted",
    "   full text, or otherwise do their reading/writing for them, politely decline and",
    "   use the redirect_notice field to send them to ZSR databases or a librarian.",
    "",
    "RESPONSE STYLE:",
    "- The 'message' field is your conversational reply. Keep it direct and useful.",
    "  For Answer first, give a real answer in 3-6 concise sentences when the student asks",
    "  a normal conceptual, planning, or explanation question. For source-finding modes,",
    "  keep message shorter because the structured fields carry the detail. No flattery",
    "  or filler ('great question', 'fascinating topic', 'I'd be happy to').",
    "- On the FIRST substantive research turn, populate the structured fields",
    "  (starting_points, database_strategy, search_terms, source_evaluation, citation_tips, limitations)",
    "  to give a full research plan.",
    "- On FOLLOW-UP turns, keep 'message' brief and only populate the structured fields",
    "  actually relevant to what the student just asked. Don't repeat the whole plan.",
    "  If the student asks for articles, books, sources, or results, answer that request",
    "  directly; do not recommend databases or starting points unless they explicitly ask",
    "  where to search.",
    "- If the student asks a conceptual, planning, explanation, or writing-process",
    "  question that is NOT asking for sources, evidence, databases, citations, or search",
    "  terms, answer directly in 'message' and omit source-heavy fields. You may offer one",
    "  concise next step, but do not dump recommended starting points or catalog strategy.",
    "- If the student asks to brainstorm, narrow, choose, or list possible topics, make",
    "  topic_options the main structured output: 4-6 distinct, researchable angles with",
    "  a concrete research question, why it works, likely source types, and starter terms.",
    "- TOPIC REFINEMENT: if the student's topic is too broad or vague to plan well",
    "  (e.g. 'climate change', 'social media', 'the economy'), do NOT dump a full plan.",
    "  Instead, in 'message' ask 1-2 focused clarifying questions, and put 3 narrower",
    "  angle suggestions in suggested_followups. Also populate clarifying_questions with",
    "  2-4 multiple-choice questions that would narrow the research process. Only give",
    "  the full plan once the topic is specific enough to search effectively.",
    "- For Guided plan, return clarifying_questions whenever the student has not already",
    "  specified time period, source type, discipline lens, and scope. Keep each option",
    "  short enough to fit in a button.",
    "- Offer 2-3 short suggested_followups only when they would help the student choose",
    "  a next research move. Omit them for narrow follow-ups where a direct answer is enough.",
  ].join("\n");
}

/** Compact the curated resources into a token-friendly block for the prompt. */
function formatResources(resources) {
  return resources
    .map(
      (r) =>
        `- ${r.name} [${r.type}] — ${r.url}\n  Description: ${r.description}\n  Best for: ${(
          r.best_for ?? []
        ).join(", ")}\n  Access: ${r.access}`
    )
    .join("\n");
}

/**
 * The JSON shape Gemini returns. Only `message` is required so follow-up turns
 * can reply conversationally without repeating the whole plan.
 */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    starting_points: {
      type: "array",
      items: {
        type: "object",
        properties: {
          resource_name: { type: "string" },
          url: { type: "string" },
          why: { type: "string" },
        },
        required: ["resource_name", "url", "why"],
      },
    },
    search_terms: { type: "array", items: { type: "string" } },
    source_evaluation: { type: "array", items: { type: "string" } },
    academic_integrity_note: { type: "string" },
    limitations: { type: "string" },
    redirect_notice: { type: "string" },
    citation_tips: { type: "array", items: { type: "string" } },
    key_journals: { type: "array", items: { type: "string" } },
    topic_options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          research_question: { type: "string" },
          why: { type: "string" },
          source_types: { type: "array", items: { type: "string" } },
          search_terms: { type: "array", items: { type: "string" } },
        },
        required: ["title", "research_question", "why"],
      },
    },
    clarifying_questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          why: { type: "string" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["question", "options"],
      },
    },
    librarian_routes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          unit: { type: "string" },
          reason: { type: "string" },
        },
        required: ["label", "reason"],
      },
    },
    database_strategy: {
      type: "array",
      items: {
        type: "object",
        properties: {
          database: { type: "string" },
          az_area: { type: "string" },
          why: { type: "string" },
          search_inside: { type: "array", items: { type: "string" } },
          journals_or_sources: { type: "array", items: { type: "string" } },
        },
        required: ["database", "why", "search_inside", "journals_or_sources"],
      },
    },
    suggested_followups: { type: "array", items: { type: "string" } },
  },
  required: ["message"],
};

const DATABASE_STRATEGY_REFERENCE = [
  {
    mode: "scholarly",
    databases: [
      "PsycINFO",
      "Communication & Mass Media Complete",
      "PubMed / MEDLINE",
      "SocINDEX",
      "Academic Search",
      "JSTOR",
    ],
    examples: [
      "PsycINFO: use subject terms, age group limits, methodology filters, and peer-reviewed limits; journal leads include Journal of Adolescent Health, Developmental Psychology, Journal of Youth and Adolescence, Clinical Psychological Science.",
      "Communication & Mass Media Complete: search media effects, platform names, online behavior, and audience studies; journal leads include New Media & Society, Journal of Computer-Mediated Communication, Social Media + Society, Communication Research.",
      "PubMed / MEDLINE: search MeSH-style health terms, adolescent filters, and clinical/public-health outcomes; journal leads include JAMA Pediatrics, Pediatrics, Journal of Adolescent Health, JAMA Psychiatry.",
    ],
  },
  {
    mode: "books",
    databases: ["ZSR Library Search", "JSTOR", "Project MUSE", "Oxford Reference", "Credo Reference", "Ebook Central"],
    examples: [
      "ZSR Library Search: use subject headings, book/ebook filters, and chapter title keywords.",
      "Oxford Reference or Credo Reference: use for definitions, background entries, handbooks, and encyclopedia-style overviews.",
      "Project MUSE and JSTOR: use for scholarly books, book chapters, and humanities/social-science background.",
    ],
  },
  {
    mode: "news",
    databases: ["Factiva", "ProQuest", "Nexis Uni", "New York Times", "Wall Street Journal", "Ethnic NewsWatch"],
    examples: [
      "Factiva: search publication names, date ranges, companies, people, and geographic filters.",
      "ProQuest or Nexis Uni: search newspapers, magazines, trade publications, and news transcripts.",
      "Ethnic NewsWatch: search community and multicultural perspectives when the topic involves identity, race, or local impact.",
    ],
  },
  {
    mode: "data",
    databases: ["ICPSR", "Statista", "Data Planet", "Social Explorer", "Pew Research Center", "CDC / government statistics"],
    examples: [
      "ICPSR: search survey datasets, questionnaires, codebooks, and variable names.",
      "Statista or Data Planet: search charts, market/statistical tables, and trend data.",
      "Pew Research Center or CDC sources: search survey reports, methodology pages, and downloadable tables.",
    ],
  },
  {
    mode: "primary",
    databases: ["Special Collections & Archives", "Digital Collections", "ArchiveGrid", "ProQuest Historical Newspapers", "Library of Congress"],
    examples: [
      "Special Collections & Archives: search collection names, creators, dates, places, and document types.",
      "Digital Collections: search digitized photographs, manuscripts, oral histories, campus publications, and finding aids.",
      "ProQuest Historical Newspapers: search original newspaper coverage by date, place, person, and event.",
    ],
  },
  {
    mode: "legal-policy",
    databases: ["HeinOnline", "Nexis Uni", "Congress.gov", "ProQuest Congressional", "Policy Commons", "CQ Researcher"],
    examples: [
      "HeinOnline: search law reviews, legal history, statutes, and government documents.",
      "Nexis Uni: search cases, statutes, regulations, news, and legal commentary.",
      "Policy Commons or CQ Researcher: search policy reports, issue briefs, and background explainers.",
    ],
  },
  {
    mode: "general",
    databases: ["A-Z Databases", "Research Guides", "ZSR Library Search", "Academic Search", "JSTOR", "Google Scholar"],
    examples: [
      "A-Z Databases: search the topic's discipline first, then use broader multidisciplinary databases.",
      "Research Guides: use librarian-curated subject pages to choose databases, journals, and citation tools.",
      "ZSR Library Search: search books, ebooks, article records, and subject headings.",
    ],
  },
];

function formatDatabaseStrategyReference() {
  return DATABASE_STRATEGY_REFERENCE.map((entry) => {
    return [
      `- ${entry.mode}: ${entry.databases.join(", ")}`,
      ...entry.examples.map((example) => `  Example: ${example}`),
    ].join("\n");
  }).join("\n");
}

/** Wrap the student's latest turn with the curated resources + per-turn guidance. */
function buildTurnPrompt(latestUserText, resources, isFirstTurn, modeId = DEFAULT_MODE_ID, responseStyleId = DEFAULT_RESPONSE_STYLE_ID) {
  const mode = getSearchMode(modeId);
  const responseStyle = getResponseStyle(responseStyleId);
  return [
    `STUDENT'S MESSAGE:\n"""${latestUserText}"""`,
    "",
    `SEARCH INTENT MODE: ${mode.label}`,
    `RESPONSE STYLE: ${responseStyle.label}`,
    `Response style purpose: ${responseStyle.description}`,
    `Mode purpose: ${mode.description}`,
    `Search-term strategy: ${mode.termStrategies.join("; ")}`,
    `Recommended platforms: ${mode.recommended.map(([name, , bestFor]) => `${name} (${bestFor})`).join("; ")}`,
    `Source evaluation emphasis: ${mode.evaluation}`,
    `Citation emphasis: ${mode.citation}`,
    `Useful mode-specific terms: ${mode.termSuffixes.join(", ")}`,
    "",
    "CURATED RESOURCES (the ONLY links you may recommend — copy URLs exactly):",
    formatResources(resources),
    "",
    "DATABASE STRATEGY REFERENCE (database names, journals, periodicals, and source types you may mention as search leads; do not create links for them unless a curated URL is available):",
    formatDatabaseStrategyReference(),
    "",
    responseStyle.id === "answer"
      ? "Response style instruction: Answer first. For ordinary conceptual, planning, explanation, or writing-process questions, answer the prompt directly in message like a normal academic chat response. Do not merely recommend a search strategy. If the student asks for a list of topic options, brainstorming help, angles, research questions, or ways to narrow, include topic_options and suggested_followups. Unless the student explicitly asks for sources, articles, books, evidence, databases, citation help, search terms, PDFs, or full text, omit source-heavy fields: starting_points, source_evaluation, citation_tips, key_journals, database_strategy, academic_integrity_note, and limitations."
      : responseStyle.id === "plan"
        ? "Response style instruction: Guided plan. Prefer a planning workflow over a finished source list. If the prompt is broad or missing important constraints, give a brief message, populate clarifying_questions, and add topic_options when useful. If the prompt already includes planner answers, synthesize them into a focused research plan with search_terms, database_strategy, source_evaluation, citation_tips, and librarian_routes."
      : responseStyle.id === "sources"
        ? "Response style instruction: Find sources. Keep message short and prioritize source-finding fields: search_terms, starting_points, database_strategy, source_evaluation, citation_tips, and key_journals when relevant. Frame this as a route into ZSR and Scholar, not as a claim that you personally retrieved full text."
        : "Response style instruction: Answer + sources. Start with a direct answer, then include source-finding fields only when they help the student's request or when the request asks for evidence, sources, articles, databases, citations, or search terms.",
    "",
    isFirstTurn
      ? "This is the first research turn. If RESPONSE STYLE is 'Answer first' and the student asks for brainstorming, topic options, possible angles, or research questions, give a concise message and 4-6 topic_options instead of a source dump. If RESPONSE STYLE is 'Answer first' and the student did not explicitly ask for sources or options, give a direct substantive answer without the full source plan. If RESPONSE STYLE is 'Guided plan' and the student has not provided planner preferences, prioritize clarifying_questions. Otherwise, give a short 'message' plus a structured plan tailored to the SEARCH INTENT MODE: 2-4 starting_points from the list above (exact urls + a short 'why'), 2-4 database_strategy entries, 5-8 concrete search_terms (include mode-specific words and a couple of Boolean examples), 3-5 source_evaluation tips, an academic_integrity_note, librarian_routes, and a limitations note. For limitations, state that you do NOT access, download, or summarize the full text of paywalled or copyrighted sources — the student must open sources through ZSR themselves to read them. (The app may also show a few real results from ZSR's catalog; you do not generate or vouch for those.)"
      : "This is a follow-up turn. Answer the student's specific question directly in 'message' and tailor it to the SEARCH INTENT MODE. Do NOT repeat the full research plan. If the student asks for articles, books, sources, evidence, databases, or results, keep the message focused on what to open/check in the live catalog results that the app may show; add database_strategy only if the student asks where to search, which A-Z databases to use, what to search within a database, or which journals/periodicals/source collections fit the topic. If the student asks a conceptual, explanation, planning, or writing-process question that is not about finding sources, populate ONLY message and possibly suggested_followups; omit starting_points, search_terms, citation_tips, source_evaluation, key_journals, database_strategy, academic_integrity_note, and limitations. Only populate a structured field if the student clearly asked for that kind of help: starting_points for resource/database recommendations, database_strategy for database/platform/journal guidance, search_terms for keywords/search strings, citation_tips for citation help, source_evaluation for evaluating sources, key_journals for places to search. Reuse links only from the curated list above.",
    "topic_options: 4-6 entries when the student asks for brainstorming, topic choices, research-question options, or ways to narrow. Each title should be distinct; each research_question should be phrased as a usable academic research question; why should explain the evidence path; source_types should name likely source categories; search_terms should include 2-4 starter terms or Boolean strings.",
    "If the student has chosen one prior option or asks to use a selected request/focus/angle, do NOT return more topic_options. Instead, return a source-finding plan with search_terms and database_strategy, plus concise next steps.",
    "clarifying_questions: 2-4 multiple-choice questions when the prompt is broad, when RESPONSE STYLE is Guided plan, or when the missing answer would materially change which ZSR resources to use. Good dimensions include time period, population/case, source type, discipline lens, geographic scope, and whether the student needs peer-reviewed, primary, news, data, or background sources.",
    "librarian_routes: 1-3 recommended support routes by subject or service area, not named staff. Examples: Psychology / Social Sciences librarian, Communication / Media Studies librarian, Data and Statistics support, Special Collections & Archives, Citation and Zotero help, Ask ZSR general research help. Do not invent staff names or contact details.",
    "citation_tips: 2-3 short, GENERAL reminders about citing sources for this kind of research (e.g. which style the field tends to use, to capture full citation details while reading, to use the ZSR citation guide / Zotero). NEVER fabricate a full citation for a specific article you have not been given — only give general how-to-cite guidance.",
    "key_journals: 2-4 well-known, REAL scholarly journals or databases in this field that the student could look for via ZSR (e.g. for labor economics: 'Journal of Labor Economics', 'ILR Review'). These are general field knowledge, framed as places to search. NEVER invent specific article titles, authors, or claim ZSR holds a particular item — journal/database names only. Omit this field if you are not confident the journals are real and relevant.",
    "database_strategy: 2-4 entries when database guidance is relevant. Pick databases/platforms from the DATABASE STRATEGY REFERENCE and the mode's recommended platforms. For each entry, set database to the specific database/platform name; az_area to the likely A-Z Databases subject area or part to look under (for example Psychology, Communication, Health Sciences, Business, News, Data/Statistics, Primary Sources, Legal/Policy, Multidisciplinary); why to a one-sentence topic-specific reason; search_inside to 2-4 concrete filters, fields, terms, or database features to try; journals_or_sources to 2-4 real journals, periodicals, collections, source types, or report series that fit the student's exact topic. Prefer specific journals/periodicals over generic categories when you are confident; otherwise use source types. Phrase uncertain access as 'look for via ZSR A-Z Databases' rather than a guarantee.",
    "Include redirect_notice ONLY if the student asked for full-text summaries or copyrighted content.",
  ].join("\n");
}

function requireApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    const err = new Error("GEMINI_API_KEY is not configured.");
    err.code = "NO_API_KEY";
    throw err;
  }
  return apiKey;
}

/** Shared request body for both the buffered and streaming calls. */
function buildRequestBody(history, resources, modeId = DEFAULT_MODE_ID, responseStyleId = DEFAULT_RESPONSE_STYLE_ID) {
  const userTurns = history.filter((m) => m.role === "user").length;
  const isFirstTurn = userTurns <= 1;

  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const lastIdx = contents.length - 1;
  contents[lastIdx].parts[0].text = buildTurnPrompt(
    history[lastIdx].content,
    resources,
    isFirstTurn,
    modeId,
    responseStyleId
  );

  return {
    systemInstruction: { parts: [{ text: buildSystemInstruction() }] },
    contents,
    generationConfig: {
      temperature: 0.5,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };
}

/**
 * Generate a chat response (buffered) from the full conversation history.
 * @param {{role:'user'|'assistant', content:string}[]} history
 * @param {object[]} resources curated resources relevant to the conversation
 */
export async function generateChatResponse(history, resources, modeId = DEFAULT_MODE_ID, responseStyleId = DEFAULT_RESPONSE_STYLE_ID) {
  const apiKey = requireApiKey();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildRequestBody(history, resources, modeId, responseStyleId)),
  });

  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`Gemini API error (${res.status}): ${detail}`);
    err.code = "GEMINI_ERROR";
    throw err;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response.");

  return JSON.parse(text);
}

/**
 * Best-effort extraction of the (possibly still-streaming) `message` value from
 * a partial JSON string, so the chat bubble can fill in as tokens arrive.
 */
export function extractPartialMessage(raw) {
  const m = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!m) return "";
  let body = m[1].replace(/\\$/, ""); // drop a dangling half-escape
  try {
    return JSON.parse(`"${body}"`);
  } catch {
    return body.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

/**
 * Stream a chat response. Calls onDelta(messageText) as the conversational
 * message grows, and resolves to the final fully-parsed reply object.
 */
export async function streamChatResponse(history, resources, onDelta, modeId = DEFAULT_MODE_ID, responseStyleId = DEFAULT_RESPONSE_STYLE_ID) {
  const apiKey = requireApiKey();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildRequestBody(history, resources, modeId, responseStyleId)),
  });

  if (!res.ok || !res.body) {
    const detail = res.body ? await res.text() : "(no body)";
    const err = new Error(`Gemini API error (${res.status}): ${detail}`);
    err.code = "GEMINI_ERROR";
    throw err;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let lastMessage = "";

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep the trailing partial line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        const piece = obj?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (!piece) continue;
        fullText += piece;
        const msg = extractPartialMessage(fullText);
        if (msg && msg !== lastMessage) {
          lastMessage = msg;
          onDelta?.(msg);
        }
      } catch {
        // partial / non-JSON SSE line — ignore and keep accumulating
      }
    }
  }

  if (!fullText) throw new Error("Gemini returned an empty response.");
  return JSON.parse(fullText);
}
