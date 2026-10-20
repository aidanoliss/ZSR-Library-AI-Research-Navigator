import test from 'node:test';
import assert from 'node:assert/strict';
import { chatSourceHasAbstract, chatSourceKey, mergeChatSources, normalizeResearchChatReply, normalizeResearchChatSession, researchChatPayload, requestResearchChat, safeChatSourceUrl } from '../src/researchChat.js';

const source = (id, extra = {}) => ({ evidenceId: id, title: `Source ${id}`, url: `https://example.org/${id}`, researchChatToken: `signed-${id}`, abstractText: 'The provider supplied an abstract excerpt for the selected source.', ...extra });

test('only signed Navigator records become selectable and fresh duplicate comes first', () => {
  const fresh = source('one');
  const records = mergeChatSources([fresh, { title: 'Student invention', url: 'https://example.org/invented', abstractText: 'An assertion' }], [{ kind: 'catalog', sourceRecord: source('one', { researchChatToken: 'old' }) }, { sourceRecord: source('two') }]);
  assert.equal(records.length, 2);
  assert.equal(records[0].researchChatToken, 'signed-one');
  assert.equal(chatSourceKey(records[1]), 'two');
  assert.equal(mergeChatSources([source('bad', { researchChatToken: 'x'.repeat(12001) })]).length, 0);
  assert.equal(chatSourceHasAbstract(source('metadata', { researchChatScope: 'metadata' })), false);
  assert.equal(chatSourceHasAbstract(source('abstract', { researchChatScope: 'abstract' })), true);
  assert.deepEqual(mergeChatSources([null, {}, false, 'malformed']), []);
  assert.equal(normalizeResearchChatReply({ sources: [null], blocks: [null] }).blocks.length, 0);
  assert.equal(normalizeResearchChatSession(null).messages.length, 0);
});

test('chat payload transmits selected server tokens without abstracts, notes, or other saved sources', () => {
  const sources = [source('one', { notes: 'Private notebook', evidenceNotes: ['private'] }), source('two')];
  const payload = researchChatPayload({ question: 'What do these records establish?', session: { selectedSourceKeys: ['one'], messages: [{ role: 'user', content: 'Earlier question' }] }, sources, topic: 'Research topic' });
  assert.deepEqual(payload.sourceTokens, ['signed-one']);
  assert.equal(payload.question, 'What do these records establish?');
  assert.equal(payload.messages.length, 1);
  assert.doesNotMatch(JSON.stringify(payload), /Private notebook|provider supplied|signed-two|private/);
  assert.throws(() => researchChatPayload({ question: 'What?', session: { selectedSourceKeys: ['unknown'] }, sources }), /Attach at least one/);
  assert.throws(() => researchChatPayload({ question: ' ', session: { selectedSourceKeys: ['one'] }, sources }), /Enter a question/);
  assert.equal(researchChatPayload({ question: 'What?', session: { selectedSourceKeys: ['one'], includeAssignment: false }, sources, assignmentContext: 'Student chose to omit this brief.' }).assignmentContext, '');
});

test('selection and history are bounded while draft spacing and checked citations survive persistence', () => {
  const reply = { status: 'answered', message: 'A bounded response.', sources: [{ id: 'one', title: 'Source one', url: 'https://example.org/one', scope: 'abstract' }], blocks: [{ text: 'AI interpretation', sourceId: 'one', quote: 'The exact supporting passage.', scope: 'abstract' }] };
  const draft = 'A question about ';
  const saved = normalizeResearchChatSession({ draft, selectedSourceKeys: ['one', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'], messages: [...Array.from({ length: 28 }, (_, i) => ({ role: 'user', content: `Question ${i}` })), { role: 'assistant', reply }] });
  assert.equal(saved.draft, draft);
  assert.equal(saved.messages.length, 24);
  assert.equal(saved.selectedSourceKeys.length, 6);
  assert.equal(saved.messages.at(-1).reply.blocks[0].quote, 'The exact supporting passage.');
  assert.equal(saved.messages.at(-1).reply.blocks[0].source.url, 'https://example.org/one');
  assert.equal(normalizeResearchChatSession({ draft: 'x'.repeat(3000) }).draft.length, 2000);
});

test('unknown citations and unsafe source links cannot render as source evidence', () => {
  const reply = normalizeResearchChatReply({ status: 'answered', sources: [{ id: 'known', title: 'Known source', url: 'javascript:alert(1)' }], blocks: [{ text: 'Unknown claim', sourceId: 'invented', quote: 'A purported passage', scope: 'abstract' }, { text: 'Metadata cannot be abstract evidence', sourceId: 'known', quote: 'A passage', scope: 'fulltext' }, { text: 'A checked interpretation', sourceId: 'known', quote: 'Known supporting passage', scope: 'abstract' }] });
  assert.equal(reply.blocks.length, 1);
  assert.equal(reply.blocks[0].source.url, '');
  for (const url of ['http://example.org/', 'javascript:alert(1)', 'https://secret@example.org/']) assert.equal(safeChatSourceUrl(url), '');
  assert.equal(safeChatSourceUrl('https://example.org/source'), 'https://example.org/source');
});

test('source selection and transmitted prior context stay bounded', () => {
  const sources = Array.from({ length: 10 }, (_, i) => source(String(i)));
  const payload = researchChatPayload({ question: 'q'.repeat(3000), sources, session: { selectedSourceKeys: sources.map(chatSourceKey), messages: Array.from({ length: 24 }, () => ({ role: 'user', content: 'h'.repeat(3000) })) }, assignmentContext: 'b'.repeat(4000), topic: 't'.repeat(3000) });
  assert.equal(payload.sourceTokens.length, 6);
  assert.equal(payload.messages.length, 6);
  assert.equal(payload.messages.reduce((total, message) => total + message.content.length, 0), 12000);
  assert.equal(payload.messages[0].content.length, 2000);
  assert.equal(payload.assignmentContext.length, 3000);
  assert.equal(payload.question.length, 2000);
  assert.equal(payload.topic.length, 2000);
});

test('HTTP errors preserve a clear re-search route and provider replies are normalized', async () => {
  await assert.rejects(requestResearchChat({}, { fetchImpl: async () => ({ ok: false, status: 410, json: async () => ({ error: 'Attached records expired. Search again.' }) }) }), /expired/);
  await assert.rejects(requestResearchChat({}, { fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }) }), /busy/);
  const reply = await requestResearchChat({}, { fetchImpl: async (url, options) => { assert.equal(url, '/api/research-chat'); assert.equal(options.credentials, 'same-origin'); return { ok: true, json: async () => ({ status: 'insufficient_evidence', message: 'No usable abstracts.', sources: [], blocks: [] }) }; } });
  assert.equal(reply.status, 'insufficient_evidence');
  assert.equal(reply.message, 'No usable abstracts.');
});
