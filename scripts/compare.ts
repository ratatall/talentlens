import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { search } from '../src/lib/search';
import { profiles } from '../src/lib/profiles';
import { searchSchema } from '../src/lib/types';
import { indexName, osRequest } from '../src/lib/opensearch';
import { digest, querySetSchema, scoreComparison, type ComparisonRun, type Ranking } from '../src/lib/evaluation';
const [command,...args]=process.argv.slice(2);
if(command==='collect'){
  if(process.env.SEARCH_BACKEND!=='opensearch'||!process.env.OPENAI_API_KEY)throw new Error('Collection requires OpenSearch, a seeded embedding index, and OPENAI_API_KEY. No provider requests made.');
  const queries=querySetSchema.parse(JSON.parse(await readFile('evaluation/queries.json','utf8')));
  const mapping=await osRequest(`${indexName()}/_mapping`,undefined,'GET');
  if(!mapping[indexName()]?.mappings?._meta?.hasEmbeddings)throw new Error('Seed a new index with --embeddings before collecting.');
  const model=process.env.EMBEDDING_MODEL||'text-embedding-3-small';
  if(mapping[indexName()].mappings._meta.embeddingModel!==model)throw new Error('Index embedding model does not match the configured model.');
  const snapshot=await osRequest(`${indexName()}/_search`,{size:1000,track_total_hits:true,_source:{excludes:['embedding']},query:{match_all:{}}});
  const actual=snapshot.hits.hits.map((h:{_source:typeof profiles[number]})=>h._source).sort((a:typeof profiles[number],b:typeof profiles[number])=>a.id.localeCompare(b.id));
  if(snapshot.hits.total.value!==profiles.length||digest(actual)!==digest(profiles))throw new Error('The index does not match the frozen synthetic corpus. Seed the current source into a fresh index.');
  const rateText=process.env.EMBEDDING_USD_PER_MILLION_TOKENS;
  const rate=rateText?Number(rateText):null;
  if(rate!==null&&(!Number.isFinite(rate)||rate<0))throw new Error('Embedding price must be a nonnegative number.');
  if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw new Error('Commit evaluation changes before collection so the run is reproducible.');
  const directory=resolve(args[0]||`evaluation/runs/${randomUUID()}`);
  await mkdir(directory,{recursive:false}).catch(async(error:NodeJS.ErrnoException)=>{if(error.code==='ENOENT'){await mkdir(resolve(directory,'..'),{recursive:true});await mkdir(directory);}else throw error;});
  const run:ComparisonRun={version:1,runId:randomUUID(),createdAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),index:indexName(),embeddingModel:model,protocolHash:digest(queries),corpusHash:digest(profiles),embeddingUsdPerMillionTokens:rate,queries:[]};
  const reviewers=[];
  const blankJudgments: {queryId:string;profileId:string;grade:null;rationale:string}[]=[];
  for(const [i,q] of queries.entries()){
    const rankings:Partial<Record<'keyword'|'hybrid',Ranking>>={};
    // Alternate order to reduce systematic warm-cache bias; no interpretation differences between modes.
    const order:('keyword'|'hybrid')[]=i%2?['hybrid','keyword']:['keyword','hybrid'];
    for(const mode of order){
      const result=await search(searchSchema.parse({query:q.query,requiredSkills:q.requiredSkills,minYears:q.minYears,mode}));
      rankings[mode]={ids:result.results.slice(0,5).map(m=>m.profile.id),elapsedMs:result.elapsedMs,embeddingTokens:result.usage.embeddingTokens};
    }
    const pool=[...new Set([...rankings.keyword!.ids,...rankings.hybrid!.ids])].sort((a,b)=>digest(`${run.runId}/${q.id}/${a}`).localeCompare(digest(`${run.runId}/${q.id}/${b}`)));
    run.queries.push({...q,keyword:rankings.keyword!,hybrid:rankings.hybrid!,pool});
    reviewers.push({queryId:q.id,brief:q.query,requiredSkills:q.requiredSkills,minYears:q.minYears,rubric:q.rubric,profiles:pool.map(id=>{const p=profiles.find(p=>p.id===id)!;return {profileId:p.id,title:p.title,years:p.years,skills:p.skills,summary:p.summary,experience:p.experience};})});
    pool.forEach(profileId=>blankJudgments.push({queryId:q.id,profileId,grade:null,rationale:''}));
    await writeFile(`${directory}/run.partial.json`,JSON.stringify(run,null,2)+'\n');
    console.log(`Collected ${i+1}/${queries.length} paired queries.`);
  }
  await writeFile(`${directory}/run.json`,JSON.stringify(run,null,2)+'\n',{flag:'wx'});
  await writeFile(`${directory}/review-packet.json`,JSON.stringify({runId:run.runId,instructions:'Read each brief and rubric. Grade each profile 0 (irrelevant), 1 (partial), or 2 (strong), using only stated experience. Explain the grade. Do not inspect run.json or infer missing experience. Profiles are shuffled; retrieval methods and ranks are hidden.',queries:reviewers},null,2)+'\n',{flag:'wx'});
  await writeFile(`${directory}/judgments.json`,JSON.stringify({runId:run.runId,protocolHash:run.protocolHash,corpusHash:run.corpusHash,reviewer:{name:'',kind:'human',independentOfImplementation:false},judgments:blankJudgments},null,2)+'\n',{flag:'wx'});
  console.log(`Review packet and blank judgments written to ${directory}. No relevance scores have been calculated.`);
}else if(command==='score'){
  if(args.length!==2)throw new Error('Usage: npm run compare -- score RUN_DIRECTORY JUDGMENTS_FILE');
  if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw new Error('Commit evaluation changes before collection so the run is reproducible.');
  const directory=resolve(args[0]);
  const run=JSON.parse(await readFile(`${directory}/run.json`,'utf8')) as ComparisonRun;
  if(run.version!==1)throw new Error('Unsupported run version.');
  const report=scoreComparison(run,JSON.parse(await readFile(args[1],'utf8')));
  await writeFile(`${directory}/comparison.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(report,null,2));
}else throw new Error('Usage: npm run compare -- collect [NEW_OUTPUT_DIRECTORY] | score RUN_DIRECTORY JUDGMENTS_FILE');
