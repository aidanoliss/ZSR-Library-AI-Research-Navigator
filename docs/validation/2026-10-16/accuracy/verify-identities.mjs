// Read-only corroboration against Crossref; does not grade relevance or factual claims.
import { readFile, writeFile } from 'node:fs/promises';
const capture = JSON.parse(await readFile(new URL('./live-capture.json', import.meta.url)));
const slots = capture.cases.flatMap(c => c.candidates.slice(0,5).map(s => ({caseId:c.id,...s})));
const norm = s => String(s || '').replace(/<[^>]+>/g,'').replace(/&amp;/g,'and').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
const dois = [...new Set(slots.filter(s=>s.doi).map(s=>s.doi.toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '')))];
const metadata = new Map();
let cursor=0;
async function worker() {
  while(cursor<dois.length) {
    const doi=dois[cursor++];
    const endpoint=`https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    try {
      const response=await fetch(endpoint,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'ZSRNavigatorResearchQualityAudit/1.0'}});
      if(!response.ok) {metadata.set(doi,{endpoint,status:response.status}); continue;}
      const m=(await response.json()).message;
      metadata.set(doi,{endpoint,status:response.status,doi:m.DOI,title:m.title,author:m.author,type:m.type,publisher:m.publisher,containerTitle:m['container-title'],issued:m.issued,published:m.published,publishedPrint:m['published-print'],publishedOnline:m['published-online'],url:m.URL});
    } catch(e) {metadata.set(doi,{endpoint,status:'unverified',error:e.name});}
    await new Promise(resolve=>setTimeout(resolve,400));
  }
}
await Promise.all([worker(),worker()]);
const records=slots.map(s=>{
  if(!s.doi) return {caseId:s.caseId,rank:s.rank,sourceId:s.sourceId,title:s.title,doi:'',status:'no-doi',isbn:s.isbn,url:s.url};
  const m=metadata.get(s.doi.toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, ''));
  const dates=[m.issued,m.published,m.publishedPrint,m.publishedOnline].flatMap(d=>d?.['date-parts']?.map(p=>p[0])||[]);
  const registryAuthors=(m.author||[]).map(a=>norm(a.family||a.name));
  const displayedAuthors=norm(s.author);
  return {caseId:s.caseId,rank:s.rank,sourceId:s.sourceId,title:s.title,author:s.author,date:s.date,doi:s.doi,
    registryStatus:m.status,
    doiMatches:!!m.doi&&m.doi.toLowerCase()===s.doi.toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, ''),
    normalizedTitleMatches:(m.title||[]).some(t=>norm(t)===norm(s.title)),
    hasRegistryAuthor:registryAuthors.length>0,
    anyAuthorSurnameMatches:registryAuthors.some(a=>a&&displayedAuthors.includes(a)),
    publicationYearMatches:dates.includes(Number(s.date?.slice(0,4))),
    registry:m};
});
const output={checkedAt:new Date().toISOString(),method:'All returned top-five slots in the production diagnostic capture. Crossref DOI lookup; exact normalized title matching; author-surname and published-year cross-checks. Variants require manual review. Registry corroboration is not independent full-text validation, peer-review confirmation, relevance, access, or claim accuracy.',totalSlots:slots.length,doiSlots:slots.filter(s=>s.doi).length,uniqueDois:dois.length,records};
await writeFile(new URL('./identity-verification.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({slots:output.totalSlots,doiSlots:output.doiSlots,uniqueDois:output.uniqueDois,registered:records.filter(r=>r.registryStatus===200).length,normalizedTitles:records.filter(r=>r.normalizedTitleMatches).length,authorMatches:records.filter(r=>r.anyAuthorSurnameMatches).length,yearMatches:records.filter(r=>r.publicationYearMatches).length,flags:records.filter(r=>r.doi&&(!r.normalizedTitleMatches||!r.anyAuthorSurnameMatches||!r.publicationYearMatches)).map(r=>({caseId:r.caseId,rank:r.rank,title:r.title,status:r.registryStatus,titleMatch:r.normalizedTitleMatches,authorMatch:r.anyAuthorSurnameMatches,yearMatch:r.publicationYearMatches,registry:r.registry}))},null,2));
