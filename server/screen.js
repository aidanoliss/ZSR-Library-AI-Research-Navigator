import { researchScopeDecision } from "./researchScope.js";

/**
 * Lightweight pre-call relevance / abuse gate. Catches the clear-cut cases
 * cheaply (before spending a Gemini call) and lets the model handle nuance.
 *
 * Deliberately conservative: it only blocks egregious patterns so it won't
 * reject a legitimate research question. Everything else passes through to the
 * model, whose system instructions keep it on-topic and redirect politely.
 */

// Prompt-injection / rule-override attempts (tolerant of filler words).
const INJECTION = [
  /ignore\s+(?:\w+\s+){0,4}(instructions|rules|guidelines|prompt)/i,
  /disregard\s+(?:\w+\s+){0,4}(instructions|rules|system|prompt)/i,
  /(?:what(?:'s| is)|show|reveal|print|give|output).{0,25}(?:your|the)\s+system\s+prompt/i,
  /reveal\s+(?:your\s+)?(system|instructions|prompt)/i,
  /you are now\b/i,
  /pretend to be\b/i,
  /\bjailbreak\b/i,
];

// Route unavailable full-text requests without pretending to access the work.
const FULL_TEXT_REQUEST = [
  /(summarize|summarise)\s+(the\s+)?(full[- ]?text|entire\s+\w+|whole\s+\w+)/i,
  /(give|send|get)\s+me\s+the\s+(full[- ]?text|pdf|article\s+text|whole\s+article)/i,
];

const REDIRECT_WORK =
  "Navigator does not have the full text needed to fulfill that request. I can help find a source record, suggest access routes through ZSR, and discuss available abstract evidence. Open the original source to read and verify its findings.";

const REDIRECT_INJECTION =
  "I'm the ZSR Research Navigator and I stick to helping Wake Forest students plan library research. Tell me your research topic or assignment prompt and I'll build you a plan.";

/** Returns { block: false } or { block: true, message } with a canned redirect. */
export function screenPromptOverride(text) {
  return INJECTION.some((re) => re.test(String(text || "")))
    ? { block: true, reason: "prompt-override", message: REDIRECT_INJECTION }
    : { block: false };
}

export function screenMessage(text, options = {}) {
  const t = String(text || "");
  const override = screenPromptOverride(t);
  if (override.block) return override;
  const scope = researchScopeDecision(t, options);
  if (scope.block) return scope;
  // Legacy unavailable-full-text routing. Essay planning and quoted assignment
  // requirements are governed by the task boundary above, not this old matcher.
  if (FULL_TEXT_REQUEST.some((re) => re.test(t))) {
    return { block: true, reason: "library-info", message: REDIRECT_WORK, supportLinks: [{ label: "Ask ZSR about source access", url: "https://zsr.wfu.edu/ask/" }] };
  }
  return { block: false };
}

/** A minimal structured reply used when a message is blocked pre-model. */
export function blockedReply(message, decision = {}) {
  return {
    scope_redirect: true,
    scope_reason: decision.reason || "prompt-override",
    message,
    supportLinks: decision.supportLinks || [],
    suggested_followups: decision.suggestions || [
      "Help me narrow my topic",
      "Which database fits my subject?",
      "How do I evaluate a source?",
    ],
  };
}
