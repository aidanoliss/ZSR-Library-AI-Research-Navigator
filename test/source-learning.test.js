import test from 'node:test';
import assert from 'node:assert/strict';
import { describeSourceRole, readingSteps, evidenceNotesForSource } from '../src/sourceLearning.js';
import { sourceKindFromMetadata, sourcePeerReviewStatus } from '../src/sourceAssessment.js';
import { createResearchWorkspace, addResearchItem, saveSourceNotes, workspaceToJson, parseWorkspaceImport } from '../src/researchWorkspace.js';
import { startsIndependentResearchTurn, submittedResearchTopicContext } from '../src/conversationContext.js';

test('generic article metadata does not establish empirical research or peer review', () => {
  const source = {type:'article', title:'College Belonging: Review', doi:'10.1234/example'};
  assert.equal(describeSourceRole(source).id, 'review');
  assert.equal(describeSourceRole(source).inferred, true);
  assert.equal(sourcePeerReviewStatus(source), 'unverified');
  assert.equal(describeSourceRole({...source, title:'College belonging'}).label, 'Article · study type unknown');
});

test('provider role and inferred role are distinct and specific formats survive normalization', () => {
  for (const [type,id] of [['book-review','book-review'], ['book_chapter','chapter'], ['book','book'], ['editorial','commentary'], ['posted-content','preprint'], ['dataset','data'], ['primary-source','primary']]) {
    const role = describeSourceRole({type, title:'A systematic review of methods'});
    assert.equal(role.id,id,type);
    assert.equal(role.inferred,false,type);
  }
  assert.equal(sourceKindFromMetadata({type:'book_chapter'}),'book-chapter');
  assert.equal(describeSourceRole({type:'article',title:'Food insecurity: a systematic review'}).inferred,true);
  assert.equal(describeSourceRole({type:'article',abstractExcerpt:'We interviewed 25 students about access to food.'}).id,'study');
  assert.equal(describeSourceRole({title:'A study of institutions'}).id,'unknown');
});

test('reading steps change with source role without fabricating findings', () => {
  assert.match(readingSteps({type:'book-review'})[0], /reviewer/);
  assert.match(readingSteps({type:'dataset'})[0], /variable definitions/);
  assert.match(readingSteps({type:'article'})[0], /association alone/);
  assert.match(readingSteps({type:'article'})[1], /page or section/);
  assert.match(readingSteps({type:'article'})[2], /independent source/);
});

test('evidence rendering refuses unknown IDs, invented quotes, and missing abstracts', () => {
  const source={evidenceId:'src_1',evidenceExcerpt:'We interviewed 25 students about access to food.'};
  const note={source_id:'src_1',claim:'The authors interviewed students.',quote:'We interviewed 25 students about access to food.',evidence_scope:'abstract'};
  assert.deepEqual(evidenceNotesForSource(source,[note]),[{source_id:note.source_id,quote:note.quote,evidence_scope:note.evidence_scope}]);
  assert.equal("claim" in evidenceNotesForSource(source,[note])[0],false);
  assert.equal(evidenceNotesForSource(source,[{...note,source_id:'src_2'},{...note,quote:'Food security improved by 87 percent.'},{...note,evidence_scope:'full_text'}]).length,0);
  assert.equal(evidenceNotesForSource({...source,evidenceExcerpt:''},[note]).length,0);
});

test('reading notes update a saved work without duplicating or changing its status, and survive export', () => {
  const source={kind:'catalog',title:'A real source record',url:'https://example.com/work',status:'use',notes:'Existing notes',citation:'Keep this citation',sourceRecord:{type:'article'}};
  let workspace=addResearchItem(createResearchWorkspace(),source,1000);
  workspace=saveSourceNotes(workspace,source,'Passage: p. 8. Limitation: small sample.',2000);
  assert.equal(workspace.trail.length,1);
  assert.equal(workspace.trail[0].status,'use');
  assert.equal(workspace.trail[0].citation,'Keep this citation');
  const imported=parseWorkspaceImport(workspaceToJson(workspace)).workspace;
  assert.equal(imported.trail[0].notes,workspace.trail[0].notes);
  assert.equal(saveSourceNotes(workspace,{...source,url:'https://example.com/second'},'Second source',3000).trail.length,2);
});

test('long source-evaluation followups retain the topic but explicit topic changes do not', () => {
  const topic='sanctions and authoritarian regimes';
  const followup='Which of these sources actually supports the claim about effectiveness and what are the limitations?';
  assert.equal(startsIndependentResearchTurn(followup,true),false);
  assert.equal(submittedResearchTopicContext([{role:'user',content:topic},{role:'user',content:followup}]),topic);
  assert.equal(startsIndependentResearchTurn('New topic: compare these studies about education',true),true);
});

test('method requirements use explicit provider types and never treat absence of a cue as proof', async () => {
  const {assessSourceRequirements}=await import('../src/sourceAssessment.js');
  const spec={methodRequirements:{include:['empirical study'],exclude:['literature review']}};
  assert.equal(assessSourceRequirements({type:'systematic-review'},spec).status,'mismatch');
  const vague=assessSourceRequirements({type:'article',abstractExcerpt:'Our work discusses previous studies.'},spec);
  assert.equal(vague.status,'unverified');
  assert.equal(vague.checks.every(check=>check.status==='unverified'),true);
  assert.equal(assessSourceRequirements({type:'systematic-review'},{methodRequirements:{include:['systematic review']}}).status,'meets');
});

test('a working-paper venue is a qualified role cue even when the generic provider type is article', () => {
  const source={type:'article',containerTitle:'IDEAS Working Paper Series from RePEc'};
  assert.equal(describeSourceRole(source).id,'preprint');
  assert.equal(describeSourceRole(source).inferred,true);
  assert.equal(sourcePeerReviewStatus(source),'unverified');
});

test('an abstract identifying its own theoretical review is not treated as an empirical study', () => {
  const role=describeSourceRole({type:'article',title:'A developmental framework',abstractExcerpt:'In this theoretical review paper, we provide a framework for the role of social media.'});
  assert.equal(role.id,'review');
  assert.equal(role.inferred,true);
});

test('source roles use later study descriptions without mistaking negation or prior work for this study', () => {
  const intro = 'Food insecurity is a concern. Access varies between campuses.';
  assert.equal(describeSourceRole({ type: 'article', abstractExcerpt: intro, abstractText: `${intro} We interviewed 25 students about access to food.` }).id, 'study');
  for (const statement of ['We did not conduct a systematic review.', 'Previous research reports a randomized controlled trial.', 'We previously conducted a systematic review.', 'We will conduct a systematic review.']) {
    assert.equal(describeSourceRole({ type: 'article', abstractText: `${intro} ${statement}` }).id, 'article');
  }
});
