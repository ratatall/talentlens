import { createHash } from 'node:crypto';
import { z } from 'zod';
export const evaluationQuerySchema = z.object({
  id: z.string().min(1), split: z.enum(['development', 'holdout']),
  query: z.string().min(1).max(1000), rubric: z.string().min(20),
  requiredSkills: z.array(z.string()).max(12), minYears: z.number().int().min(0).max(50),
});
export const querySetSchema = z.array(evaluationQuerySchema).min(1).max(30).superRefine((queries, ctx) => {
  if (new Set(queries.map(q => q.id)).size !== queries.length) ctx.addIssue({code:'custom',message:'Query IDs must be unique.'});
});
export type EvaluationQuery = z.infer<typeof evaluationQuerySchema>;
export type Ranking = { ids: string[]; elapsedMs: number; embeddingTokens: number };
export type ComparisonRun = {
  version: 1; runId: string; createdAt: string; commit: string; index: string; embeddingModel: string;
  protocolHash: string; corpusHash: string;
  embeddingUsdPerMillionTokens: number | null;
  queries: (EvaluationQuery & { keyword: Ranking; hybrid: Ranking; pool: string[] })[];
};
export const judgmentsSchema = z.object({
  runId: z.string(), protocolHash: z.string(), corpusHash: z.string(),
  reviewer: z.object({ name: z.string().trim().min(2), kind: z.literal('human'), independentOfImplementation: z.literal(true) }),
  judgments: z.array(z.object({ queryId: z.string(), profileId: z.string(), grade: z.number().int().min(0).max(2), rationale: z.string().trim().min(10) })),
});
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function precisionAt5(grades: number[]) { return grades.slice(0,5).filter(g => g >= 1).length / 5; }
export function ndcgAt5(grades: number[], poolGrades: number[]) {
  const dcg = (values: number[]) => values.slice(0,5).reduce((sum, grade, i) => sum + (2 ** grade - 1) / Math.log2(i + 2), 0);
  const ideal = dcg([...poolGrades].sort((a,b)=>b-a));
  return ideal === 0 ? null : dcg(grades) / ideal;
}
export function percentile(values: number[], quantile: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.max(0,Math.ceil(quantile * sorted.length)-1)];
}
export function scoreComparison(run: ComparisonRun, rawJudgments: unknown) {
  const judgments = judgmentsSchema.parse(rawJudgments);
  if (judgments.runId !== run.runId || judgments.protocolHash !== run.protocolHash || judgments.corpusHash !== run.corpusHash) throw new Error('Judgments do not belong to this frozen run.');
  const expected = new Set(run.queries.flatMap(q=>q.pool.map(id=>`${q.id}/${id}`)));
  const byPair = new Map<string,number>();
  for (const j of judgments.judgments) {
    const key = `${j.queryId}/${j.profileId}`;
    if (!expected.has(key) || byPair.has(key)) throw new Error('Unknown or duplicate judgment.');
    byPair.set(key,j.grade);
  }
  if (byPair.size !== expected.size) throw new Error('Complete every pooled judgment before scoring. Unjudged profiles are not negatives.');
  const rows = run.queries.map(q=>{
    const poolGrades = q.pool.map(id=>byPair.get(`${q.id}/${id}`)!);
    const metrics = (mode:'keyword'|'hybrid')=>{
      const grades = q[mode].ids.slice(0,5).map(id=>{
        const grade=byPair.get(`${q.id}/${id}`);if(grade===undefined)throw new Error('Top-five result missing from judgment pool.');return grade;
      });
      return {precisionAt5:precisionAt5(grades),ndcgAt5:ndcgAt5(grades,poolGrades),elapsedMs:q[mode].elapsedMs};
    };
    return {queryId:q.id,split:q.split,keyword:metrics('keyword'),hybrid:metrics('hybrid')};
  });
  const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const summarize=(split:'development'|'holdout')=>{
    const selected=rows.filter(r=>r.split===split);
    const metrics=(mode:'keyword'|'hybrid')=>({
      precisionAt5:mean(selected.map(r=>r[mode].precisionAt5)),
      ndcgAt5:mean(selected.flatMap(r=>r[mode].ndcgAt5===null?[]:[r[mode].ndcgAt5!])),
      ndcgDefinedQueries:selected.filter(r=>r[mode].ndcgAt5!==null).length,
      latencyP50Ms:percentile(selected.map(r=>r[mode].elapsedMs),.5),
      latencyP95Ms:percentile(selected.map(r=>r[mode].elapsedMs),.95),
    });
    const keyword=metrics('keyword'),hybrid=metrics('hybrid');
    return {queries:selected.length,keyword,hybrid,precisionAt5Delta:keyword.precisionAt5===null||hybrid.precisionAt5===null?null:hybrid.precisionAt5-keyword.precisionAt5};
  };
  const embeddingTokens=run.queries.reduce((s,q)=>s+q.hybrid.embeddingTokens,0);
  return {runId:run.runId,protocolHash:run.protocolHash,corpusHash:run.corpusHash,commit:run.commit,
    qualification:'Independent human review is self-attested. Synthetic corpus; nDCG ideal is limited to the pooled top-five union. No corpus recall or real-world hiring claims. One timing sample per query and mode; not a load test. Interpretation and index ingestion costs excluded.',
    development:summarize('development'),holdout:summarize('holdout'),
    queryEmbeddingTokens:embeddingTokens,estimatedQueryEmbeddingUsd:run.embeddingUsdPerMillionTokens===null?null:embeddingTokens/1e6*run.embeddingUsdPerMillionTokens,
    pricingUsdPerMillionTokens:run.embeddingUsdPerMillionTokens,rows};
}
