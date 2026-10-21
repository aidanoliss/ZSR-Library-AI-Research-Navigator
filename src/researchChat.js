import { withNavigatorAttribution } from "../config/navigatorAttribution.js";

const text = (value, limit = 2000) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, limit) : "";
export const CHAT_SOURCE_LIMIT = 6;
export const CHAT_TURN_LIMIT = 24;

export function proposedChatSearchQuestion(block = {}) {
  const proposal = text(block?.text, 2000).match(/^Question to explore:\s*([\s\S]+)/i)?.[1]?.trim();
  return proposal && !/(?:https?:\/\/|www\.|<[^>]*>)/i.test(proposal) ? proposal : "";
}
export function chatSourceHasAbstract(source = {}) { return source?.researchChatScope === "abstract"; }

export function safeChatSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
}

export function safeChatSupportUrl(value) {
  const url = safeChatSourceUrl(value);
  if (!url) return "";
  const host = new URL(url).hostname.toLowerCase();
  return host === "zsr.wfu.edu" || host.endsWith(".zsr.wfu.edu") || host === "wfu.primo.exlibrisgroup.com" ? url : "";
}

export function chatSourceKey(source = {}) {
  const record = source?.sourceRecord || source || {};
  return text(record.evidenceId || record.source_id || record.id, 120) || (record.doi || record.citation?.doi ? `doi:${text(record.doi || record.citation?.doi, 350).toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")}` : text(record.url, 1600));
}

/** These are selectable leads only; the server verifies every token again. */
export function mergeChatSources(...groups) {
  const result = [];
  const seen = new Set();
  for (const source of groups.flatMap((group) => Array.isArray(group) ? group : [])) {
    const record = source?.sourceRecord || source;
    const key = chatSourceKey(record);
    if (!key || seen.has(key) || !text(record?.title, 500) || typeof record?.researchChatToken !== "string" || !record.researchChatToken || record.researchChatToken.length > 12000) continue;
    seen.add(key);
    result.push(record);
    if (result.length === 100) break;
  }
  return result;
}

function sourceSummary(source = {}) {
  source = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  return { id: text(source.id || source.source_id || source.evidenceId, 120), title: text(source.title, 500), url: safeChatSourceUrl(source.url), scope: source.scope === "abstract" || source.evidence_scope === "abstract" ? "abstract" : "metadata" };
}

export function normalizeResearchChatReply(value = {}) {
  value = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sources = (Array.isArray(value.sources) ? value.sources : []).slice(0, CHAT_SOURCE_LIMIT).map(sourceSummary).filter((source) => source.id && source.title);
  const allowed = new Map(sources.map((source) => [source.id, source]));
  const blocks = (Array.isArray(value.blocks) ? value.blocks : []).slice(0, 6).flatMap((block) => {
    const sourceId = text(block?.sourceId || block?.source_id, 120);
    const source = allowed.get(sourceId);
    const quote = text(block?.quote, 1000);
    const interpretation = text(block?.text, 2000);
    if (!source || block?.scope !== "abstract" || !quote || !interpretation) return [];
    return [{ text: interpretation, sourceId, quote, scope: "abstract", source }];
  });
  const mode = ["planning", "scope"].includes(value.mode) ? value.mode : "evidence";
  const guidance = mode === "planning" ? (Array.isArray(value.guidance) ? value.guidance : []).slice(0, 8).flatMap((section) => {
    const title = text(section?.title, 120), content = text(section?.text, 1800);
    return title && content ? [{ title, text: content }] : [];
  }) : [];
  const prompts = (items, limit) => [...new Set((Array.isArray(items) ? items : []).map((item) => text(item, 2000)).filter((item) => item && !/(?:https?:\/\/|www\.|<[^>]*>)/i.test(item)))].slice(0, limit);
  return {
    mode, guidance,
    reason: ["assignment-writing", "unrelated", "library-info", "clarify", "prompt-override"].includes(value.reason) ? value.reason : "",
    supportLinks: (Array.isArray(value.supportLinks) ? value.supportLinks : []).slice(0, 4).flatMap((link) => {
      const label = text(link?.label, 120), url = safeChatSupportUrl(link?.url);
      return label && url ? [{ label, url }] : [];
    }),
    suggestions: prompts(value.suggestions, 4),
    searchQuestions: prompts(value.searchQuestions, 3),
    status: ["answered", "insufficient_evidence", "unavailable", "redirected"].includes(value.status) ? value.status : "insufficient_evidence",
    message: text(value.message, 2000),
    blocks: mode === "scope" ? [] : blocks, sources,
    notice: text(value.notice, 2000),
  };
}

function chatReplyLines(reply) {
  const r = normalizeResearchChatReply(reply);
  const lines = [r.mode === "planning" ? "Planning guidance — not research findings" : r.mode === "scope" ? "Navigator scope guidance" : "Research discussion — check the supporting evidence", "", r.message, ""];
  for (const part of r.guidance) lines.push(part.title, part.text, "");
  for (const block of r.blocks) {
    lines.push("AI interpretation — abstract only", block.text, `Source: ${block.source.title}`, ...(block.source.url ? [block.source.url] : []), "Supporting passage from the abstract:", block.quote, "");
  }
  for (const link of r.supportLinks) lines.push(`${link.label}: ${link.url}`, "");
  if (r.notice) lines.push(r.notice, "");
  if (r.searchQuestions.length) lines.push("Search drafts to review:", ...r.searchQuestions.map((query) => `- ${query}`), "");
  return lines;
}

export function researchChatReplyToText(reply) {
  return withNavigatorAttribution(chatReplyLines(reply).join("\n"));
}

export function researchChatToMarkdown(session, topic = "") {
  const normalized = normalizeResearchChatSession(session);
  const lines = ["# Navigator Research chat", ""];
  if (text(topic)) lines.push(`Research topic: ${text(topic)}`, "");
  for (const message of normalized.messages) {
    if (message.role === "user") lines.push("## You asked", "", message.content, "");
    else lines.push("## Navigator", "", ...chatReplyLines(message.reply));
  }
  return withNavigatorAttribution(lines.join("\n"));
}

export function normalizeResearchChatSession(value = {}) {
  value = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const messages = (Array.isArray(value.messages) ? value.messages : []).slice(-CHAT_TURN_LIMIT).flatMap((message) => {
    if (message?.role === "user") return text(message.content) ? [{ role: "user", content: text(message.content) }] : [];
    if (message?.role === "assistant") return [{ role: "assistant", reply: normalizeResearchChatReply(message.reply || {}), question: text(message.question) }];
    return [];
  });
  return { messages, selectedSourceKeys: [...new Set((Array.isArray(value.selectedSourceKeys) ? value.selectedSourceKeys : []).map((key) => text(key, 1600)).filter(Boolean))].slice(0, CHAT_SOURCE_LIMIT), includeAssignment: value.includeAssignment !== false, draft: typeof value.draft === "string" ? value.draft.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 2000) : "" };
}

export function researchChatPayload({ question, session, sources, topic = "", assignmentContext = "" } = {}) {
  const normalized = normalizeResearchChatSession(session);
  const selected = new Set(normalized.selectedSourceKeys);
  const chosen = mergeChatSources(sources).filter((source) => selected.has(chatSourceKey(source))).slice(0, CHAT_SOURCE_LIMIT);
  const content = text(question);
  if (!content) throw new Error("Enter a question about research or ask for planning help.");
  let contextRemaining = 12000;
  const history = normalized.messages.slice(-10).map((message) => ({ role: message.role, content: message.role === "user" ? message.content : [message.reply.message, ...message.reply.guidance.map((section) => `${section.title}: ${section.text}`), ...message.reply.blocks.map((block) => block.text)].filter(Boolean).join("\n").slice(0, 2000) })).reverse().flatMap((message) => {
    if (!message.content || message.content.length > contextRemaining) return [];
    contextRemaining -= message.content.length;
    return [message];
  }).reverse();
  return {
    question: content,
    topic: text(topic),
    assignmentContext: normalized.includeAssignment ? text(assignmentContext, 3000) : "",
    sourceTokens: chosen.map((source) => source.researchChatToken),
    messages: history,
  };
}

export async function requestResearchChat(payload, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl("/api/research-chat", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal });
  let data;
  try { data = await response.json(); } catch { throw new Error("Research chat returned an unreadable response. Try again."); }
  if (!response.ok) {
    if (response.status === 429) throw new Error("Research chat is busy. Wait a moment, then try again.");
    if ([400, 409, 410].includes(response.status)) throw new Error(data?.error?.message || (typeof data?.error === "string" ? data.error : "The attached source records could not be verified. Run the search again, then attach the refreshed sources."));
    throw new Error("Research chat could not finish. Your question is kept below; try again.");
  }
  if (!data || typeof data.status !== "string") throw new Error("Research chat returned an unreadable response. Try again.");
  return normalizeResearchChatReply(data);
}
