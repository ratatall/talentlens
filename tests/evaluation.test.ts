import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precisionAt5, ndcgAt5, scoreComparison, querySetSchema, type ComparisonRun } from '../src/lib/evaluation';
const run:ComparisonRun={version:1,runId:'test-run',createdAt:'2026-09-10',commit:'test-commit',index:'test-index',embeddingModel:'test-model',protocolHash:'protocol',corpusHash:'corpus',embeddingUsdPerMillionTokens:.02,queries:[{id:'q1',split:'holdout',query:'Python services',rubric:'Explicit Python API delivery evidence.',requiredSkills:[],minYears:0,pool:['a','b','c'],keyword:{ids:['a','b'],elapsedMs:10,embeddingTokens:0},hybrid:{ids:['b','c'],elapsedMs:20,embeddingTokens:100}}]};
const judgments=()=>({runId:'test-run',protocolHash:'protocol',corpusHash:'corpus',reviewer:{name:'Test reviewer',kind:'human',independentOfImplementation:true},judgments:[{queryId:'q1',profileId:'a',grade:0,rationale:'No matching evidence.'},{queryId:'q1',profileId:'b',grade:2,rationale:'Direct supporting evidence.'},{queryId:'q1',profileId:'c',grade:1,rationale:'Some adjacent experience.'}]});
test('precision uses a fixed denominator of five, even for short lists',()=>{
  assert.equal(precisionAt5([2,1]),.4);assert.equal(precisionAt5([]),0);
});
test('nDCG rewards correct order and marks all-negative pools undefined',()=>{
  assert.equal(ndcgAt5([2,1,0],[0,1,2]),1);
  assert.ok(ndcgAt5([0,1,2],[0,1,2])!<1);
  assert.equal(ndcgAt5([0,0],[0,0]),null);
});
test('paired scoring reports the observed delta and explicit embedding estimate',()=>{
  const report=scoreComparison(run,judgments());
  assert.equal(report.holdout.keyword.precisionAt5,.2);
  assert.equal(report.holdout.hybrid.precisionAt5,.4);
  assert.equal(report.holdout.precisionAt5Delta,.2);
  assert.equal(report.queryEmbeddingTokens,100);
  assert.ok(Math.abs(report.estimatedQueryEmbeddingUsd!-.000002)<1e-12);
  assert.equal(scoreComparison({...run,embeddingUsdPerMillionTokens:null},judgments()).estimatedQueryEmbeddingUsd,null);
});
test('missing, duplicate, and foreign judgments fail instead of inflating scores',()=>{
  const missing=judgments();missing.judgments.pop();assert.throws(()=>scoreComparison(run,missing),/Complete every/);
  const duplicate=judgments();duplicate.judgments.push(duplicate.judgments[0]);assert.throws(()=>scoreComparison(run,duplicate),/duplicate/);
  const foreign=judgments();foreign.runId='other';assert.throws(()=>scoreComparison(run,foreign),/frozen run/);
});
test('blank or non-independent reviewers and grades cannot become CV metrics',()=>{
  const blank=judgments();blank.reviewer.name='';assert.throws(()=>scoreComparison(run,blank));
  const self=judgments();self.reviewer.independentOfImplementation=false;assert.throws(()=>scoreComparison(run,self));
  const unfinished=judgments();assert.throws(()=>scoreComparison(run,{...unfinished,judgments:unfinished.judgments.map(j=>({...j,grade:null}))}));
});
test('query protocol rejects duplicate IDs',()=>{
  const q=run.queries[0];assert.equal(querySetSchema.safeParse([q,q]).success,false);
});
