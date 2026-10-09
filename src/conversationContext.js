import { isZsrNavigationRequest } from "../config/researchAgent.js";
import { sourceRequirementUpdates, stripSourceRequirementText } from "../config/sourceRequirements.js";

const MAX_CONTEXT_TURNS = 4;

const CONTEXT_REFERENCE_RE = /\b(this|that|it|these|those|above|previous|earlier|same|former|latter|first|second|third|option|angle|choice|one)\b/i;
const DEPENDENT_START_RE = /^(?:also|then|now|next|instead|focus(?:\s+(?:it|this|that))?\s+on|(?:impact|effect)\s+on\b|narrow(?:\s+(?:it|this|that))?\s+(?:to|by)|limit(?:\s+(?:it|this|that))?\s+to|add\b|remove\b|make\s+(?:it|this|that)\b|use\s+(?:it|this|that|the\s+(?:first|second|third|chosen))\b|what about\b|how about\b|find\s+(?:more|other|similar)\b|show\s+(?:more|other|similar)\b|give\s+(?:me\s+)?(?:more|other|similar)\b)/i;
const SOURCE_DISCOVERY_RE = /\b(articles?|books?|sources?|evidence|results?|records?|citations?|papers?|journals?|databases?|search terms?|keywords?)\b/i;
const CONTEXT_STOPWORDS = new Set([
  "about", "actual", "also", "and", "angle", "angles", "answer", "article", "articles",
  "book", "books", "can", "citation", "citations", "could", "evidence", "explore", "find",
  "focus", "focused", "for", "give", "good", "help", "how", "in", "include", "into",
  "journal", "journals", "look", "me", "more", "my", "need", "of", "on", "option",
  "options", "paper", "papers", "please", "provide", "real", "record", "records", "relevant",
  "research", "result", "results", "search", "show", "source", "sources", "suggest", "that",
  "the", "these", "this", "to", "topic", "try", "use", "usable", "useful", "what", "which",
  "with", "would", "you", "your", "zsr", "database", "databases", "should", "keywords", "terms", "only", "within", "instead", "different", "onwards",
]);
const SOURCE_ONLY_MODIFIERS = new Set([
  "academic", "current", "peer", "peer-reviewed", "primary", "recent", "reviewed", "scholarly", "secondary",
]);

export function isResearchProcessFollowup(text) {
  const value = String(text || "").trim();
  // References to displayed records remain evidence questions about the current
  // topic, even when the question is long. Do not turn their wording into keywords.
  if (/\b(?:which|what|how|does|do|can|compare|evaluate|check|explain|summari[sz]e)\b/i.test(value)
    && /\b(?:these|those|the above|the (?:first|second|third|previous))\s+(?:sources?|stud(?:y|ies)|articles?|papers?|results?|claims?|records?)\b|\bwhich of (?:these|those)\b/i.test(value)) return true;
  // The interpretation panel's bounded refinement protocol refers to the current
  // brief; its instruction words are not a replacement research topic.
  if (/^Refine\s+".+"\.\s+Change exactly one field:/i.test(value)) return true;
  if (isSourceOnlyFollowup(value)) return true;
  if (Object.keys(sourceRequirementUpdates(value)).length && meaningfulWords(stripSourceRequirementText(value)).length === 0) return true;
  return /^(?:(?:can|could|would) you )?(?:help (?:me )?)?(?:explain|clarify|narrow|refine|evaluate|check|improve) (?:the |my |this |that )?(?:scope|search|search terms|keywords|sources|topic|research question|citation)(?:\s+(?:please|for me))?[?.!]*$/i.test(value);
}

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
  const topicWords = meaningfulWords(stripSourceRequirementText(value)).filter((word) => !SOURCE_ONLY_MODIFIERS.has(word));
  return topicWords.length === 0;
}

export function startsIndependentResearchTurn(text, hasPriorTopic = false) {
  const value = String(text || "").trim();
  if (!value || isZsrNavigationRequest(value)) return false;
  if (!hasPriorTopic) return true;
  if (/\b(?:new|different|unrelated)\s+(?:research\s+)?topic\b/i.test(value)) return true;
  if (isResearchProcessFollowup(value)) return false;
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

  // Keep the topic anchor even after several short workflow follow-ups.
  return activeTurns.length > MAX_CONTEXT_TURNS ? [activeTurns[0], ...activeTurns.slice(-(MAX_CONTEXT_TURNS - 1))] : activeTurns;
}

export function submittedResearchContext(messages = [], endIndex = messages.length) {
  return submittedActiveResearchTurns(messages, endIndex).join(" ");
}

export function submittedResearchTopicContext(messages = [], endIndex = messages.length) {
  const activeTurns = submittedActiveResearchTurns(messages, endIndex);
  const topicTurns = activeTurns.filter((turn, index) => index === 0 || !isResearchProcessFollowup(turn));
  return (topicTurns.length ? topicTurns : activeTurns).join(" ");
}
