import { searchSchema } from '@/lib/types';
import { search } from '@/lib/search';
import { readBody } from '@/lib/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  let input;
  try { input = searchSchema.parse(await readBody(request)); }
  catch { return Response.json({ error: 'Invalid search. Use a query under 1,000 characters, up to 12 skills, and 0–50 years.' }, { status: 400 }); }
  try { return Response.json(await search(input)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Search failed. Please retry.' }, { status: 503 }); }
}
