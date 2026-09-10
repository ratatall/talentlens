import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
import { indexDefinition } from '../src/lib/index-definition';
import { profiles } from '../src/lib/profiles';
import { profileText } from '../src/lib/ranking';
import { embed } from '../src/lib/provider';
import { indexName, osRequest } from '../src/lib/opensearch';
const withEmbeddings = process.argv.includes('--embeddings');
const name = indexName();
// Never delete an existing index. Use a new OPENSEARCH_INDEX for a new schema/model.
if (withEmbeddings && !process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY before creating an embedding index. No index was created.');
await osRequest(name, indexDefinition(), 'PUT');
let tokens = 0;
for(let offset=0;offset<profiles.length;offset+=30){
  const batch=profiles.slice(offset,offset+30);
  const embedded = withEmbeddings ? await embed(batch.map(profileText)) : null;
  tokens += embedded?.tokens ?? 0;
  const lines = batch.flatMap((profile,i)=>[JSON.stringify({index:{_index:name,_id:profile.id}}),JSON.stringify({...profile,...(embedded?{embedding:embedded.vectors[i]}:{})})]).join('\n')+'\n';
  const response = await osRequest('_bulk?refresh=wait_for',lines,'POST',true);
  if(response.errors) throw new Error('One or more profiles failed indexing. Inspect the local OpenSearch logs.');
  console.log(`Indexed ${offset+batch.length}/${profiles.length} synthetic profiles.`);
}
if(withEmbeddings) await osRequest(`${name}/_mapping`,{_meta:{hasEmbeddings:true,embeddingModel:process.env.EMBEDDING_MODEL||'text-embedding-3-small',synthetic:true}},'PUT');
console.log(JSON.stringify({index:name,profiles:profiles.length,embeddings:withEmbeddings,embeddingTokens:tokens}));
