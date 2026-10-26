import test from 'node:test';import assert from 'node:assert/strict';
import {guidedPlannerQuestions,plannerAnswerLine,plannerDetailPrompt,researchSpecForFollowup} from '../src/guidedPlanner.js';
import {unconfirmedSourceDiscovery} from '../src/sourceSearchStatus.js';
import {emptySourcePresentation} from '../src/sourcePresentation.js';
import {searchCoverage} from '../src/searchCoverage.js';

test('all default source and narrowing choices remain available, including skip choices',()=>{
 const q=guidedPlannerQuestions();assert.equal(q.length,3);assert.ok(q[1].options.includes('Primary sources'));assert.ok(q[1].options.includes('Data/statistics'));assert.ok(q[2].options.includes('Not sure yet'));assert.match(q[0].question,/published/);assert.equal(guidedPlannerQuestions([{question:'Incomplete'}]).length,3);
});
test('comparison, population and place need user-supplied values rather than an invented scope',()=>{
 const q=guidedPlannerQuestions()[2];
 for(const choice of ['A particular population','A particular place','Compare two groups or approaches']) {assert.ok(plannerDetailPrompt([choice]));assert.equal(plannerAnswerLine(q,[choice]),'');}
 assert.match(plannerAnswerLine(q,['Compare two groups or approaches'],'vaccinated versus unvaccinated children'),/vaccinated versus unvaccinated children/);
 assert.equal(plannerDetailPrompt(['No extra limits']),'');
});
test('an interrupted search exposes an actionable unconfirmed status without claiming a provider returned zero records',()=>{
 const status=unconfirmedSourceDiscovery('both');const lanes=Object.entries(status.lanes).map(([label,value])=>({label,status:value}));
 const presentation=emptySourcePresentation(lanes);assert.equal(presentation.retryable,true);assert.match(presentation.title,/couldn’t finish/);assert.ok(presentation.requested.every(l=>l.outcome==='not_confirmed'));assert.match(presentation.requested[0].message,/before Navigator could confirm/);
 const coverage=searchCoverage(status);assert.equal(coverage.searched.length,0);assert.equal(coverage.unavailable.length,2);
});
test('a skipped catalog run is distinct from a completed empty search and offers a source search',()=>{
 const result=emptySourcePresentation([{label:'Library',status:{requested:true,outcome:'not_requested'}}]);assert.match(result.title,/haven’t been searched/);assert.equal(result.retryable,true);assert.doesNotMatch(result.explanation,/cannot be searched/);
 const library=unconfirmedSourceDiscovery('library');assert.equal(library.lanes.openAccess.requested,false);
});


test('saved legacy planner dates can be repaired from their actual choices without changing source scope',()=>{
 const previous={topic:'vaccines and autism',mode:'scholarly',facets:{timePeriod:'Last 5 years',population:'children'},sourceRequirements:{publicationYearFrom:null,publicationYearTo:null,peerReviewed:true}};
 const messages=[{role:'user',content:previous.topic,plannerContext:'What time period should the search prioritize?: Last 5 years\nWhat source types should ZSR scan first?: Peer-reviewed articles'},{role:'assistant'}];
 const fixed=researchSpecForFollowup(previous,messages);assert.equal(fixed.facets.timePeriod,'');assert.equal(fixed.sourceRequirements.publicationYearFrom,new Date().getFullYear()-4);assert.equal(fixed.facets.population,'children');assert.equal(previous.facets.timePeriod,'Last 5 years');
 for(const later of [{role:'user',content:'The historical period studied should be the last 5 years.'},{role:'user',content:'Published since 2020'},{role:'assistant',isCorrectionResult:true}]) assert.equal(researchSpecForFollowup(previous,[...messages,later]),previous);
 assert.equal(researchSpecForFollowup(previous,[]),previous);
});
