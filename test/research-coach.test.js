import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResearchCoachRequest, validateResearchCoachReply, researchCoachReply, shouldResearchCoach } from '../server/researchCoach.js';
import { researchChatReply } from '../server/researchChat.js';
import { RESEARCH_COACH_GUIDES } from '../config/researchCoachKnowledge.js';
import { createCircuitBreaker } from '../server/providerResilience.js';

const request = { question: 'Civilian health in Russia after 2014. Help narrow this.', topic: 'Economic sanctions', assignmentContext: 'Six scholarly sources for a first-year paper.', messages: [{role:'user',content:'I want to compare perspectives rather than assume sanctions worked.'},{role:'assistant',content:'Which outcome interests you?'}], sources:[{abstract:'PRIVATE ABSTRACT NOT FOR COACH',researchChatToken:'PRIVATE TOKEN',notes:'PRIVATE NOTE'}] };
const reply = () => ({coaching:[{kind:'advice',text:'Compare possible research questions about civilian health in Russia after 2014 without presuming an outcome.',guide_ids:['topic-refinement']},{kind:'question',text:'Which health outcome would you like to investigate?',guide_ids:[]}],suggestions:['Help me build a library search.'],search_questions:['Russia sanctions civilian health after 2014']});
const provider = raw => async () => ({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(raw)}]}}]})});
const opts = () => ({apiKey:'synthetic',coachCircuit:createCircuitBreaker(),retries:0});

test('source-free coaching includes bounded research context and curated guides without abstracts or notebook secrets',()=>{
 const packet=buildResearchCoachRequest(request); const text=JSON.stringify(packet);
 const input=JSON.parse(packet.contents[0].parts[0].text);
 assert.equal(input.question,request.question); assert.deepEqual(input.context_not_evidence.prior_messages,request.messages);
 assert.equal(input.context_not_evidence.assignment,request.assignmentContext);
 assert.equal(input.reference_guides.length,7); assert.equal(packet.tools,undefined);
 assert.doesNotMatch(text,/PRIVATE ABSTRACT|PRIVATE TOKEN|PRIVATE NOTE/);
 assert.match(packet.systemInstruction.parts[0].text,/not a factual answer engine/);
});

test('research planning and factual source discussion retain separate routing',()=>{
 for(const question of ['I do not know where to start.','What is a systematic review?','How do I organize my essay comparing these sources?','Help improve my Boolean search.']) assert.equal(shouldResearchCoach({...request,question}),true,question);
 for(const question of ['What did this study find?','Summarize the entire article','Quote all chapters','What can we conclude?','Compare the findings']) assert.equal(shouldResearchCoach({...request,question}),false,question);
 assert.equal(shouldResearchCoach({question:'Tell me more',messages:[],sources:[]}),true);
});

test('valid advice is marked as coaching and uses only canonical guide links',()=>{
 const result=validateResearchCoachReply(reply(),request); assert.equal(result.coaching.length,2);
 assert.equal(result.guideReferences[0].url,RESEARCH_COACH_GUIDES[0].url);
 assert.deepEqual(result.searchQuestions,['Russia sanctions civilian health after 2014']);
});

test('definitions use exact developer-curated paraphrases rather than model factual prose',()=>{
 const result=validateResearchCoachReply({coaching:[{kind:'explanation',text:'Invented research claim with 90% success and fake URL https://fake.test',guide_ids:['systematic-searching']}],suggestions:[],search_questions:[]},request);
 assert.equal(result.coaching[0].text,RESEARCH_COACH_GUIDES.find(g=>g.id==='systematic-searching').summary);
 assert.doesNotMatch(result.coaching[0].text,/90%|fake.test/);
});

test('unknown guides, unsafe links, ungrounded numbers, empirical claims and multiple questions reject a reply',()=>{
 const bad = [
 {kind:'advice',text:'Choose a topic.',guide_ids:['invented']},
 {kind:'advice',text:'Check https://fake.test for a study.',guide_ids:[]},
 {kind:'advice',text:'Compare 50 studies.',guide_ids:[]},
 {kind:'advice',text:'Consider that research shows sanctions work.',guide_ids:[]},
 {kind:'advice',text:'Consider that 2014% of studies support it.',guide_ids:[]},
 {kind:'advice',text:'I have verified this research.',guide_ids:[]},
 {kind:'question',text:'Which outcome? Which place?',guide_ids:[]},
 {kind:'advice',text:'Write my entire essay for submission.',guide_ids:[]},
 ];
 for(const part of bad) assert.equal(validateResearchCoachReply({coaching:[part]},request),null,part.text);
 const two=reply();two.coaching.push({kind:'question',text:'Which place?',guide_ids:[]});assert.equal(validateResearchCoachReply(two,request),null);
});

test('assistant-invented numbers cannot authorize new statistical advice',()=>{
 const input={...request,messages:[{role:'assistant',content:'Compare 99 papers.'}]};
 assert.equal(validateResearchCoachReply({coaching:[{kind:'advice',text:'Compare 99 papers.',guide_ids:[]}]},input),null);
});

test('a successful provider reply supports a source-free conversational follow-up',async()=>{
 const result=await researchCoachReply({...request,sources:[]},{...opts(),fetchImpl:provider(reply())});
 assert.equal(result.coachingOrigin,'gemini');assert.equal(result.mode,'coaching');assert.equal(result.message,"Let's build on that.");
 assert.deepEqual(result.blocks,[]); assert.match(result.notice,/do not verify every suggestion/);
});

test('provider and validation failures return clearly labeled planning fallback',async()=>{
 for(const fetchImpl of [provider({coaching:[{kind:'advice',text:'Studies show it works.',guide_ids:[]}]}),async()=>{throw new Error('secret provider error');}]){
  const result=await researchCoachReply(request,{...opts(),fetchImpl});assert.equal(result.coachingOrigin,'fallback');assert.match(result.notice,/unavailable|could not be used/);assert.doesNotMatch(JSON.stringify(result),/secret provider error/);
 }
 const noKey=await researchCoachReply(request,{apiKey:''});assert.equal(noKey.coachingOrigin,'fallback');
});

test('cancelled coaching does not return a misleading fallback',async()=>{
 const controller=new AbortController();controller.abort();await assert.rejects(researchCoachReply(request,{...opts(),signal:controller.signal}),{code:'RESEARCH_CHAT_CANCELLED'});
});

test('source-free factual findings abstain, and out-of-scope writing redirects before provider access',async()=>{
 const fetchImpl=async()=>{throw new Error('must not call');};
 const factual=await researchChatReply({question:'What can we conclude?',sourceTokens:[]},{apiKey:'synthetic',fetchImpl});assert.equal(factual.status,'insufficient_evidence');
 const essay=await researchChatReply({question:'Write my entire essay about sanctions.',sourceTokens:[]},{apiKey:'synthetic',fetchImpl});assert.equal(essay.mode,'scope');
});


test('method definitions remain useful as canonical guide notes when the provider is unavailable',async()=>{
 const result=await researchCoachReply({...request,question:'What is a systematic review?'},{apiKey:''});
 assert.equal(result.coachingOrigin,'fallback');assert.equal(result.coaching[0].text,RESEARCH_COACH_GUIDES.find(g=>g.id==='systematic-searching').summary);
 assert.equal(result.guideReferences[0].id,'systematic-searching');assert.match(result.notice,/developer-curated paraphrase/);
});
