import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.argv[2]||'/private/tmp/zsr-live-release-2026-10-16';
const out=new URL('./',import.meta.url);
const imp=p=>import(pathToFileURL(resolve(root,p)));
const {buildResearchPlan}=await imp('config/researchAgent.js');
const {liveSearchQueries}=await imp('server/liveSearchQueries.js');
const {getPrimoApiStatus}=await imp('server/primoApi.js');
const {searchSourceCandidatesForScope,sourceDiscoveryStatus}=await imp('server/sourceDiscovery.js');
const samples=[
{id:'sanctions-comparison',query:'Sanctions and their impact on authoritarian regimes vs democracies'},
{id:'population-geography-method',query:'Find randomized controlled trials comparing cognitive behavioral therapy with mindfulness for anxiety among undergraduate students in the United States.'},
{id:'historical-period',query:'Find peer-reviewed articles published since 2020 about women workers in Britain during World War II, 1939 to 1945.'},
{id:'humanities-books',mode:'books',query:'Find scholarly books about memory and identity in contemporary African American literature.'},
{id:'known-book',mode:'books',query:'Find the book Governing the Commons by Elinor Ostrom.'},
{id:'nursing-review',query:'Find systematic reviews comparing nurse-led interventions with usual care to reduce hospital readmission among older adults with heart failure.'},
{id:'local-data',query:'Find primary datasets on housing affordability and eviction in Forsyth County, North Carolina from 2015 to 2024.'},
{id:'historical-primary',query:'Find primary sources: letters and diaries by enslaved or formerly enslaved people in North Carolina before 1865.'},
{id:'education-comparison',query:'Find empirical studies comparing the effects of AI writing assistants and peer feedback on first-year college students writing skills.'},
{id:'science-review',query:'Find systematic reviews of offshore wind farm impacts on marine biodiversity.'},
{id:'geography-method',query:'Find qualitative interview studies of climate migration among women in Bangladesh.'},
{id:'negative-known-item',mode:'books',query:'Find the book Quantum Librarians of the Invisible Moon by Amelia Quasar, published in 2024.'}
];
const report={configuration:{primoApi:getPrimoApiStatus(),publicHost:process.env.PRIMO_HOST||'https://wfu.primo.exlibrisgroup.com',publicView:process.env.PRIMO_VID||'01WAKE_INST:ZSR',accessScope:'library',dotenvLoaded:false},capturedAt:new Date().toISOString(),gitRelease:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),method:'Same release deterministic interpretation and discovery pipeline, local execution against live public bibliographic providers; no dotenv, AI generation, or model API calls. Not production end-to-end. All relevance ratings must be labeled model/evaluator, not human. 25 second hard per-case deadline.',cases:[]};
try {const r=await fetch('https://zsr-library-ai-research-navigator-1.onrender.com/api/health',{signal:AbortSignal.timeout(25000)});report.liveHealth={http:r.status,payload:await r.json()}}catch(e){report.liveHealth={error:e.name+': '+e.message}}
await writeFile(new URL('capture.json',out),JSON.stringify(report,null,2));
for(const sample of samples){
 const start=performance.now();const plan=buildResearchPlan(sample.query,5,'auto',sample.mode||'scholarly',{});const queries=liveSearchQueries(plan,sample.query);let outcomes={};
 const controller=new AbortController();let timer;
 const row={...sample,startedAt:new Date().toISOString(),researchSpec:plan.researchSpec,queries};
 try{row.sources=await Promise.race([searchSourceCandidatesForScope(queries,10,plan.modeId,'library',{researchSpec:plan.researchSpec,signal:controller.signal,onStatus:v=>outcomes=v}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Audit deadline exceeded'))},25000)})]);row.status='captured';row.discovery=sourceDiscoveryStatus('library',row.sources,outcomes,plan.researchSpec)}catch(e){row.status=e.message.includes('deadline')?'audit-timeout':'error';row.error=e.name+': '+e.message}finally{clearTimeout(timer);controller.abort()}
 row.elapsedMs=Math.round(performance.now()-start);row.outcomes=outcomes;report.cases.push(row);await writeFile(new URL('capture.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({id:row.id,status:row.status,count:row.sources?.length,ms:row.elapsedMs,top:row.sources?.[0]?.title}));
 if(Object.values(outcomes).flat().some(o=>o.status==='rate_limited')){report.stoppedForRateLimit=true;break}
}
report.completedAt=new Date().toISOString();await writeFile(new URL('capture.json',out),JSON.stringify(report,null,2));
