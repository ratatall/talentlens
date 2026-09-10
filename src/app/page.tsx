import Workspace from '@/components/workspace';
import { search } from '@/lib/search';
import { defaultQuery } from '@/lib/profiles';
import { searchSchema, type SearchResponse } from '@/lib/types';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const input = searchSchema.parse({ query: defaultQuery, requiredSkills: ['Python'] });
  let initial: SearchResponse;
  let initialError = '';
  try { initial = await search(input); }
  catch (e) { initialError = e instanceof Error ? e.message : 'Search is unavailable.'; initial = {results: [], total: 0, elapsedMs: 0, backend: 'opensearch', method: 'Unavailable', usage: {embeddingTokens:0}}; }
  return <Workspace initial={initial} initialError={initialError} hybridEnabled={process.env.SEARCH_BACKEND === 'opensearch' && Boolean(process.env.OPENAI_API_KEY)} llmEnabled={Boolean(process.env.OPENAI_API_KEY)} />;
}
