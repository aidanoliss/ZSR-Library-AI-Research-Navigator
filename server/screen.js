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
  /system\s+prompt/i,
  /reveal\s+(?:your\s+)?(system|instructions|prompt)/i,
  /you are now\b/i,
  /pretend to be\b/i,
  /\bjailbreak\b/i,
];

// "Do my assignment for me" — the tool plans research, it doesn't produce the work.
const DO_MY_WORK = [
  /\bwrite\s+(me\s+)?(my|the|a|an)\s+(\d+\s*[- ]?page\s+)?(essay|paper|assignment|report|thesis|dissertation|homework)\b/i,
  /(do|finish|complete)\s+my\s+(homework|assignment|essay|paper|thesis)/i,
  /write\s+\d+\s*(pages?|words?|paragraphs?)\b/i,
  /\b\d+\s*[- ]?page\s+(essay|paper|report)\b/i,
  /(summarize|summarise)\s+(the\s+)?(full[- ]?text|entire\s+\w+|whole\s+\w+)/i,
  /(give|send|get)\s+me\s+the\s+(full[- ]?text|pdf|article\s+text|whole\s+article)/i,
];

const REDIRECT_WORK =
  "I can't write your assignment or summarize full-text sources for you — that's outside what this tool does (and your instructors expect your own work). What I can do is help you plan the research: suggest where to start in ZSR's collection, search terms to try, and how to evaluate what you find. What's your topic?";

const REDIRECT_INJECTION =
  "I'm the ZSR Research Navigator and I stick to helping Wake Forest students plan library research. Tell me your research topic or assignment prompt and I'll build you a plan.";

/** Returns { block: false } or { block: true, message } with a canned redirect. */
export function screenMessage(text) {
  const t = String(text || "");
  if (INJECTION.some((re) => re.test(t))) {
    return { block: true, message: REDIRECT_INJECTION };
  }
  if (DO_MY_WORK.some((re) => re.test(t))) {
    return { block: true, message: REDIRECT_WORK };
  }
  return { block: false };
}

/** A minimal structured reply used when a message is blocked pre-model. */
export function blockedReply(message) {
  return {
    message,
    suggested_followups: [
      "Help me narrow my topic",
      "Which database fits my subject?",
      "How do I evaluate a source?",
    ],
  };
}
