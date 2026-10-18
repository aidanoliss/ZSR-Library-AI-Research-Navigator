import { buildResearchSpec, mergeSuppliedResearchSpec } from '../config/researchSpec.js';
import { getAccessScope } from '../config/accessScope.js';
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
export function parseSourceExplorationRequest(body) {
  if (!object(body) || !object(body.seed) || !object(body.researchSpec)) return { error: 'A source identifier and research brief are required.' };
  if (!['similar', 'references', 'citing'].includes(body.relationship)) return { error: 'Choose related works, references, or citing works.' };
  const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const seed = { title: text(body.seed.title, 500), doi: text(body.seed.doi, 350), openAlexId: text(body.seed.openAlexId || body.seed.citation?.openAlexId, 100) };
  if (!seed.doi && !seed.openAlexId && !seed.title) return { error: 'This source needs a DOI or OpenAlex identifier for citation exploration.' };
  if (body.seed.identityCheck?.status === 'title-difference' || body.seed.identityCheck?.observedStatus === 'title-difference') seed.identityCheck = { status: 'title-difference' };
  const topic = text(body.researchSpec.topic, 500);
  if (!topic) return { error: 'The research topic is missing. Run a search before exploring connections.' };
  const researchSpec = mergeSuppliedResearchSpec(buildResearchSpec(topic, { modeId: body.researchSpec.mode }), body.researchSpec);
  return { seed, researchSpec, relationship: body.relationship, accessScope: getAccessScope(body.accessScope).id, limit: Math.min(10, Math.max(1, Number.parseInt(body.limit, 10) || 5)) };
}
