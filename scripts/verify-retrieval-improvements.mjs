import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildResearchPlan } from '../config/researchAgent.js';
import { liveSearchQueries } from '../server/liveSearchQueries.js';
import { searchSourceCandidatesForScope } from '../server/sourceDiscovery.js';
import { rankSourceResults } from '../server/sourceRelevance.js';
import { checkSourceIdentities } from '../server/sourceIdentityCheck.js';

const [baselineFile, outputDirectory, flag] = process.argv.slice(2);
if (!baselineFile || !outputDirectory) throw new Error('Usage: node scripts/verify-retrieval-improvements.mjs BASELINE_CAPTURE OUTPUT_DIRECTORY [--live]');
const baseline = JSON.parse(await readFile(baselineFile,'utf8'));
const output = resolve(outputDirectory);
await mkdir(output,{recursive:true});
const ids = ['psychology-comparison','books-background','exact-book-title','renewable-energy','new-student-ai','sanctions-comparison','electoral-systems','climate-migration'];
const cases = baseline.cases.filter(c=>ids.includes(c.id));
const replay = cases.map(c=>{
  const plan=buildResearchPlan(c.query);
  const rows=rankSourceResults(c.candidates || [],plan.researchSpec,10);
  return {id:c.id,query:c.query,originalTopFive:(c.candidates||[]).slice(0,5).map(s=>({title:s.title,doi:s.doi})),rerankedTopFive:rows.slice(0,5).map(s=>({title:s.title,doi:s.doi,fit:s.matchExplanation,checks:s.sourceAssessment,rank:s.metadataRank})),newSpec:plan.researchSpec};
});
await writeFile(resolve(output,'frozen-pool-replay.json'),JSON.stringify({note:'Same captured provider pool, new interpretation/ranking; not a human accuracy measurement.',cases:replay},null,2));
if (flag==='--live') {
  const capture={capturedAt:new Date().toISOString(),note:'Local updated backend with public library/Crossref providers; no AI generation, no human accuracy ratings, no production cold-start measurement.',cases:[]};
  for (const c of cases) {
    const plan=buildResearchPlan(c.query);let outcomes;const start=Date.now();
    const sources=await searchSourceCandidatesForScope(liveSearchQueries(plan,c.query),10,plan.modeId,'library',{researchSpec:plan.researchSpec,onStatus:value=>{outcomes=value}});
    capture.cases.push({id:c.id,query:c.query,elapsedMs:Date.now()-start,sources,outcomes,researchSpec:plan.researchSpec});
    await writeFile(resolve(output,'live-provider-check.json'),JSON.stringify(capture,null,2));
    console.log(JSON.stringify({id:c.id,count:sources.length,elapsedMs:Date.now()-start,topTitle:sources[0]?.title,outcomes:Object.values(outcomes||{}).flat().map(o=>o.status)}));
  }
  const defect=baseline.cases.flatMap(c=>c.candidates||[]).find(s=>s.doi==='10.4335/12.1.145-162(2014');
  if(defect) {
    const result=await checkSourceIdentities([{...defect,doi:'10.4335/12.1.145-162(2014)'}],{timeoutMs:3000});
    await writeFile(resolve(output,'registry-defect-check.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({doi:result[0].doi,identityCheck:result[0].identityCheck}));
  }
}
