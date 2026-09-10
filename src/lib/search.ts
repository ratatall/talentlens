import { demoSearch, explain } from './ranking';
import { openSearch } from './opensearch';
import type { SearchInput, SearchResponse } from './types';
export async function search(input: SearchInput): Promise<SearchResponse> {
  const start = performance.now();
  if ((process.env.SEARCH_BACKEND || 'demo') === 'demo') {
    if (input.mode === 'hybrid') throw new Error('Hybrid search requires OpenSearch and an embedding provider. Demo mode supports keyword search only.');
    const matches = demoSearch(input);
    return { results: matches.slice(0, 50), total: matches.length, elapsedMs: Math.round(performance.now() - start), backend: 'demo', method: 'Local keyword overlap · synthetic profiles', usage: { embeddingTokens: 0 } };
  }
  if (process.env.SEARCH_BACKEND !== 'opensearch') throw new Error('SEARCH_BACKEND must be demo or opensearch.');
  const data = await openSearch(input);
  return { results: data.hits.slice(0,50).map(h => explain(h._source, input, h._score)), total: data.total, elapsedMs: Math.round(performance.now() - start), backend: 'opensearch', method: input.mode === 'hybrid' ? 'BM25 + vector search · reciprocal rank fusion' : 'OpenSearch BM25', usage: { embeddingTokens: data.tokens } };
}
