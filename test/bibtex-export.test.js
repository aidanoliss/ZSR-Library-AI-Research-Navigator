import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeBibtex,escapeBibtexText,safeBibtexFilename,downloadBibtex} from '../src/bibtex.js';

test('BibTeX exports supplied article fields and author names with protected title case',()=>{
 const bib=serializeBibtex({title:'AI & DNA research',type:'article',authors:[{given:'Ada',family:'Lovelace'},'Smith, Alex'],date:'2025-02-03',containerTitle:'Journal of Testing',volume:'8',issue:'2',pages:'17–29',doi:'https://doi.org/10.1234/test',url:'https://example.org/a_b?x=1&y=2'});
 assert.match(bib,/^@article\{[A-Za-z0-9]+,/);assert.match(bib,/title = \{\{AI \\& DNA research\}\}/);
 assert.match(bib,/author = \{Lovelace, Ada and Smith, Alex\}/);assert.match(bib,/year = \{2025\}/);assert.match(bib,/journal = \{Journal of Testing\}/);assert.match(bib,/number = \{2\}/);assert.match(bib,/pages = \{17--29\}/);assert.match(bib,/doi = \{10.1234\/test\}/);assert.match(bib,/url = \{https:\/\/example.org\/a_b\?x=1&y=2\}/);
});
test('books, chapters, conference papers and unknown types use compatible entry types',()=>{
 for(const [type,expected] of [['book','book'],['book chapter','incollection'],['conference paper','inproceedings'],['dataset','misc']]) {
  const bib=serializeBibtex({title:'Test',type,containerTitle:'Collected volume',publisher:'A Press',edition:'Second',isbn:'123',publicationYear:2024});
  assert.ok(bib.startsWith(`@${expected}{`));if(expected==='incollection'||expected==='inproceedings')assert.match(bib,/booktitle = \{Collected volume\}/);
  if(expected==='book')assert.doesNotMatch(bib,/journal|booktitle/);
 }
});
test('missing fields stay missing; different editions remain distinct; equivalent DOIs deduplicate',()=>{
 const bib=serializeBibtex([{title:'Only a title'},{title:'Another',doi:'10.1234/test'},{title:'Duplicate',doi:'https://doi.org/10.1234/TEST'}]);
 assert.equal((bib.match(/^@/gm)||[]).length,2);assert.doesNotMatch(bib,/Duplicate|author =|year =|publisher =/);
 const editions=serializeBibtex([{title:'Book',type:'book',edition:'First'},{title:'Book',type:'book',edition:'Second'}]);assert.equal((editions.match(/^@book/gm)||[]).length,2);
 const keys=[...editions.matchAll(/^@\w+\{([^,]+)/gm)].map(m=>m[1]);assert.equal(new Set(keys).size,2);
});
test('identity warnings and evidence notes remain in exported metadata',()=>{
 const bib=serializeBibtex({title:'Check this title',doi:'10.1234/test',identityCheck:{status:'title-difference',registryTitle:'Different registry title',detail:'DOI title discrepancy.'},is_retracted:true});
 assert.match(bib,/note = /);assert.match(bib,/Different registry title|discrepancy/i);assert.match(bib,/retract/i);
});
test('corporate author literals retain braces and are not merged with a different organization',()=>{
 const bib=serializeBibtex([{title:'Report',authors:[{literal:'World Health Organization'}]},{title:'Report',authors:[{literal:'Other Organization'}]}]);
 assert.match(bib,/author = \{\{World Health Organization\}\}/);assert.equal((bib.match(/^@/gm)||[]).length,2);
});
test('metadata cannot inject BibTeX entries or active TeX control sequences',()=>{
 const hostile='50% {AI} \\input{secret} $money #id _x ~ ^ &';
 assert.equal(escapeBibtexText(hostile),'50\\% \\{AI\\} {\\textbackslash{}}input\\{secret\\} \\$money \\#id \\_x {\\textasciitilde{}} {\\textasciicircum{}} \\&');
 const bib=serializeBibtex({title:'Name\n}\n@article{injected',url:'https://example.org/}\\input{secret}',doi:'10.1234/}\\input{x}'});
 assert.equal((bib.match(/^@/gm)||[]).length,1);assert.doesNotMatch(bib,/\\input\{/);assert.match(bib,/%7D%5Cinput%7B/);
});
test('BibTeX filenames and server-side download behavior are bounded',()=>{
 assert.equal(safeBibtexFilename('Café / test.bib'),'Cafe-test.bib');assert.equal(safeBibtexFilename('../../'),'research-sources.bib');assert.ok(safeBibtexFilename('x'.repeat(200)).length<=104);assert.equal(downloadBibtex([{title:'A source'}]),false);assert.equal(serializeBibtex([]),'');
});
