import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
import { writeFile } from 'node:fs/promises';
import { search } from '../src/lib/search';
import { searchSchema } from '../src/lib/types';
// These hand-authored skill expectations are synthetic sanity checks, not human relevance judgments.
const topics: [string,string[]][] = [
 ['Python backend services',['Python','FastAPI']],['data pipelines with orchestration',['Python','Airflow']],['accessible frontend applications',['React','TypeScript']],['cloud infrastructure provisioning',['Terraform','AWS']],['machine learning model serving',['PyTorch','ML']],['document search ranking',['OpenSearch','Search']],['full stack web applications',['React','Node.js']],['streaming event data pipelines',['Kafka','Spark']],['native mobile applications',['Swift','Kotlin']],['analytics data warehouse modeling',['dbt','Snowflake']],
];
const mode=process.argv.includes('--hybrid')?'hybrid':'keyword';
const rows=[];
for(const [topic,skills] of topics) for(const prefix of ['Find engineers building','Looking for experience in','']){
  const query=`${prefix} ${topic}`.trim();
  const response=await search(searchSchema.parse({query,mode}));
  const top=response.results.slice(0,5);
  const relevant=top.map(m=>Number(skills.every(s=>m.profile.skills.includes(s))));
  rows.push({query,split:prefix===''?'holdout':'development',precisionAt5:relevant.reduce((a,b)=>a+b,0)/5,elapsedMs:response.elapsedMs,embeddingTokens:response.usage.embeddingTokens,topIds:top.map(m=>m.profile.id)});
}
const mean=(values:number[])=>values.reduce((a,b)=>a+b,0)/values.length;
const report={generatedAt:new Date().toISOString(),backend:process.env.SEARCH_BACKEND||'demo',mode,qualification:'Synthetic skill-based sanity benchmark. Not a human-judged ranking evaluation. Ten holdout queries are paraphrases of development topics, not independent unseen domains.',queries:rows.length,precisionAt5:mean(rows.map(r=>r.precisionAt5)),meanLatencyMs:mean(rows.map(r=>r.elapsedMs)),embeddingTokens:rows.reduce((s,r)=>s+r.embeddingTokens,0),rows};
await writeFile(`data/evaluation-${report.backend}-${mode}.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({backend:report.backend,mode,queries:rows.length,precisionAt5:report.precisionAt5,meanLatencyMs:report.meanLatencyMs,embeddingTokens:report.embeddingTokens},null,2));
