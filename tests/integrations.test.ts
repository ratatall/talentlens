import {test} from 'node:test';
import assert from 'node:assert/strict';
import {POST as searchRoute} from '../src/app/api/search/route';
import {POST as interpretRoute} from '../src/app/api/interpret/route';
import {embed,interpretWithLLM} from '../src/lib/provider';
import {openSearch} from '../src/lib/opensearch';
import {searchSchema} from '../src/lib/types';
import {profiles} from '../src/lib/profiles';
const request=(body:unknown,origin='http://localhost:3000')=>new Request('http://localhost:3000/api/search',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
test('HTTP routes reject cross-origin and malformed input',async()=>{
  assert.equal((await searchRoute(request({query:'Python'},'https://other.example'))).status,400);
  assert.equal((await searchRoute(request({query:'Python',minYears:'five'}))).status,400);
  assert.equal((await searchRoute(request({query:'x'.repeat(17000)}))).status,400);
});
test('route returns bounded, source-backed demo results',async()=>{
  const original=process.env.SEARCH_BACKEND;process.env.SEARCH_BACKEND='demo';
  try{const res=await searchRoute(request({query:'Python',requiredSkills:['Python']}));assert.equal(res.status,200);const data=await res.json();assert.ok(data.results.length>0&&data.results.length<=50);assert.equal(data.backend,'demo');assert.ok(data.results.every((m:{profile:{skills:string[]}})=>m.profile.skills.includes('Python')));}
  finally{if(original===undefined)delete process.env.SEARCH_BACKEND;else process.env.SEARCH_BACKEND=original;}
});
test('interpretation remains explicitly rule-based without credentials',async()=>{
  const old=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
  try{const res=await interpretRoute(request({query:'React 3+ years'}));const data=await res.json();assert.equal(data.interpreter,'Rule-based');assert.deepEqual(data.criteria.requiredSkills,['React']);assert.equal(data.criteria.minYears,3);}
  finally{if(old!==undefined)process.env.OPENAI_API_KEY=old;}
});
test('provider contract validates vectors and handles refusal/error',async()=>{
  const oldKey=process.env.OPENAI_API_KEY;const oldFetch=global.fetch;process.env.OPENAI_API_KEY='test-only';
  try{
    global.fetch=async()=>Response.json({data:[{index:0,embedding:Array(512).fill(0.5)}],usage:{total_tokens:12}});
    assert.equal((await embed(['synthetic text'])).tokens,12);
    global.fetch=async()=>Response.json({data:[{index:0,embedding:[1]}]});await assert.rejects(()=>embed(['x']),/invalid vector/);
    global.fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({requiredSkills:['Python'],minYears:3,summary:'Python, 3+ years'})}]}]});
    assert.equal((await interpretWithLLM('Python 3+ years')).minYears,3);
    global.fetch=async()=>Response.json({output:[{content:[{type:'refusal'}]}]});await assert.rejects(()=>interpretWithLLM('x'),/did not return/);
    global.fetch=async()=>new Response('',{status:429});await assert.rejects(()=>embed(['x']),/429/);
  }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
});
test('OpenSearch hybrid applies identical filters to both retrieval branches',async()=>{
  const oldKey=process.env.OPENAI_API_KEY;const oldIndex=process.env.OPENSEARCH_INDEX;const oldFetch=global.fetch;process.env.OPENAI_API_KEY='test-only';process.env.OPENSEARCH_INDEX='contract-test';
  const searches:Record<string,unknown>[]=[];
  try{
    global.fetch=async(url,options)=>{
      const address=String(url);
      if(address.includes('/embeddings'))return Response.json({data:[{index:0,embedding:Array(512).fill(0.1)}],usage:{total_tokens:4}});
      if(address.endsWith('/_mapping'))return Response.json({'contract-test':{mappings:{_meta:{hasEmbeddings:true,embeddingModel:process.env.EMBEDDING_MODEL||'text-embedding-3-small'}}}});
      searches.push(JSON.parse(String(options?.body)));
      return Response.json({hits:{total:{value:1},hits:[{_id:profiles[0].id,_score:1,_source:profiles[0]}]}});
    };
    const r=await openSearch(searchSchema.parse({query:'Python',mode:'hybrid',requiredSkills:['Python'],minYears:3,excludedIds:['tl-999']}));
    assert.equal(searches.length,2);assert.equal(r.hits.length,1);assert.equal(r.tokens,4);
    const lexical=searches[0] as {query:{bool:{filter:unknown[]}}};
    const vector=searches[1] as {query:{knn:{embedding:{filter:{bool:{filter:unknown[]}}}}}};
    assert.deepEqual(lexical.query.bool.filter,vector.query.knn.embedding.filter.bool.filter);
    assert.ok(JSON.stringify(lexical).includes('tl-999'));
  }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;if(oldIndex===undefined)delete process.env.OPENSEARCH_INDEX;else process.env.OPENSEARCH_INDEX=oldIndex;}
});
