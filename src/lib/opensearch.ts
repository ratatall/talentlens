import type { Profile, SearchInput } from './types';
import { embed } from './provider';
import { reciprocalRankFusion } from './ranking';
export const indexName = () => process.env.OPENSEARCH_INDEX || 'talentlens-profiles-v1';
export async function osRequest(path: string, body?: unknown, method = 'POST', ndjson = false) {
  const endpoint = process.env.OPENSEARCH_URL || 'http://127.0.0.1:9200';
  const headers: Record<string,string> = { 'Content-Type': ndjson ? 'application/x-ndjson' : 'application/json' };
  if (process.env.OPENSEARCH_USERNAME) headers.Authorization = 'Basic ' + Buffer.from(`${process.env.OPENSEARCH_USERNAME}:${process.env.OPENSEARCH_PASSWORD || ''}`).toString('base64');
  let res: Response;
  try { res = await fetch(`${endpoint.replace(/\/$/, '')}/${path}`, { method, headers, ...(body !== undefined ? { body: ndjson ? String(body) : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000), cache: 'no-store' }); }
  catch { throw new Error('OpenSearch is unavailable. Start the local service or check OPENSEARCH_URL.'); }
  if (!res.ok) throw new Error(`OpenSearch request failed (${res.status}). Check the index and connection configuration.`);
  return res.json();
}
type Hit = { _id: string; _score: number; _source: Profile };
export async function openSearch(input: SearchInput) {
  const filters: unknown[] = [{ range: { years: { gte: input.minYears } } }, ...input.requiredSkills.map(s => ({ term: { skills: s.toLowerCase() } }))];
  if (input.excludedIds.length) filters.push({ bool: { must_not: [{ ids: { values: input.excludedIds } }] } });
  const filter = { bool: { filter: filters } };
  const keyword = { bool: { filter: filters, must: [{ multi_match: { query: input.query, fields: ['title^2', 'skills.text^2', 'summary', 'experience'], type: 'best_fields' } }], should: input.prioritySkills.map(s => ({ term: { skills: { value: s.toLowerCase(), boost: 2 } } })) } };
  const lexical = await osRequest(`${indexName()}/_search`, { size: 100, track_total_hits: true, _source: { excludes: ['embedding'] }, query: keyword });
  const lexicalHits: Hit[] = lexical.hits.hits;
  if (input.mode === 'keyword') return { hits: lexicalHits, total: lexical.hits.total.value, tokens: 0 };
  const meta = await osRequest(`${indexName()}/_mapping`, undefined, 'GET');
  const mapping = meta[indexName()]?.mappings?._meta;
  if (!mapping?.hasEmbeddings || mapping.embeddingModel !== (process.env.EMBEDDING_MODEL || 'text-embedding-3-small')) throw new Error('This index has no compatible embeddings. Run the embedding seed step before hybrid search.');
  const embedded = await embed([`${input.query}. Prioritize: ${input.prioritySkills.join(', ')}`]);
  const semantic = await osRequest(`${indexName()}/_search`, { size: 100, _source: { excludes: ['embedding'] }, query: { knn: { embedding: { vector: embedded.vectors[0], k: 100, filter } } } });
  const semanticHits: Hit[] = semantic.hits.hits;
  const byId = new Map([...lexicalHits, ...semanticHits].map(h => [h._id, h]));
  const ranked = reciprocalRankFusion([lexicalHits.map(h => ({ id: h._id, score: h._score })), semanticHits.map(h => ({ id: h._id, score: h._score }))]);
  return { hits: ranked.map(h => ({ ...byId.get(h.id)!, _score: h.score })), total: byId.size, tokens: embedded.tokens };
}
