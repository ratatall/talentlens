import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openSearch,osRequest,indexName} from '../src/lib/opensearch';
import {searchSchema} from '../src/lib/types';
const live=process.env.RUN_OPENSEARCH_TESTS==='1';
test('live OpenSearch contains the complete synthetic corpus',{skip:!live},async()=>{
  const result=await osRequest(`${indexName()}/_count`,undefined,'GET');assert.equal(result.count,360);
});
test('live BM25 respects exact skill, experience and exclusion filters',{skip:!live},async()=>{
  const input=searchSchema.parse({query:'Python data pipelines',requiredSkills:['Python','Kafka'],minYears:5});
  const result=await openSearch(input);assert.ok(result.hits.length>0);
  assert.ok(result.hits.every(h=>h._source.skills.includes('Python')&&h._source.skills.includes('Kafka')&&h._source.years>=5));
  const id=result.hits[0]._id;const excluded=await openSearch({...input,excludedIds:[id]});assert.ok(excluded.hits.every(h=>h._id!==id));
  const empty=await openSearch({...input,requiredSkills:['COBOL']});assert.equal(empty.hits.length,0);
});

test('live hybrid retrieval executes filtered k-NN and RRF with fixed test vectors', { skip: !live }, async () => {
  const { randomUUID } = await import('node:crypto');
  const { indexDefinition } = await import('../src/lib/index-definition');
  const { profiles } = await import('../src/lib/profiles');
  const oldIndex = process.env.OPENSEARCH_INDEX;
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = global.fetch;
  const fixtureIndex = `talentlens-test-${randomUUID()}`;
  const vector = (axis: number) => Array.from({ length: 512 }, (_, i) => i === axis ? 1 : 0);
  let created = false;
  try {
    process.env.OPENSEARCH_INDEX = fixtureIndex;
    process.env.OPENAI_API_KEY = 'test-fixture-only';
    const definition = indexDefinition();
    definition.mappings._meta.hasEmbeddings = true;
    await osRequest(fixtureIndex, definition, 'PUT');
    created = true;
    const docs = [
      { ...profiles[0], id: 'lexical', skills: ['Python'], years: 8, title: 'needlelexical engineer', summary: 'Python APIs', experience: ['Python APIs'], embedding: vector(1) },
      { ...profiles[0], id: 'semantic', skills: ['Python'], years: 8, title: 'Service developer', summary: 'Web services', experience: ['Web services'], embedding: vector(0) },
      { ...profiles[0], id: 'ineligible', skills: ['Java'], years: 1, embedding: vector(0) },
    ];
    const bulk = docs.flatMap(doc => [JSON.stringify({ index: { _index: fixtureIndex, _id: doc.id } }), JSON.stringify(doc)]).join('\n') + '\n';
    const seeded = await osRequest('_bulk?refresh=wait_for', bulk, 'POST', true);
    assert.equal(seeded.errors, false);
    global.fetch = async (url, options) => String(url) === 'https://api.openai.com/v1/embeddings'
      ? Response.json({ data: [{ index: 0, embedding: vector(0) }], usage: { total_tokens: 1 } })
      : oldFetch(url, options);
    const input = searchSchema.parse({ query: 'needlelexical', mode: 'hybrid', requiredSkills: ['Python'], minYears: 5 });
    const baseline = await openSearch({...input, mode: 'keyword'});
    assert.deepEqual(baseline.hits.map(hit=>hit._id), ['lexical']);
    const result = await openSearch(input);
    assert.equal(result.hits.length, 2);
    assert.ok(result.hits.every(hit => hit._id !== 'ineligible'));
    assert.ok(result.hits.some(hit => hit._id === 'semantic'));
    assert.ok(result.hits.every(hit => hit._score > 0 && hit._score < 1));
    const excluded = await openSearch({ ...input, excludedIds: ['semantic'] });
    assert.deepEqual(excluded.hits.map(hit => hit._id), ['lexical']);
  } finally {
    global.fetch = oldFetch;
    if (created) await osRequest(fixtureIndex, undefined, 'DELETE');
    if (oldIndex === undefined) delete process.env.OPENSEARCH_INDEX; else process.env.OPENSEARCH_INDEX = oldIndex;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  }
});
