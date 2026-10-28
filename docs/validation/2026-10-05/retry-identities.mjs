import {readFile,writeFile} from 'node:fs/promises';
const url=new URL('./identity-verification.json',import.meta.url);
const audit=JSON.parse(await readFile(url));
const capture=JSON.parse(await readFile(new URL('./provider-capture.json',import.meta.url)));
const norm=s=>String(s||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'and').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
await writeFile(new URL('./identity-verification-initial.json',import.meta.url),JSON.stringify(audit,null,2)+'\n');
for(const r of audit.records.filter(r=>r.registryStatus===429)) {
 await new Promise(resolve=>setTimeout(resolve,2200));
 const response=await fetch(r.registry.endpoint,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'ZSRNavigatorResearchQualityAudit/1.0'}});
 r.initialRegistryStatus=429; r.registryStatus=response.status;
 if(response.ok){const m=(await response.json()).message;
 r.registry={endpoint:r.registry.endpoint,status:response.status,doi:m.DOI,title:m.title,subtitle:m.subtitle,author:m.author,editor:m.editor,type:m.type,publisher:m.publisher,containerTitle:m['container-title'],issued:m.issued,published:m.published,publishedPrint:m['published-print'],publishedOnline:m['published-online'],url:m.URL};
 r.doiMatches=m.DOI.toLowerCase()===r.doi.toLowerCase();
 r.normalizedTitleMatches=m.title.some(t=>norm(t)===norm(r.title));
 r.hasRegistryAuthor=(m.author||[]).length>0;
 r.anyAuthorSurnameMatches=(m.author||[]).some(a=>norm(a.family||a.name)&&norm(r.author).includes(norm(a.family||a.name)));
 r.publicationYearMatches=[m.issued,m.published,m['published-print'],m['published-online']].flatMap(d=>d?.['date-parts']?.map(p=>p[0])||[]).includes(Number(r.date?.slice(0,4)));
 }
 console.log(r.caseId,r.rank,response.status,r.normalizedTitleMatches);
}
audit.retriedAt=new Date().toISOString();await writeFile(url,JSON.stringify(audit,null,2)+'\n');
