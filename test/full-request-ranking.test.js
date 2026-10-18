import test from 'node:test';
import assert from 'node:assert/strict';
import { rankSourceResults, assessSourceRelevance } from '../server/sourceRelevance.js';
import { assessSourceRequirements } from '../src/sourceAssessment.js';
import { buildResearchSpec } from '../config/researchSpec.js';

const base = {type:'article',sourceKind:'scholarly-article'};
const spec = {mode:'scholarly',concepts:[{id:'sleep',preferredTerm:'sleep'},{id:'attention',preferredTerm:'attention'}],facets:{population:'undergraduates',geography:'Canada'},methodRequirements:{include:['randomized controlled trial'],exclude:[]}};
const checked = (source,id) => assessSourceRequirements(source,spec).checks.find(c=>c.id===id);
test('complete request evidence outranks title keyword density and unknown scope',()=>{
  const complete={...base,doi:'10.9999/complete',title:'An experimental investigation',abstractText:'This study examines sleep and attention in Canada. We recruited 120 undergraduates in Canada. We conducted a randomized controlled trial.'};
  const partial={...base,doi:'10.9999/partial',title:'Sleep and attention in Canadian university students: a randomized controlled trial',abstractText:'This study examines sleep and attention in Canada. We recruited 120 university students. We conducted a randomized controlled trial.'};
  const keyword={...base,doi:'10.9999/keywords',title:'Sleep and attention: Canada, undergraduates and randomized controlled trials',abstractText:'Previous studies recruited undergraduates in Canada. This paper discusses future research.'};
  const rows=rankSourceResults([keyword,partial,complete],spec);
  assert.deepEqual(rows.map(r=>r.doi),[complete.doi,partial.doi,keyword.doi]);
  assert.equal(rows[0].metadataRank.requestFit,'metadata-supported');
  assert.equal(rows[1].matchExplanation.status,'partial');
  assert.ok(rows[1].matchExplanation.missingFacets.includes('undergraduates'));
  assert.equal(rows[2].metadataRank.scopeCoverage,0);
});
test('undergraduate-only requests retain that scope instead of broadening to all college students',()=>{
  assert.equal(buildResearchSpec('Generative AI and critical thinking in undergraduates').facets.population,'undergraduates');
  assert.equal(checked({...base,abstractText:'We recruited 120 college students.'},'population').status,'unverified');
  assert.equal(checked({...base,abstractText:'We recruited 120 undergraduates.'},'population').status,'meets');
});
test('geography mentions in background and affiliations do not establish study setting',()=>{
  for(const source of [
    {...base,title:'Sleep and attention',subjects:['Canada'],abstractText:'Previous studies analyzed sleep and attention in Canada. We collected data in Mexico.'},
    {...base,title:'Sleep and attention',abstractText:'Our author affiliation is in Canada.'},
    {...base,title:'Sleep and attention',abstractText:'We will recruit participants in Canada.'},
  ]) assert.equal(checked(source,'geography').status,'unverified');
  assert.equal(checked({...base,title:'Sleep and attention in Canada'},'geography').status,'meets');
  assert.equal(checked({...base,abstractText:'We analyzed survey data from Canada.'},'geography').status,'meets');
});
test('a declared systematic review outranks unknown methods without calling mentions a method',()=>{
  const reviewSpec=buildResearchSpec('Offshore wind energy impacts on marine mammals systematic reviews');
  const review={...base,doi:'10.9999/review',title:'Marine wind farms and marine mammals: a systematic review',abstractText:'We conducted a systematic review of offshore wind energy and marine mammals.'};
  const empirical={...base,doi:'10.9999/tracking',title:'Offshore wind energy impacts on marine mammals',abstractText:'Previous systematic reviews describe the problem. We tracked seals in wind farms.'};
  const rows=rankSourceResults([empirical,review],reviewSpec);
  assert.equal(rows[0].doi,review.doi);
  assert.equal(rows[0].sourceAssessment.checks.find(c=>c.id.startsWith('method-')).status,'meets');
  assert.equal(rows[1].sourceAssessment.checks.find(c=>c.id.startsWith('method-')).status,'unverified');
  const titleOnly={...base,title:'Marine wind farms and marine mammals - a systematic review'};
  assert.equal(assessSourceRequirements(titleOnly,reviewSpec).checks.find(c=>c.id.startsWith('method-')).status,'meets');
  assert.equal(assessSourceRequirements({...titleOnly,title:'Marine wind farms: a semi-systematic review'},reviewSpec).checks.find(c=>c.id.startsWith('method-')).status,'unverified');
});
test('a comparison with the requested population ranks above generic or combined-approach evidence',()=>{
  const comparison=buildResearchSpec('Cognitive behavioral therapy versus mindfulness for anxiety among college students');
  const direct={...base,doi:'10.9999/direct',title:'CBT versus mindfulness for anxiety',abstractText:'We recruited 80 college students. We compared CBT and mindfulness for anxiety in separate groups.'};
  const combined={...base,doi:'10.9999/combined',title:'CBT and mindfulness for anxiety',abstractText:'We recruited 80 college students. This study explored the combined effects of CBT and mindfulness for anxiety.'};
  const unknown={...direct,doi:'10.9999/unknown',abstractText:'Previous studies compared CBT and mindfulness for anxiety among college students. This paper describes a research agenda.'};
  const rows=rankSourceResults([unknown,combined,direct],comparison);
  assert.equal(rows[0].doi,direct.doi);
  assert.equal(rows[1].matchExplanation.status,'partial');
  assert.equal(assessSourceRelevance(combined,comparison).relationship.status,'combined-approach');
});
