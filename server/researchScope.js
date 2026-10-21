import { LIBRARY_LINKS } from "../config/libraryLinks.js";

export const RESEARCH_SCOPE_VERSION = "2026-10-21.1";
const tidy = (value) => String(value || "").normalize("NFKC").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/\s+/g, " ").trim();
const helpPrompts = ["Help me structure my essay.", "Help me narrow my research question.", "How should I evaluate these sources?"];
const writingReply = "I can help you plan and evaluate your work, but I do not write submission-ready essays, introductions, conclusions, or assignment answers. I can give you a paragraph plan, help you test a working thesis, or help review a draft you wrote.";
const outsideReply = "That request is outside Navigator's library-research role. I can help find sources, build searches, evaluate evidence, plan a research assignment, or connect you with ZSR support. If you are researching this subject, tell me what evidence you want to find.";
const support = (label, url) => ({ label, url });
const result = (reason, message, suggestions = helpPrompts, supportLinks = []) => ({ block: true, reason, message, suggestions, supportLinks });

// Sources, assignment briefs and pasted drafts are data, not permission to do
// the student's work. Only a direct request outside the quotation is screened
// as an instruction; a bare quoted request remains a request.
function instructionText(value) {
  const raw = tidy(value);
  if (!/\b(?:assignment|prompt|instructor|teacher|syllabus|draft|quotation|quote)\b/i.test(raw)) return raw;
  const outside = raw.replace(/"[^"\n]*"|“[^”\n]*”/g, " ").trim();
  return outside || raw;
}

const RESEARCH_TASK = /\b(?:find|search(?:ing)?|locate|look(?:ing)? for|retrieve|recommend)\b.{0,90}\b(?:sources?|research|studies|articles?|books?|papers?|literature|archives?|datasets?|databases?|evidence|documentation)\b|\b(?:sources?|studies|articles?|research|literature|scholarship)\s+(?:on|about|examining|regarding)\b/i;
const PRODUCE = "(?:write|compose|produce|generate|draft|complete|finish|create|give|provide|supply|continue)";
const ARTIFACT = "(?:essay|paper|assignment|report|dissertation|homework|introduction|conclusion|body paragraph|paragraph|section|chapter|discussion post|literature review|answer to (?:my |the )?(?:assignment|exam|homework))";
const WRITE_WORK = new RegExp(`\\b${PRODUCE}\\s+(?:(?:me|us)\\s+)?(?:(?:my|the|a|an|our|another|next|first|second|third|final|entire|full|complete|polished|finished|ready.to.submit|[\\d,]+(?:[ -](?:word|page)s?)?)\\s+){0,5}${ARTIFACT}\\b`, "i");
const DIRECT_WORK = /\b(?:do|finish|complete)\s+(?:my|the)\s+(?:homework|assignment|essay|paper|thesis|exam)\b|\bwrite\s+(?:me\s+)?(?:[\d,]+\s*(?:pages?|words?|paragraphs?)|(?:my|a|the)\s+(?:[\d,]+[- ]page\s+)?thesis)\b|\b(?:turn|convert|expand)\b.{0,80}\b(?:outline|bullets?|notes)\b.{0,50}\b(?:finished|polished|full|complete|submission.ready|paragraphs?|essay|prose)\b|\b(?:do (?:it|the writing) for me|just (?:give|write) (?:me )?the answer)\b/i;
const EVADE = /\b(?:evade|bypass|beat|fool|avoid|undetectable|hide|remove)\b.{0,65}\b(?:AI detect(?:ion|ors?)?|plagiarism detect(?:ion|ors?)?|Turnitin|watermark|AI use|AI involvement)\b|\b(?:humanize|humanise)\b.{0,50}\b(?:essay|paper|assignment|AI text)\b|\b(?:invent|fabricate|fake|make up)\b.{0,45}\b(?:citations?|references?|sources?|DOIs?|data|findings)\b/i;
const OUTSIDE = [
  /\b(?:what(?:'s| is)|tell me|give me|check|forecast)\b.{0,40}\b(?:today'?s weather|weather (?:today|tomorrow|in)|current weather|sports scores?|stock price|bitcoin price)\b/i,
  /\b(?:tell|write|make|give)\b.{0,30}\b(?:a joke|me a joke|a bedtime story|a poem|a song|a recipe|a meal plan|a workout|a love letter)\b/i,
  /\b(?:plan|book|find|arrange)\s+(?:me\s+)?(?:a|my|our|an)\s+(?:vacation|holiday|flight|hotel|date night|workout|meal plan|trip)\b/i,
  /\b(?:debug|fix|execute|run|write|generate|build|create)\b.{0,45}\b(?:this code|my code|a (?:python |javascript |web )?(?:script|program|app|website)|code for|a function|function that)\b/i,
  /\b(?:diagnose me|what (?:medicine|medication) should I take|manage my investments|buy (?:me )?stocks|solve (?:this |my )?(?:equation|homework problem)|calculate \d)\b/i,
  /^(?:what is|what's) (?:the )?capital of\b/i,
];

/** Task boundary, not a blacklist of academic subjects. Unknown topical
 * questions remain eligible for research/evidence routing; no source text or
 * assistant history is treated as a new instruction or scope authorization. */
export function researchScopeDecision(question, { messages = [] } = {}) {
  const raw = tidy(question), q = instructionText(raw);
  const research = RESEARCH_TASK.test(q);
  // Self-directed writing and procedural questions are not ghostwriting asks.
  const procedural = /\b(?:how (?:should|can|do) I|help me (?:plan|outline|structure|organize)|(?:plan|outline|structure) (?:my|an?|the) (?:essay|paper)|working thesis|thesis (?:frame|template))\b/i.test(q);
  const selfDirected = /\bI\s+(?:need|have|want|plan|am going)\s+to\s+write\b/i.test(q) && !/\b(?:you (?:write|draft)|write (?:it|this) for me|do it for me|can you|could you)\b/i.test(q);
  // A research request ABOUT evasion/fabrication is allowed unless it also
  // directly requests that action. E.g. studying fake citations is legitimate.
  const explicitEvasion = /\b(?:can you|could you|please|help me|I want you to|and|then|also|but)\s+(?:please\s+)?(?:make|remove|hide|evade|bypass|invent|fabricate|fake|humanize|humanise)\b|^(?:remove|hide|evade|bypass|invent|fabricate|fake|humanize|humanise|make up)\b/i.test(q);
  if (EVADE.test(q) && (!research || explicitEvasion)) return result("assignment-writing", "I cannot help fabricate evidence, conceal AI use, or evade detection. I can help you locate real sources, verify citations, and document research assistance transparently.");
  const explicitWriting = new RegExp(`(?:^|\\b(?:and|then|also|but|please|can you|could you|would you|I want you to|now|just)\\s+)${PRODUCE}\\b`, "i").test(q);
  if ((!procedural && !selfDirected && (!research || explicitWriting) && (WRITE_WORK.test(q) || DIRECT_WORK.test(q)))
    || /\b(?:and|then|also)\s+(?:please\s+)?(?:write|draft|compose)\s+(?:me\s+)?(?:the|a|an|my|next|another)\s+(?:essay|introduction|conclusion|paragraph|section)\b/i.test(q)) return result("assignment-writing", writingReply);
  if (/^(?:now\s+)?(?:continue|keep going|do the next one)[.! ]*$/i.test(q)) {
    const previous = [...messages].reverse().find((message) => message?.role === "user" && !/^(?:now\s+)?(?:continue|keep going|do the next one)[.! ]*$/i.test(tidy(message.content)));
    if (previous && researchScopeDecision(previous.content).reason === "assignment-writing") return result("assignment-writing", writingReply);
  }
  if (!research && OUTSIDE.some((pattern) => pattern.test(q))) return result("unrelated", outsideReply);
  const extraTasks = q.split(/\b(?:and then|and|then|also|but)\b/i).slice(1);
  if (extraTasks.some((clause) => !RESEARCH_TASK.test(clause) && OUTSIDE.some((pattern) => pattern.test(clause)))) return result("unrelated", outsideReply);
  if (/\b(?:ZSR|library|WFU|Wake Forest)\b/i.test(q) && /\b(?:hours?|open|close|closing|borrow|renew|loan|fines?|reserve|booking|study rooms?|printing|access|login|log in|sign in)\b/i.test(q) && !research) {
    return result("library-info", "For current library hours, borrowing rules, room reservations, or account access, use ZSR's official website or Ask ZSR. I cannot verify live hours, your account, availability, or eligibility from this chat.", ["Which database fits my research topic?", "How can I find access to an article?"], [support("ZSR hours and services", "https://zsr.wfu.edu/"), support("Ask ZSR", LIBRARY_LINKS.zsrAsk)]);
  }
  if (/^(?:hi|hello|hey|help|can you help(?: me)?|what can you do)[?.! ]*$/i.test(q)) return result("clarify", "I help with library research: finding sources, improving searches, evaluating evidence, and planning research assignments. What are you researching, and what would help you move forward?");
  return { block: false };
}

export function researchScopeReply(decision) {
  return { status: "redirected", mode: "scope", reason: decision.reason, scope_version: RESEARCH_SCOPE_VERSION, message: decision.message, suggestions: decision.suggestions || helpPrompts, supportLinks: decision.supportLinks || [], guidance: [], blocks: [], sources: [], notice: "Navigator is a research-support prototype. This response is not authoritative library policy or a determination of your course's AI rules." };
}
