import { buildResearchSpec } from "../config/researchSpec.js";
import { sourceRequirementUpdates } from "../config/sourceRequirements.js";

/** Planner choices describe filters, not extra words to add to the topic. */
export const DEFAULT_PLANNER_QUESTIONS = [
  { question: 'When should the sources have been published?', why: 'This filters publication dates. It does not change the historical period your topic studies.', options: ['Published in the last 5 years','Published in the last 10 years','Any publication date'] },
  { question: 'What source type do you need?', why: 'Choose a starting format. You can change it after seeing results.', options: ['Peer-reviewed articles','Books/background','News/current events','Data/statistics','Primary sources'] },
  { question: 'Would a population, place, or comparison help focus the search?', why: 'Add an actual group, place, or comparison, or keep the search open.', options: ['No extra limits','A particular population','A particular place','Compare two groups or approaches','Not sure yet'] },
];
export function guidedPlannerQuestions(provided = []) {
  const questions = (Array.isArray(provided) ? provided : []).filter(q => typeof q?.question === 'string' && Array.isArray(q.options) && q.options.some(v => typeof v === 'string' && v.trim())).slice(0,3);
  return (questions.length ? questions : DEFAULT_PLANNER_QUESTIONS).map(q => ({question:q.question,why:q.why || '',options:q.options.filter(v=>typeof v==='string'&&v.trim()).slice(0,5)}));
}
export function plannerDetailPrompt(selected = []) {
  if (selected.some(v => /^compare two (?:groups or )?approaches$/i.test(v))) return 'Which two groups or approaches should the search compare?';
  if (selected.includes('A particular population')) return 'Which population should the research study?';
  if (selected.includes('A particular place')) return 'Which place should the research cover?';
  return '';
}
export function plannerAnswerLine(question, selected = [], custom = '') {
  const detail = String(custom || '').trim();
  if (plannerDetailPrompt(selected) && !detail) return '';
  const values = [...selected, detail].filter(Boolean);
  return values.length ? `${question.question}: ${values.join('; ')}` : '';
}

/** Recover the known legacy menu/date mistake from actual saved planner choices.
 * Never reinterpret an unlabelled historical period or overwrite a later edit. */
export function researchSpecForFollowup(previous, messages = []) {
  if (!previous?.facets?.timePeriod || previous.sourceRequirements?.publicationYearFrom || previous.sourceRequirements?.publicationYearTo) return previous;
  const period = String(previous.facets.timePeriod).trim();
  if (!/^(?:last (?:5|10) years|any time period|historical context|recent scholarship|foundational studies)$/i.test(period)) return previous;
  let index = -1;
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i]?.role === "user" && messages[i].plannerContext) { index = i; break; }
  if (index < 0) return previous;
  const planner = String(messages[index].plannerContext);
  if (!planner.toLowerCase().includes(period.toLowerCase())) return previous;
  if (messages.slice(index + 1).some(message => {
    if (message.isCorrectionRequest || message.isCorrectionResult) return true;
    if (message.role !== "user") return false;
    const changes = sourceRequirementUpdates(message.content || "");
    return Object.hasOwn(changes, "publicationYearFrom") || Object.hasOwn(changes, "publicationYearTo") || /\b(?:historical|study|topic) (?:period|time|dates?)\b/i.test(message.content || "");
  })) return previous;
  const fresh = buildResearchSpec(previous.topic, { modeId: previous.mode, plannerContext: planner });
  if (fresh.facets.timePeriod) return previous;
  return { ...previous, facets: { ...previous.facets, timePeriod: "" }, sourceRequirements: { ...previous.sourceRequirements, publicationYearFrom: fresh.sourceRequirements.publicationYearFrom, publicationYearTo: fresh.sourceRequirements.publicationYearTo } };
}
