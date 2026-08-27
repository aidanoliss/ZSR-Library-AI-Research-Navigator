import {
  DEFAULT_MODE_ID,
  DEFAULT_RESPONSE_STYLE_ID,
  getResponseStyle,
  getSearchMode,
} from "../config/libraryLinks.js";
import {
  DEFAULT_SUBJECT_FOCUS_ID,
  getSubjectFocus,
} from "../config/subjectFocus.js";
import {
  activeResearchConversation,
  submittedResearchTopicContext,
} from "../src/conversationContext.js";
import { requestContextFromBody } from "./requestContext.js";

export const MAX_CHAT_MESSAGE_LENGTH = 2000;
export const MAX_CHAT_TURNS = 40;

/**
 * Validate and normalize an incoming chat request.
 * Returns { error } for invalid input or a model-ready request context.
 */
export function parseChatRequest(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return { error: "Please enter a research topic or question to get started." };
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !String(last.content || "").trim()) {
    return { error: "The latest message must be from the student." };
  }
  if (String(last.content).length > MAX_CHAT_MESSAGE_LENGTH) {
    return {
      error: `That message is very long — please shorten it to under ${MAX_CHAT_MESSAGE_LENGTH} characters.`,
    };
  }
  if (messages.length > MAX_CHAT_TURNS) {
    return { error: "This conversation is quite long. Please start a new chat." };
  }

  const normalizedHistory = messages
    .filter(
      (message) =>
        (message?.role === "user" || message?.role === "assistant") &&
        String(message?.content || "").trim()
    )
    .map((message) => ({
      role: message.role,
      content: String(message.content).trim(),
    }));
  const history = activeResearchConversation(normalizedHistory);
  const studentText =
    submittedResearchTopicContext(history) || String(last.content).trim();
  const mode = getSearchMode(body?.mode || DEFAULT_MODE_ID).id;
  const responseStyle = getResponseStyle(
    body?.responseStyle || DEFAULT_RESPONSE_STYLE_ID
  ).id;
  const subjectFocusId = getSubjectFocus(
    body?.subjectFocusId || DEFAULT_SUBJECT_FOCUS_ID
  ).id;

  return {
    history,
    studentText,
    last,
    mode,
    responseStyle,
    subjectFocusId,
    ...requestContextFromBody(body),
  };
}
