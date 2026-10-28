import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('capture.json',import.meta.url)));
// Manual model/evaluator judgments after reading captured titles, abstracts and complete requests.
// Never populate fields named humanJudgment or use these as independent human accuracy.
const judgments={
'sanctions-comparison':[
['candidate-match','Abstract explicitly compares authoritarian and democratic responses to sanctions using cases.'],
['candidate-match','Abstract tests autocratic type/democratic openness and sanctions effectiveness, including hybrid regimes.'],
['partial','Studies sender targeting of authoritarian states, not effects on democratic vs authoritarian target regimes.'],
['partial','Authoritarian regime outcomes only; useful background, not the requested contrast.'],
['partial','Sender selection and targets, not democratic vs authoritarian recipient outcomes.']],
'population-geography-method':[['wrong-constraint','Returned meta-analysis, not a randomized controlled trial; mixed undergraduate/graduate and multinational studies.']],
'historical-period':[
['partial','Main scope late1940s/1950s after WWII; some1944 context, not chiefly1939–45.'],
['wrong-constraint','Abstract explicitly studies WWI via a novel; requested WWII1939–45.'],
['wrong-constraint','Title and abstract explicitly First World War, not WWII.'],
['partial','Relevant wartime women workers, but book chapter rather than requested peer-reviewed article; peer review unresolved.'],
['partial','Apparent alternate version/edition of rank4 chapter; format/peer-review mismatch remains.']],
'humanities-books':[['candidate-match','Publisher description covers contemporary African American writers/satire, identity and historical memory; broad interdisciplinary coverage.']],
'known-book':[
['candidate-match','Requested title and author; 2015 manifestation.'],
['candidate-match','Requested title and author; 1990 manifestation, should be grouped as another edition.'],
['wrong-constraint','Different book/author; correctly labeled related work by system but not the requested known item.']],
'nursing-review':[
['partial','Review/meta-analysis of nurse-led telemonitoring vs usual care/readmissions, but adults overall, not established older-adult population.'],
['partial','Systematic review of nurse-led care/usual care; primary outcome self-care, not requested readmission, and mixed adult age.']],
'science-review':[
['candidate-match','Abstract explicitly systematic review of offshore wind and marine biodiversity. Future issue date needs clearer date treatment, not evidence of fabrication.'],
['uncertain','Topic matches; no abstract to establish systematic-review method.'],
['wrong-constraint','Abstract describes integrated environmental monitoring data, not systematic review.'],
['wrong-constraint','Abstract describes original eDNA sampling/metagenomics study, not systematic review.'],
['partial','Explicitly semi-systematic review with different methodology; useful adjacent evidence, not interchangeable with requested systematic review.']],
'geography-method':[
['partial','Qualitative/interviews in Bangladesh established; women mentioned in impacts but no women-specific sampling established.'],
['uncertain','Women migration/coastal Bangladesh in title, but absent abstract leaves interview method unresolved.'],
['partial','Qualitative gender comparison in Bangladesh; interview collection not established in available abstract.'],
['partial','Interviews/Bangladesh included, but women evidence sentence is about Burkina Faso, not Bangladesh.']]
};
const records=[];
for(const c of data.cases)for(const [i,s] of (c.sources||[]).slice(0,5).entries()){const [judgment,reason]=judgments[c.id][i];records.push({caseId:c.id,rank:i+1,title:s.title,doi:s.doi||null,url:s.url,judgment,reason,evaluator:'AI model; not an independent librarian or human reviewer',basis:'Captured provider title and abstract/description; targeted independent identity checks, not full-text claim validation'})}
const totals=Object.fromEntries(['candidate-match','partial','wrong-constraint','uncertain'].map(k=>[k,records.filter(r=>r.judgment===k).length]));
const nonControl=data.cases.filter(c=>c.id!=='negative-known-item');
const summary={evaluatedAt:new Date().toISOString(),warning:'Not an accuracy rate. Small purposive adversarial sample, metadata-based model judgments, no human panel, no model-generated claim audit.',positiveQueries:nonControl.length,nonemptyPositiveQueries:nonControl.filter(c=>c.sources?.length).length,fiveOrMorePositiveQueries:nonControl.filter(c=>c.sources?.length>=5).length,totalRecords:data.cases.reduce((n,c)=>n+(c.sources?.length||0),0),reviewedTopFive:records.length,totals,queryWithCandidateMatch:nonControl.filter(c=>records.some(r=>r.caseId===c.id&&r.judgment==='candidate-match')).length,providerFailures:data.cases.flatMap(c=>Object.values(c.outcomes||{}).flat()).filter(o=>['error','timeout','cancelled','rate_limited'].includes(o.status)).length,latencyRangeMs:[Math.min(...data.cases.map(c=>c.elapsedMs)),Math.max(...data.cases.map(c=>c.elapsedMs))]};
await writeFile(new URL('model-review.json',import.meta.url),JSON.stringify({summary,records},null,2));console.log(JSON.stringify(summary));
