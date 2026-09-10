import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profiles } from '../src/lib/profiles';
import { demoSearch, interpretLocally, containsSkill, reciprocalRankFusion } from '../src/lib/ranking';
import { searchSchema } from '../src/lib/types';
import { search } from '../src/lib/search';
const input = (overrides={})=>searchSchema.parse({query:'Python data pipelines',...overrides});
test('fixture has 360 unique profiles and source attribution',()=>{
  assert.equal(profiles.length,360);assert.equal(new Set(profiles.map(p=>p.id)).size,360);assert.equal(new Set(profiles.map(p=>p.name)).size,360);assert.ok(profiles.every(p=>p.source&&p.experience.length));
});
test('hard filters and exclusions never leak ineligible results',()=>{
  const result=demoSearch(input({requiredSkills:['Python','Kafka'],minYears:5,excludedIds:['tl-001']}));
  assert.ok(result.length>0);assert.ok(result.every(m=>m.profile.skills.includes('Python')&&m.profile.skills.includes('Kafka')&&m.profile.years>=5&&m.profile.id!=='tl-001'));
});
test('unsupported requirements and nonsense return empty results',()=>{
  assert.equal(demoSearch(input({requiredSkills:['COBOL']})).length,0);assert.equal(demoSearch(input({query:'zzzxxyyqq'})).length,0);
});
test('every explanation is an exact excerpt from its source profile',()=>{
  for(const match of demoSearch(input({prioritySkills:['Kafka','Kotlin']}))){
    for(const e of match.evidence) assert.ok(match.profile.experience.includes(e.excerpt)||match.profile.skills.join(', ')===e.excerpt);
    assert.ok(match.missing.includes('Kotlin')||match.evidence.some(e=>e.skill==='Kotlin'));
  }
});
test('explicit feedback changes ranking while preserving hard filters',()=>{
  const baseline=demoSearch(input({query:'Python',requiredSkills:['Python']}));
  const refined=demoSearch(input({query:'Python',requiredSkills:['Python'],prioritySkills:['SQS']}));
  assert.notEqual(baseline[0].profile.id,refined[0].profile.id);assert.ok(refined[0].profile.skills.includes('SQS'));
});
test('skill boundaries prevent Go matching Django or ML matching HTML',()=>{
  assert.equal(containsSkill('Django','Go'),false);assert.equal(containsSkill('HTML','ML'),false);assert.equal(containsSkill('Next.js engineer','Next.js'),true);
});
test('local parser handles explicit skills and minimum years',()=>{
  const c=interpretLocally('React and TypeScript engineers with 3+ years');assert.deepEqual(c.requiredSkills,['React','TypeScript']);assert.equal(c.minYears,3);
});
test('RRF merges overlaps without double-counting results',()=>{
  const result=reciprocalRankFusion([[{id:'a',score:20},{id:'b',score:10}],[{id:'b',score:1},{id:'c',score:.5}]]);assert.equal(result[0].id,'b');assert.equal(result.length,3);
});
test('invalid or oversized API inputs are rejected',()=>{
  for(const bad of [{query:''},{query:'x'.repeat(1001)},{query:'Python',minYears:-1},{query:'Python',requiredSkills:Array(13).fill('Go')}])assert.equal(searchSchema.safeParse(bad).success,false);
});
test('demo mode never claims semantic retrieval',async()=>{
  const original=process.env.SEARCH_BACKEND;process.env.SEARCH_BACKEND='demo';
  try {const r=await search(input());assert.equal(r.backend,'demo');await assert.rejects(()=>search(input({mode:'hybrid'})),/requires OpenSearch/);}
  finally{if(original===undefined)delete process.env.SEARCH_BACKEND;else process.env.SEARCH_BACKEND=original;}
});
