export function indexDefinition() {
  return {
    settings: {
      index: { knn: true, number_of_shards: 1, number_of_replicas: 0 },
      analysis: { normalizer: { lowercase_normalizer: { type: 'custom', filter: ['lowercase'] } } },
    },
    mappings: {
      _meta: { hasEmbeddings: false, embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small', synthetic: true },
      properties: {
        id: { type: 'keyword' }, name: { type: 'keyword' }, title: { type: 'text' },
        company: { type: 'keyword' }, location: { type: 'keyword' }, years: { type: 'integer' },
        skills: { type: 'keyword', normalizer: 'lowercase_normalizer', fields: { text: { type: 'text' } } },
        summary: { type: 'text' }, experience: { type: 'text' }, source: { type: 'keyword' },
        embedding: { type: 'knn_vector', dimension: 512, method: { name: 'hnsw', space_type: 'cosinesimil', engine: 'lucene', parameters: { ef_construction: 128, m: 16 } } },
      },
    },
  };
}
