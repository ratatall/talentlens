# Keyword versus hybrid evaluation

## Current status

**Paid evaluation is pending. No hybrid relevance improvement or live LLM success is claimed.** CI checks real OpenSearch BM25, filtered vector k-NN, and rank fusion using fixed artificial vectors; this tests the retrieval machinery, not embedding quality. The existing reports in `data/` remain synthetic skill-label sanity checks.

This protocol adds 30 distinct briefs: 20 development queries and 10 held-out queries, including out-of-domain requests with potentially no relevant profiles. Query text and explicit filters are identical for both retrieval modes. LLM interpretation is deliberately excluded from this comparison so any ranking difference can be attributed to retrieval, rather than different filters.

## Paid setup, when authorized

Use a new index name in `.env.local` to preserve the existing keyword index. Configure your own API key locally; do not commit it.

```sh
# One live LLM interpretation request; a check, not a broad LLM evaluation:
npm run check:provider
# Up to 12 embedding batches for 360 fictional profiles:
npm run seed -- --embeddings
# Up to 30 additional query embedding requests and 60 paired retrieval runs:
npm run compare -- collect
```

`SEARCH_BACKEND=opensearch` is required. The collector verifies the index's embedding model and the exact corpus before making query embedding requests. Commit code and the query protocol before collection; a clean tracked source state is required. No key means an immediate failure with no paid calls. The collector does not silently substitute keyword search for hybrid.

Each collection writes a new directory under ignored `evaluation/runs/`. A partial run is saved after each completed query; partial runs cannot be scored. There is no automatic retry or resume. A failed call may still incur provider charges. Rerun into a new directory only deliberately.

## Blinded review

Give an independent human reviewer only `review-packet.json` and `judgments.json`. Do not give them `run.json`, rankings, retrieval-method labels, or the development/holdout split while reviewing.

The pool is the union of each mode's top five results. Profiles are shuffled independently for every query. Names and locations are omitted. The reviewer reads the query-specific rubric and stated résumé evidence, then assigns:

| Grade | Meaning |
| --- | --- |
| 0 | No meaningful evidence for the requested work |
| 1 | Partial or adjacent experience; requirements are not fully supported |
| 2 | Direct evidence supporting the requested work |

Record a rationale for every pooled profile. Do not infer unlisted experience. A query can have zero relevant profiles. Complete the reviewer identity and independence declaration truthfully. The software cannot verify someone's independence; the report explicitly calls it self-attested. Model-generated or developer-authored judgments must not be presented as independent human judgments.

For stronger evidence, collect a second independent review and adjudicate disagreements before producing the final judgment file. This tool accepts one final reviewer/adjudicator file; it does not calculate inter-rater agreement.

```sh
npm run compare -- score evaluation/runs/<run-directory> evaluation/runs/<run-directory>/judgments.json
```

The scorer refuses blank grades, missing judgments, duplicate pairs, foreign run IDs or corpus/protocol fingerprints, and a reviewer who has not attested independence. It never interprets unjudged profiles as irrelevant. It writes a new `comparison.json` and refuses to overwrite it.

## Metrics and interpretation

- **Precision@5:** Grades 1 and 2 count as relevant. Denominator is always five, including short result lists.
- **nDCG@5:** Graded gains of `2^grade - 1`. The ideal ranking is computed only from the pooled union, not the entire corpus. Queries whose pool has no positive grades have undefined nDCG, are excluded from the nDCG mean, and remain in the precision mean; report their count.
- **Latency:** p50/p95 of one observed request per mode per query. Collection alternates which mode runs first. These are local end-to-end search timings, not load-test results or statistical significance evidence.
- **Cost:** Query embedding token usage is recorded. Optional `EMBEDDING_USD_PER_MILLION_TOKENS` produces an estimate using a user-supplied current billing rate. An unset rate produces `null`, not zero. LLM interpretation, index ingestion, infrastructure costs, failed calls, and taxes are excluded; reconcile total spend with provider billing.
- **Split reporting:** Development and holdout results are separate. Tune only against development results. Once holdout labels/results have informed changes, retire that split and create new held-out queries before making new generalization claims.
- **Corpus:** All 360 profiles are synthetic and templated. Even independently judged results do not demonstrate real recruiting effectiveness or fairness. The pool does not support corpus-wide recall claims.

For a CV, publish the protocol, a reviewer-consented anonymized report, exact commit/model/corpus identifiers, and an honest measured result. Do not publish reviewer identities without permission. Paid collection and independent human review are deliberately still pending.
