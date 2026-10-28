import {readFile,writeFile} from 'node:fs/promises';
const base='https://zsr-library-ai-research-navigator-1.onrender.com';
const health=await(await fetch(base+'/api/health',{signal:AbortSignal.timeout(25000)})).json();
console.log(JSON.stringify(health));
if(!String(health.releaseId).startsWith('ab979a3')) throw new Error('New release is not live yet');
const baseline=JSON.parse(await readFile(new URL('../accuracy/manifest.json',import.meta.url)));
const ids=['psychology-comparison','books-background','exact-book-title','renewable-energy','electoral-systems'];
const result={health,at:new Date().toISOString(),method:'Public source-stage checks; cancel optional generated guidance after first source event. No human relevance/claim-accuracy ratings.',cases:[]};
for(const sample of baseline.samples.filter(s=>ids.includes(s.id))){
 const start=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 let row={id:sample.id,query:sample.query};
 try {
  const response=await fetch(base+'/api/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:sample.query}],mode:sample.modeId||'scholarly',accessScope:'library',responseStyle:'sources'}),signal:controller.signal});
  row.httpStatus=response.status;
  if(!response.ok) throw new Error('HTTP_'+response.status);
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',payload;
  while(!payload){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){if(!line.trim())continue;const event=JSON.parse(line);if(['sources','done'].includes(event.type)){payload=event;break;}}}
  if(!payload)throw new Error('No source event');
  row={...row,elapsedMs:Date.now()-start,sources:payload.liveResults,sourceDiscovery:payload.sourceDiscovery,researchSpec:payload.researchSpec};
  await reader.cancel();controller.abort();
 }catch(error){row={...row,elapsedMs:Date.now()-start,error:error.message};}finally{clearTimeout(timer)}
 result.cases.push(row);await writeFile(new URL('./production-check.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify({id:row.id,count:row.sources?.length,elapsedMs:row.elapsedMs,error:row.error,top:row.sources?.[0]?.title,identityWarnings:row.sources?.filter(s=>s.identityCheck?.status==='title-difference').map(s=>({doi:s.doi,title:s.title,registry:s.identityCheck.registryTitle}))}));
 if(row.httpStatus===429)break;
}
