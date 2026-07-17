import { isZsrNavigationRequest } from "../config/researchAgent.js";

const MAX_CONTEXT_TURNS = 4;

const CONTEXT_REFERENCE_RE = /\b(this|that|it|these|those|above|previous|earlier|same|former|latter|first|second|third|option|angle|choice|one)\b/i;
const DEPENDENT_START_RE = /^(?:also|then|now|next|instead|focus(?:\s+(?:it|this|that))?\s+on|(?:impact|effect)\s+on\b|narrow(?:\s+(?:it|this|that))?\s+(?:to|by)|limit(?:\s+(?:it|this|that))?\s+to|add\b|remove\b|make\s+(?:it|this|that)\b|use\s+(?:it|this|that|the\s+(?:first|second|third|chosen))\b|what about\b|how about\b|find\s+(?:more|other|similar)\b|show\s+(?:more|other|similar)\b|give\s+(?:me\s+)?(?:more|other|similar)\b)/i;
const SOURCE_DISCOVERY_RE = /\b(articles?|books?|sources?|evidence|results?|records?|citations?|papers?|journals?)\b/i;
const CONTEXT_STOPWORDS = new Set([
  "about", "actual", "also", "and", "angle", "angles", "answer", "article", "articles",
  "book", "books", "can", "citation", "citations", "could", "evidence", "explore", "find",
  "focus", "focused", "for", "give", "good", "help", "how", "in", "include", "into",
  "journal", "journals", "look", "me", "more", "my", "need", "of", "on", "option",
  "options", "paper", "papers", "please", "provide", "real", "record", "records", "relevant",
  "research", "result", "results", "search", "show", "source", "sources", "suggest", "that",
  "the", "these", "this", "to", "topic", "try", "use", "usable", "useful", "what", "which",
  "with", "would", "you", "your", "zsr",
]);
const SOURCE_ONLY_MODIFIERS = new Set([
  "academic", "current", "peer", "primary", "recent", "reviewed", "scholarly", "secondary",
]);

function meaningfulWords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !CONTEXT_STOPWORDS.has(word));
}

export function isSourceOnlyFollowup(text) {
  const value = String(text || "").trim();
  if (!value || !SOURCE_DISCOVERY_RE.test(value)) return false;
  const topicWords = meaningfulWords(value).filter((word) => !SOURCE_ONLY_MODIFIERS.has(word));
  return topicWords.length === 0;
}

export function startsIndependentResearchTurn(text, hasPriorTopic = false) {
  const value = String(text || "").trim();
  if (!value || isZsrNavigationRequest(value)) return false;
  if (!hasPriorTopic) return true;
  if (/\b(?:new|different|unrelated)\s+(?:research\s+)?topic\b/i.test(value)) return true;
  if (DEPENDENT_START_RE.test(value)) return false;

  const meaningful = meaningfulWords(value);
  if (meaningful.length >= 5) return true;
  if (CONTEXT_REFERENCE_RE.test(value)) return false;
  if (/\b(?:compare|comparison|contrast|differences?|similarities?|relationship)\s+(?:of|between)\b/i.test(value)) {
    return meaningful.length >= 2;
  }

  const wordCount = value.split(/\s+/).filter(Boolean).length;
  return meaningful.length >= 2 && wordCount <= 10;
}

export function activeResearchConversation(messages = []) {
  let activeMessages = [];
  let hasPriorTopic = false;

  for (const message of messages) {
    if (!message || (message.role !== "user" && message.role !== "assistant")) continue;
    if (message.role === "user") {
      const content = String(message.content || "").trim();
      if (!content) continue;
      const navigationOnly = isZsrNavigationRequest(content);
      if (!navigationOnly && startsIndependentResearchTurn(content, hasPriorTopic)) {
        activeMessages = [message];
      } else {
        activeMessages.push(message);
      }
      if (!navigationOnly) hasPriorTopic = true;
    } else if (activeMessages.length) {
      activeMessages.push(message);
    }
  }

  return activeMessages;
}

function submittedActiveResearchTurns(messages = [], endIndex = messages.length) {
  const submittedTurns = messages
    .slice(0, Math.max(0, endIndex))
    .filter((message) => message?.role === "user")
    .map((message) => String(message.content || "").trim())
    .filter(Boolean);

  if (!submittedTurns.length) return [];
  const researchTurns = submittedTurns.filter((turn) => !isZsrNavigationRequest(turn));
  const relevantTurns = researchTurns.length ? researchTurns : submittedTurns;
  let activeTurns = [];

  for (const turn of relevantTurns) {
    if (startsIndependentResearchTurn(turn, activeTurns.length > 0)) {
      activeTurns = [turn];
    } else {
      activeTurns.push(turn);
    }
  }

  return activeTurns.slice(-MAX_CONTEXT_TURNS);
}

export function submittedResearchContext(messages = [], endIndex = messages.length) {
  return submittedActiveResearchTurns(messages, endIndex).join(" ");
}

export function submittedResearchTopicContext(messages = [], endIndex = messages.length) {
  const activeTurns = submittedActiveResearchTurns(messages, endIndex);
  const topicTurns = activeTurns.filter((turn, index) => index === 0 || !isSourceOnlyFollowup(turn));
  return (topicTurns.length ? topicTurns : activeTurns).join(" ");
}
