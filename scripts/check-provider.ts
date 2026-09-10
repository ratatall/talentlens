import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
import { interpretWithLLM } from '../src/lib/provider';
if(!process.env.OPENAI_API_KEY)throw new Error('Configure OPENAI_API_KEY first. No request was made.');
const start=performance.now();
const criteria=await interpretWithLLM('Find Python engineers with at least 3 years of experience.');
if(!criteria.requiredSkills.some(s=>s.toLowerCase()==='python')||criteria.minYears!==3)throw new Error('Provider responded, but the interpretation did not satisfy the explicit criteria.');
console.log(JSON.stringify({status:'passed',check:'One live structured interpretation request',elapsedMs:Math.round(performance.now()-start),criteria}));
