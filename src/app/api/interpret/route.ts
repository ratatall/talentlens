import { z } from 'zod';
import { interpretLocally } from '@/lib/ranking';
import { interpretWithLLM } from '@/lib/provider';
import { readBody } from '@/lib/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  let query: string;
  try { query = z.object({ query: z.string().trim().min(1).max(1000) }).parse(await readBody(request)).query; }
  catch { return Response.json({ error: 'Enter a search between 1 and 1,000 characters.' }, { status: 400 }); }
  try { const llm = Boolean(process.env.OPENAI_API_KEY); return Response.json({ criteria: llm ? await interpretWithLLM(query) : interpretLocally(query), interpreter: llm ? 'LLM' : 'Rule-based' }); }
  catch { return Response.json({ error: 'Could not interpret this query. Check the provider configuration or edit the criteria manually.' }, { status: 503 }); }
}
