import { buildResearchSpec, mergeSuppliedResearchSpec } from '../config/researchSpec.js';

/** Deliberately narrow rules: ask only where the answer changes retrieval. */
export function searchClarification(topic, spec = {}) {
  const text = String(topic || '').trim();
  if (!text || spec.knownItem || /https?:|\b10\.\d{4,9}\//i.test(text)) return null;
  if (/\bsanctions?\b/i.test(text) && !/\b(civilian|humanitarian|poverty|mortality|compliance|foreign policy|regime survival|trade flows|GDP|economic growth)\b/i.test(text)) return {
    id: 'sanctions-outcome', question: 'Which effects of sanctions matter most to your question?',
    choices: [{ label: 'Government behavior', concept: 'government behavior', synonyms: ['policy compliance', 'policy change'] }, { label: 'Effects on civilians', concept: 'civilian well-being', synonyms: ['humanitarian effects', 'humanitarian impact'] }],
  };
  if (/\bstudents?\b/i.test(text) && !spec.facets?.population && !/\b(college|university|undergraduate|graduate|primary|secondary|school|K.?12|all ages)\b/i.test(text)) return {
    id: 'student-population', question: 'Which students are you studying?',
    choices: [{ label: 'Undergraduate students', population: 'undergraduate students' }, { label: 'K–12', population: 'primary and secondary school students' }],
  };
  return null;
}

export const PRIORITY_FIELDS = [['population', 'Population'], ['geography', 'Location'], ['method', 'Study method']];
export function scopePriorityRows(spec = {}) {
  return PRIORITY_FIELDS.flatMap(([key, label]) => {
    const value = spec.facets?.[key] || spec.preferredFacets?.[key];
    return value ? [{ key, label, value, priority: spec.preferredFacets?.[key] && !spec.facets?.[key] ? 'preferred' : 'required' }] : [];
  });
}

/** A preference never silently becomes a hard filter. Keep its value for display. */
export function applyScopePriorities(spec, priorities = {}) {
  const facets = { ...spec.facets };
  const preferredFacets = { ...spec.preferredFacets };
  let concepts = (spec.concepts || []).map((concept) => ({ ...concept }));
  let methods = { include: [...(spec.methodRequirements?.include || [])], exclude: [...(spec.methodRequirements?.exclude || [])] };
  for (const { key, value, priority } of scopePriorityRows(spec)) {
    const chosen = priorities[key] || priority;
    const parsed = buildResearchSpec(value, { modeId: spec.mode });
    const terms = new Set((parsed.concepts || []).map((c) => c.preferredTerm.toLowerCase()));
    const ids = new Set((parsed.concepts || []).map((c) => c.id));
    // Exact phrases are deliberate source/topic constraints, not inferred facets.
    concepts = concepts.map((concept) => !concept.exactPhrase && (terms.has(concept.preferredTerm.toLowerCase()) || ids.has(concept.id))
      ? { ...concept, required: chosen !== 'preferred' } : concept);
    if (chosen === 'preferred') { preferredFacets[key] = value; facets[key] = ''; }
    else { facets[key] = value; delete preferredFacets[key]; }
    if (key === 'method') methods.include = chosen === 'preferred' ? [] : parsed.methodRequirements?.include || methods.include;
  }
  return mergeSuppliedResearchSpec(spec, { ...spec, facets, preferredFacets, concepts, methodRequirements: methods });
}

/** Apply choices as structured scope, never parse UI instructions as search concepts. */
export function completeSearchClarification(draft, choiceLabel, priorities = {}, skip = false) {
  const choice = !skip && draft.question.choices.find((item) => item.label === choiceLabel);
  let spec = draft.spec;
  let topic = draft.content;
  if (choice?.concept) {
    topic = `${draft.content} — ${choice.concept}`;
    spec = mergeSuppliedResearchSpec(spec, { ...spec, topic, concepts: [...spec.concepts, { id: 'clarified-outcome', preferredTerm: choice.concept, synonyms: choice.synonyms, required: true }] });
  } else if (choice?.population) {
    topic = draft.content.replace(/\bstudents?\b/i, choice.population);
    const parsed = buildResearchSpec(topic, { modeId: spec.mode, assignmentContext: draft.assignmentContext });
    spec = mergeSuppliedResearchSpec(parsed, { ...parsed, facets: { ...parsed.facets, population: choice.population }, sourceRequirements: spec.sourceRequirements });
  }
  return { topic, spec: applyScopePriorities(spec, skip ? {} : priorities) };
}
