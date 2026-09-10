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
