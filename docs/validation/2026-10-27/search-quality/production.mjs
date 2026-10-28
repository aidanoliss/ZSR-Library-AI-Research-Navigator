import { readFile, writeFile } from "node:fs/promises";
const [root, out] = process.argv.slice(2);
process.chdir(root);
await import(root + "/node_modules/dotenv/config.js");
const { retrieveResearchContext } = await import(root + "/server/retrieve.js");
const { liveSearchQueries } = await import(root + "/server/liveSearchQueries.js");
const { searchSourceCandidatesForScope } = await import(root + "/server/sourceDiscovery.js");
const { researchSpecQuery } = await import(root + "/config/researchSpec.js");
const qs = JSON.parse(await readFile(new URL("./questions.json", import.meta.url)));
const rows = [];
for (const q of qs) {
  const t0 = Date.now(); const stages = [];
  const { plan } = await retrieveResearchContext(q, 6, "scholarly", undefined, { onStage: (s) => stages.push([s, Date.now() - t0]) });
  const t1 = Date.now();
  let outcomes;
  const results = await searchSourceCandidatesForScope(liveSearchQueries(plan, q), 10, plan.modeId, "library", { researchSpec: plan.researchSpec, rerank: true, onStatus: (o) => { outcomes = o; }, onStage: (s) => stages.push([s, Date.now() - t0]) });
  rows.push({ q, variant: "production", ms: Date.now() - t0, planMs: t1 - t0, query: researchSpecQuery(plan.researchSpec), interpretation: plan.researchSpec.interpretation || null, reranked: results.some((r) => r.aiRelevance), count: results.length,
    top: results.slice(0, 5).map((r) => ({ title: r.title, type: r.type, year: String(r.date || "").slice(0, 4), abstract: String(r.abstractText || r.abstractExcerpt || "").slice(0, 600) })) });
  process.stderr.write(`prod ${rows.length}/${qs.length} total ${Date.now() - t0}ms (plan ${t1 - t0}ms) results ${results.length} reranked ${rows.at(-1).reranked}\n`);
}
await writeFile(out, JSON.stringify(rows, null, 1));
