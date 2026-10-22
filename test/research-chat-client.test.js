import test from 'node:test';
import assert from 'node:assert/strict';
import { chatSourceHasAbstract, chatSourceKey, mergeChatSources, normalizeResearchChatReply, normalizeResearchChatSession, researchChatPayload, requestResearchChat, researchChatReplyToText, researchChatToMarkdown, safeChatSourceUrl } from '../src/researchChat.js';
import { NAVIGATOR_ATTRIBUTION, NAVIGATOR_PROTOTYPE_NOTICE } from '../config/navigatorAttribution.js';
import { conversationToMarkdown } from '../src/exportPlan.js';

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
  assert.deepEqual(researchChatPayload({ question: 'Help plan my essay', session: { selectedSourceKeys: ['unknown'] }, sources }).sourceTokens, []);
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

test('only an explicit source-grounded question proposal becomes a new search prompt', async () => {
  const { proposedChatSearchQuestion } = await import('../src/researchChat.js');
  assert.equal(proposedChatSearchQuestion({ text: 'Question to explore: How do sanctions affect trade?' }), 'How do sanctions affect trade?');
  assert.equal(proposedChatSearchQuestion({ text: 'The source discusses sanctions.' }), '');
  assert.equal(proposedChatSearchQuestion({ text: 'Question to explore: https://example.org/unreviewed' }), '');
});


test('planning advice and reviewed search actions persist separately from evidence', () => {
  const reply = normalizeResearchChatReply({ mode: 'planning', status: 'answered', message: 'Here is a plan.', guidance: [{ title: 'Introduction', text: 'Frame an open research question.' }, null, { title: '', text: 'ignored' }], suggestions: ['Help narrow this question', 'Help narrow this question', 'https://untrusted.example'], searchQuestions: ['Sanctions civilian well-being', '<script>bad</script>'], blocks: [] });
  assert.equal(reply.mode, 'planning');
  assert.deepEqual(reply.guidance, [{ title: 'Introduction', text: 'Frame an open research question.' }]);
  assert.deepEqual(reply.suggestions, ['Help narrow this question']);
  assert.deepEqual(reply.searchQuestions, ['Sanctions civilian well-being']);
  const saved = normalizeResearchChatSession({ messages: [{ role: 'assistant', reply }] });
  assert.deepEqual(saved.messages[0].reply, reply);
  const payload = researchChatPayload({ question: 'Expand the introduction', session: saved, sources: [] });
  assert.deepEqual(payload.sourceTokens, []);
  assert.match(payload.messages[0].content, /Introduction: Frame an open research question/);
  assert.deepEqual(normalizeResearchChatReply({ mode: 'evidence', guidance: [{ title: 'Unchecked', text: 'A purported fact' }] }).guidance, []);
});

test('planning sections and suggested actions remain bounded', () => {
  const reply = normalizeResearchChatReply({ mode: 'planning', guidance: Array.from({ length: 12 }, () => ({ title: 'h'.repeat(200), text: 'p'.repeat(2200) })), suggestions: Array.from({ length: 10 }, (_, i) => `Prompt ${i}`), searchQuestions: Array.from({ length: 10 }, (_, i) => `Search ${i}`) });
  assert.equal(reply.guidance.length, 8);
  assert.equal(reply.guidance[0].title.length, 120);
  assert.equal(reply.guidance[0].text.length, 1800);
  assert.equal(reply.suggestions.length, 4);
  assert.equal(reply.searchQuestions.length, 3);
});

test('scope redirects persist without being relabeled as evidence failures or accepting external support links', () => {
  const reply = normalizeResearchChatReply({ mode: 'scope', status: 'redirected', reason: 'library-info', message: 'Check the official hours page.', supportLinks: [{ label: 'ZSR hours', url: 'https://zsr.wfu.edu/hours/' }, { label: 'External', url: 'https://attacker.example/' }, { label: 'Credentials', url: 'https://secret@zsr.wfu.edu/' }, { label: 'Insecure', url: 'http://zsr.wfu.edu/' }], sources: [{ id: 'known', title: 'Known', url: 'https://example.org/' }], blocks: [{ sourceId: 'known', text: 'No evidence should be shown', quote: 'An alleged passage.', scope: 'abstract' }] });
  assert.equal(reply.mode, 'scope'); assert.equal(reply.status, 'redirected'); assert.equal(reply.reason, 'library-info');
  assert.deepEqual(reply.blocks, []);
  assert.deepEqual(reply.supportLinks, [{ label: 'ZSR hours', url: 'https://zsr.wfu.edu/hours/' }]);
  assert.deepEqual(normalizeResearchChatSession({ messages: [{ role: 'assistant', reply }] }).messages[0].reply, reply);
});

test('response copy and chat export preserve quotes and source identities with a separate visible footer', () => {
  const quote = 'Results did not establish causation: the estimate was 7.4%, with uncertainty.';
  const reply = { status: 'answered', mode: 'evidence', message: 'Check the passage.', sources: [{ id: 'one', title: 'A real record title', url: 'https://example.org/study', scope: 'abstract' }], blocks: [{ sourceId: 'one', text: 'A scoped interpretation.', quote, scope: 'abstract' }] };
  const copied = researchChatReplyToText(reply);
  assert.ok(copied.includes(`Supporting passage from the abstract:\n${quote}\n`));
  assert.ok(copied.includes('Source: A real record title\nhttps://example.org/study'));
  assert.ok(copied.indexOf(NAVIGATOR_ATTRIBUTION) > copied.indexOf(quote) + quote.length);
  assert.ok(copied.endsWith(`${NAVIGATOR_PROTOTYPE_NOTICE}\n`));
  const exported = researchChatToMarkdown({ messages: [{ role: 'user', content: 'What is supported?' }, { role: 'assistant', reply }] }, 'Research topic');
  assert.match(exported, /What is supported/); assert.ok(exported.includes(quote));
  assert.equal(exported.split(NAVIGATOR_ATTRIBUTION).length - 1, 1);
  assert.doesNotMatch(exported, /[\u200b\u200c\u200d\u2060\ufeff]/);
});

test('planning copies and research-plan exports include provenance without changing source records', () => {
  const planning = researchChatReplyToText({ mode: 'planning', status: 'answered', guidance: [{ title: 'Opening', text: 'Define the question.' }], blocks: [] });
  assert.match(planning, /Planning guidance — not research findings/);
  assert.match(planning, /Opening\nDefine the question/); assert.ok(planning.includes(NAVIGATOR_ATTRIBUTION));
  const source = { title: 'Exact source title', doi: '10.1234/source', url: 'https://example.org/source' };
  const before = JSON.stringify(source);
  const plan = conversationToMarkdown([{ role: 'assistant', reply: { message: 'Plan your research.' }, liveResults: [source] }]);
  assert.ok(plan.includes(NAVIGATOR_ATTRIBUTION)); assert.ok(plan.includes('10.1234/source'));
  assert.equal(JSON.stringify(source), before);
});

test('conversational coaching persists, enters bounded history, and copies guidance separately from study evidence', () => {
  const reply = normalizeResearchChatReply({ mode: 'coaching', status: 'answered', coachingOrigin: 'gemini', message: 'We can narrow this together.', coaching: [
    { kind: 'advice', text: 'Choose one civilian outcome to investigate.', guideIds: ['questions'] },
    { kind: 'question', text: 'What outcome interests you most?', guideIds: [] },
    { kind: 'explanation', text: 'A focused question identifies what evidence to seek.', guideIds: ['questions'] },
  ], guideReferences: [{ id: 'questions', title: 'Developing a research question', url: 'https://guides.zsr.wfu.edu/research', summary: 'Research question guidance.' }], sources: [{ id: 'paper', title: 'A source record' }], blocks: [{ scope: 'abstract', sourceId: 'paper', quote: 'A source quote.', text: 'A study finding should not render as coaching.' }], suggestions: ['Tell me more about possible outcomes.'], searchQuestions: ['sanctions civilian health'] });
  assert.equal(reply.mode, 'coaching'); assert.equal(reply.coachingOrigin, 'gemini');
  assert.equal(reply.coaching.length, 3); assert.deepEqual(reply.blocks, []);
  const saved = normalizeResearchChatSession({ messages: [{ role: 'user', content: 'I want to research sanctions.' }, { role: 'assistant', reply }] });
  assert.deepEqual(saved.messages.at(-1).reply, reply);
  const payload = researchChatPayload({ question: 'Public health', session: saved, sources: [] });
  assert.deepEqual(payload.sourceTokens, []);
  assert.match(payload.messages.at(-1).content, /What outcome interests you most/);
  const copied = researchChatReplyToText(reply);
  assert.match(copied, /AI research coaching — guidance, not study findings/);
  assert.match(copied, /Research guides supplied for coaching \(not evidence of topic findings\)/);
  assert.match(copied, /https:\/\/guides.zsr.wfu.edu\/research/);
  assert.doesNotMatch(copied, /A study finding should not render/);
  assert.ok(copied.includes(NAVIGATOR_ATTRIBUTION));
});

test('coaching references and blocks reject unsafe, unknown and unbounded data', () => {
  const guides = Array.from({ length: 8 }, (_, i) => ({ id: `guide-${i}`, title: `Guide ${i}`, url: `https://guides.zsr.wfu.edu/guide-${i}`, summary: 's'.repeat(1000) }));
  const reply = normalizeResearchChatReply({ mode: 'coaching', coachingOrigin: 'untrusted', guideReferences: [{ id: 'external', title: 'External', url: 'https://attacker.example/' }, ...guides], coaching: [
    { kind: 'explanation', text: 'Unknown explanation', guideIds: ['external', 'unknown'] },
    { kind: 'claim', text: 'Unknown kind', guideIds: ['guide-0'] },
    { kind: 'advice', text: 'p'.repeat(1600), guideIds: ['guide-0', 'guide-0', 'unknown', 'guide-1', 'guide-2', 'guide-3'] },
    { kind: 'question', text: 'What will you investigate?', guideIds: [] },
    { kind: 'explanation', text: 'A guide-based explanation', guideIds: ['guide-1'] },
    { kind: 'advice', text: 'Beyond the block limit', guideIds: [] },
  ] });
  assert.equal(reply.guideReferences.length, 5);
  assert.equal(reply.guideReferences[0].summary.length, 800);
  assert.equal(reply.coachingOrigin, '');
  assert.equal(reply.coaching.length, 3);
  assert.equal(reply.coaching[0].text.length, 1200);
  assert.deepEqual(reply.coaching[0].guideIds, ['guide-0', 'guide-1', 'guide-2']);
  assert.doesNotMatch(JSON.stringify(reply), /Unknown explanation|Unknown kind|Beyond the block limit|attacker/);
  const evidence = normalizeResearchChatReply({ mode: 'evidence', coaching: [{ kind: 'advice', text: 'Should not render' }], guideReferences: guides });
  assert.deepEqual(evidence.coaching, []); assert.deepEqual(evidence.guideReferences, []);
  assert.match(researchChatReplyToText({ mode: 'coaching', coachingOrigin: 'fallback', coaching: [{ kind: 'advice', text: 'A basic next step.' }] }), /Research planning starter/);
  assert.equal(normalizeResearchChatReply({ mode: 'planning', coachingOrigin: 'fallback' }).coachingOrigin, 'fallback');
});
