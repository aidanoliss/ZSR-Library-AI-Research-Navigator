import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResearchSpec, mergeSuppliedResearchSpec, researchSpecQuery } from '../config/researchSpec.js';
import { applyScopePriorities, completeSearchClarification, searchClarification } from '../src/searchClarification.js';
import { assessSourceRequirements } from '../src/sourceAssessment.js';
import { searchCoverage } from '../src/searchCoverage.js';
import { parseSourceExplorationRequest } from '../server/sourceExplorationRequest.js';

test('clarification asks one relevant question and respects explicit outcome / population', () => {
  assert.equal(searchClarification('Sanctions and their impact on authoritarian regimes vs democracies').id, 'sanctions-outcome');
  assert.equal(searchClarification('sanctions and civilian mortality'), null);
  assert.equal(searchClarification('social media among students').choices.length, 2);
  assert.equal(searchClarification('social media among undergraduate students'), null);
  assert.equal(searchClarification('sanctions', { knownItem: { title: 'Sanctions' } }), null);
  assert.equal(searchClarification('World War II women workers in Britain'), null);
});

test('preferences broaden query without silently dropping hard method exclusions or dates', () => {
  const base = buildResearchSpec('Systematic reviews of online teaching among undergraduate students in the United States published since 2020');
  const preferred = applyScopePriorities(base, { population: 'preferred', geography: 'preferred', method: 'preferred' });
  assert.equal(preferred.facets.population, '');
  assert.ok(preferred.preferredFacets.population);
  assert.equal(preferred.sourceRequirements.publicationYearFrom, 2020);
  assert.deepEqual(preferred.methodRequirements.include, []);
  assert.doesNotMatch(researchSpecQuery(preferred), /undergrad|college|United States|systematic/i);
  assert.match(researchSpecQuery(preferred), /online teaching/i);
  const parsedAgain = mergeSuppliedResearchSpec(buildResearchSpec(preferred.topic), preferred);
  assert.deepEqual(parsedAgain.preferredFacets, preferred.preferredFacets);
  const restored = applyScopePriorities(preferred, { population: 'required', geography: 'required', method: 'required' });
  assert.equal(restored.facets.population, base.facets.population);
  assert.deepEqual(restored.methodRequirements.include, base.methodRequirements.include);
  assert.deepEqual(restored.preferredFacets, {});
});

test('wrong preferred population is shown but only wrong required population excludes', () => {
  const base = buildResearchSpec('online teaching among undergraduate students');
  const source = { title: 'Online teaching in secondary school students', type: 'article', abstractText: 'We studied secondary school students in 12 high schools.' };
  assert.equal(assessSourceRequirements(source, base).status, 'mismatch');
  const relaxed = assessSourceRequirements(source, applyScopePriorities(base, { population: 'preferred' }));
  assert.notEqual(relaxed.status, 'mismatch');
  assert.ok(relaxed.preferenceChecks.some(check => check.status === 'mismatch'));
});

test('coverage distinguishes completed, failed and disabled attempts, never sums counts', () => {
  const value = searchCoverage({ completedAt: '2026-10-18T12:00:00.000Z', lanes: {
    library: { requested: true, attempts: [{ provider: 'Primo', status: 'success', resultCount: 3, query: 'first' }, { provider: 'Primo', status: 'success', resultCount: 3, query: 'second' }, { provider: 'Crossref', status: 'timeout' }] },
    openAccess: { requested: false, provider: 'OpenAlex', outcome: 'success' },
  } });
  assert.equal(value.searched.length, 2);
  assert.equal(value.unavailable[0].status, 'timeout');
  assert.equal(value.notSearched[0].status, 'not_requested');
  assert.equal(value.completedAt, '2026-10-18T12:00:00.000Z');
  assert.equal(value.totalCount, undefined);
  assert.equal(searchCoverage(null).unknown, true);
});

test('exploration validates untrusted request and regenerates contracts', () => {
  for (const body of [null, [], {}, { seed: null }, { seed: {}, researchSpec: {} }]) assert.ok(parseSourceExplorationRequest(body).error);
  const base = buildResearchSpec('online teaching among undergraduate students');
  const result = parseSourceExplorationRequest({ seed: { doi: '10.1234/example', title: 'Test' }, researchSpec: { ...base, sourceContract: { allowedKinds: ['malicious'] } }, relationship: 'references', limit: 999, accessScope: 'open-access' });
  assert.equal(result.limit, 10);
  assert.equal(result.accessScope, 'open-access');
  assert.deepEqual(result.researchSpec.sourceContract, base.sourceContract);
  assert.equal(result.researchSpec.facets.population, base.facets.population);
});


test('rerunning or editing a topic does not silently restore explicitly softened criteria', async () => {
  const { reviseSearchTopic } = await import('../src/resultSearch.js');
  const base = buildResearchSpec('online teaching among undergraduate students in the United States');
  const preferred = applyScopePriorities(base, { population: 'preferred', geography: 'preferred' });
  const same = reviseSearchTopic(preferred.topic, preferred);
  assert.deepEqual(same.preferredFacets, preferred.preferredFacets);
  assert.equal(same.facets.population, '');
  const edited = reviseSearchTopic('remote learning among undergraduate students in the United States', preferred);
  assert.deepEqual(edited.preferredFacets, preferred.preferredFacets);
  assert.equal(edited.facets.population, '');
  const changedPopulation = reviseSearchTopic('remote learning among children in Britain', preferred);
  assert.equal(changedPopulation.preferredFacets.population, undefined);
  assert.ok(changedPopulation.facets.population);
});


test('clarification choices produce semantic scope without UI instruction tokens', () => {
  for (const content of ['Sanctions and their impact on authoritarian regimes vs democracies', 'social media effects among students']) {
    const spec = buildResearchSpec(content);
    const question = searchClarification(content, spec);
    for (const choice of question.choices) {
      const completed = completeSearchClarification({ content, spec, question }, choice.label);
      const query = researchSpecQuery(completed.spec);
      assert.doesNotMatch(query, /\bFocus\b|Population:|students Population|\bchanges\b/);
      if (choice.population) assert.equal(completed.spec.facets.population, choice.population);
      if (choice.concept) assert.ok(completed.spec.concepts.some(concept => concept.preferredTerm === choice.concept));
      assert.deepEqual(completed.spec.sourceRequirements, spec.sourceRequirements);
    }
    const skipped = completeSearchClarification({ content, spec, question }, question.choices[0].label, {}, true);
    assert.equal(skipped.topic, content);
    assert.equal(researchSpecQuery(skipped.spec), researchSpecQuery(spec));
  }
});


test('joint scope does not overrule an unverified study population', () => {
  const base = buildResearchSpec('online teaching among undergraduate students in the United States');
  const source = { title: 'Online teaching among undergraduate students in the United States', type: 'article', abstractText: 'Background and proposed research directions.' };
  const check = assessSourceRequirements(source, applyScopePriorities(base, { population: 'preferred', geography: 'preferred' }));
  const population = check.preferenceChecks.find(row => row.id === 'population');
  const joint = check.preferenceChecks.find(row => row.id === 'population-geography');
  if (population.status !== 'meets') assert.notEqual(joint.status, 'meets');
});
