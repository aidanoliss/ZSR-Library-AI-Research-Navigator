import {readFile,writeFile} from 'node:fs/promises';
const base='https://zsr-library-ai-research-navigator-1.onrender.com';
const existing=JSON.parse(await readFile(new URL('../../../../evals/search-quality-review-set.json',import.meta.url)));
const ids=['sanctions-comparison','electoral-systems','psychology-comparison','sleep-memory','adolescent-media','climate-migration','public-health-comparison','renewable-energy','ai-writing','housing-policy','history-primary','books-background','exact-book-title','exact-article-title','date-window','qualitative-explicit','sparse-local','open-access-scope'];
const fresh=[
{id:'new-wearables',query:'Wearable devices for detecting atrial fibrillation in adults',reviewPrompt:'Does the evidence address detection of atrial fibrillation using wearables in adults?'},
{id:'new-urban-heat',query:'Street tree canopy and summer heat exposure in low-income urban neighborhoods',reviewPrompt:'Check tree canopy, heat exposure, and low-income neighborhoods.'},
{id:'new-student-ai',query:'How does generative AI use affect critical thinking among undergraduate students?',reviewPrompt:'Check generative AI, critical thinking, and undergraduate population; conceptual commentary is supporting only.'},
{id:'new-broadband',query:'Rural broadband access and small business growth in North Carolina',reviewPrompt:'Check rural broadband, small businesses, growth, and North Carolina.'},
{id:'new-microplastics',query:'Microplastics in agricultural soil and effects on earthworms',reviewPrompt:'Check agricultural soil, microplastics, and earthworm outcomes.'},
{id:'negative-invented-title',query:'Find the article "The Quantum Library of Purple Giraffes: A Randomized Trial of Lunar Database Navigation" by Aurelia Testfixture',reviewPrompt:'Invented title/author negative control. Must not claim a matching publication exists.',negativeControl:true}
];
const samples=[...existing.filter(x=>ids.includes(x.id)).map(x=>({...x,cohort:'existing-developer-benchmark'})),...fresh.map(x=>({...x,cohort:'new-diagnostic'}))];
const selectedReviewIds=['sanctions-comparison','psychology-comparison','climate-migration','renewable-energy','history-primary','exact-book-title',...fresh.map(x=>x.id)];
const capture={format:'zsr-search-quality-review',label:'Live production source-stage audit',capturedAt:new Date().toISOString(),live:true,endpoint:base,reviewSampleIds:selectedReviewIds,method:'Sequential public streaming requests; capture first source event then cancel remaining optional guidance. Measures retrieval, not generated claims. No human judgments supplied.',healthBefore:await (await fetch(base+'/api/health')).json(),configuration:await(await fetch(base+'/api/pilot/status')).json(),cases:[]};
await writeFile(new URL('./manifest.json',import.meta.url),JSON.stringify({samples,selectedReviewIds},null,2));
for(const sample of samples){
 const start=performance.now(); let entry={...sample,status:'failed',candidates:[],retrieval:{}};
 const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),45000);
 try{
 const r=await fetch(base+'/api/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:sample.query}],mode:sample.modeId||'scholarly',accessScope:sample.accessScopeId||'library',responseStyle:'sources'}),signal:controller.signal});
 entry.httpStatus=r.status;
 if(!r.ok){entry.error=await r.text();if(r.status===429) throw Error('rate_limited');}
 else{
 let buffer='';const reader=r.body.getReader();const decoder=new TextDecoder();let payload;
 while(!payload){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){if(!line.trim())continue;const e=JSON.parse(line);if(e.type==='sources'||e.type==='done'){payload=e;break;}}}
 if(!payload)throw Error('no_source_event');
 entry={...entry,status:'captured',releaseId:payload.releaseId,candidates:(payload.liveResults||[]).map((s,i)=>({...s,rank:i+1,judgment:null})),researchSpec:payload.researchSpec,sourceDiscovery:payload.sourceDiscovery,reply:payload.reply,researchPlan:payload.researchPlan,retrieval:{latencyMs:Math.round(performance.now()-start),outcomes:Object.fromEntries(Object.entries(payload.sourceDiscovery?.lanes||{}).map(([k,v])=>[k,v.attempts||[]]))}};
 await reader.cancel();controller.abort();
 }
 }catch(e){entry.error=e.message;entry.retrieval.latencyMs=Math.round(performance.now()-start);}finally{clearTimeout(timeout);}
 capture.cases.push(entry);await writeFile(new URL('./live-capture.json',import.meta.url),JSON.stringify(capture,null,2));
 console.log(`${sample.id}: ${entry.status}, ${entry.candidates.length} records, ${entry.retrieval.latencyMs}ms`);
 if(entry.httpStatus===429)break;
 await new Promise(resolve=>setTimeout(resolve,750));
}
