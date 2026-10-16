import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchDiscoveryJson } from '../server/discoveryOutcome.js';
import { searchSourceCandidates } from '../server/primo.js';
import { extractDoiIdentifier } from '../config/sourceIdentifiers.js';
import { extractDoi as linkDoi } from '../config/libraryLinks.js';
import { extractDoi as planDoi } from '../config/researchAgent.js';
import { compareRegistryIdentity, checkSourceIdentities } from '../server/sourceIdentityCheck.js';
import { normalizePrimoDocs } from '../server/primo.js';

const response = (data) => ({ ok: true, status: 200, json: async () => data });
test('a stalled response body retries once and succeeds inside the original budget', async () => {
  let attempts = 0;
  const retries = [];
  const result = await fetchDiscoveryJson('https://example.org', {}, { timeoutMs: 160, onRetry: r => retries.push(r), fetchImpl: async () => ++attempts === 1 ? { ok: true, json: () => new Promise(() => {}) } : response({docs: [1]}) });
  assert.equal(attempts, 2);
  assert.deepEqual(result.data.docs, [1]);
  assert.equal(retries[0].reason, 'TIMEOUT');
});
test('a transport ignoring abort cannot stall indefinitely and cancellation never retries', async () => {
  const start = Date.now();
  await assert.rejects(fetchDiscoveryJson('https://example.org', {}, { timeoutMs: 100, fetchImpl: () => new Promise(() => {}) }), {name:'TimeoutError'});
  assert.ok(Date.now() - start < 600);
  const controller = new AbortController();
  let calls = 0;
  const pending = fetchDiscoveryJson('https://example.org', {}, {signal:controller.signal, timeoutMs:500, fetchImpl: () => { calls++; return new Promise(() => {}); }});
  controller.abort();
  await assert.rejects(pending, {name:'AbortError'});
  assert.equal(calls, 1);
});
test('rate limits and permanent failures do not trigger an immediate retry storm', async () => {
  for (const status of [401,403,404,429]) {
    let calls = 0;
    const result = await fetchDiscoveryJson('https://example.org', {}, {timeoutMs:200, fetchImpl:async()=>{calls++;return {ok:false,status,headers:{get:()=>status===429?'60':null}};}});
    assert.equal(result.response.status,status);assert.equal(calls,1);
  }
});
test('a transient book-provider timeout recovers instead of becoming a false empty search', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  const outcomes = [];
  globalThis.fetch = async () => ++calls === 1 ? new Promise(() => {}) : response({docs:[{pnx:{control:{recordid:['recovered']},display:{title:['Governing the Commons'],creator:['Elinor Ostrom'],type:['book']},addata:{}}}]});
  try {
    const spec = {mode:'books',knownItem:{kind:'book',title:'Governing the Commons',author:'Elinor Ostrom'},concepts:[]};
    const result = await searchSourceCandidates(['Governing the Commons'],1,'books',{timeoutMs:160,discoveryBudgetMs:500,researchSpec:spec,onOutcome:o=>outcomes.push(o)});
    assert.equal(result.length,1);assert.equal(result[0].matchExplanation.identity.status,'exact');
    assert.ok(outcomes.some(o=>o.status==='retrying'));assert.ok(outcomes.some(o=>o.status==='success'));
    assert.ok(!outcomes.some(o=>o.status==='empty'));
  } finally { globalThis.fetch = original; }
});
test('DOI parsing preserves balanced suffixes across catalog, plan and access links', () => {
  const doi='10.4335/12.1.145-162(2014)';
  for (const extract of [extractDoiIdentifier,linkDoi,planDoi]) {
    for(const text of [doi,`(${doi}).`,`https://doi.org/${encodeURIComponent(doi)}`,`doi: ${doi};`]) assert.equal(extract(text),doi,text);
    assert.equal(extract('10.5555/example)'), '10.5555/example');
    assert.equal(extract('10.5555/example(2020'), '10.5555/example(2020');
  }
  const results=normalizePrimoDocs({docs:[{pnx:{control:{recordid:['doi-case']},display:{title:['Electoral systems and turnout'],type:['article']},addata:{doi:[doi]}}}]},{query:'electoral systems turnout'});
  assert.equal(results[0].doi,doi);
});
test('registry corroboration distinguishes title differences from invented publications', async () => {
  const source={doi:'10.4335/12.1.145-162(2014)',title:'New Zealand General Elections'};
  const registry={DOI:source.doi,title:['New Zealand Local Elections']};
  assert.equal(compareRegistryIdentity(source,registry).status,'title-difference');
  assert.equal(compareRegistryIdentity({...source,title:registry.title[0]},registry).status,'title-matched');
  assert.equal(compareRegistryIdentity(source,{...registry,DOI:'10.5555/other'}).status,'unverified');
  const checked=await checkSourceIdentities([source],{fetchImpl:async()=>response({message:registry})});
  assert.equal(checked[0].title,source.title,'never silently overwrite the provider title');
  assert.equal(checked[0].identityCheck.registryTitle,registry.title[0]);
});
