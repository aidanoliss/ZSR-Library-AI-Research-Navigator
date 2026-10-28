import { readFile, writeFile } from "node:fs/promises";
const [root, out, variant] = process.argv.slice(2);
process.chdir(root);
await import(root + "/node_modules/dotenv/config.js");
const { buildResearchPlan } = await import(root + "/config/researchAgent.js");
const { buildResearchSpec, researchSpecQuery } = await import(root + "/config/researchSpec.js");
const { liveSearchQueries } = await import(root + "/server/liveSearchQueries.js");
const { discoverSourcesForScope } = await import(root + "/server/sourceDiscovery.js");
const { assistedResearchSpec } = await import(root + "/server/queryInterpretation.js");
const qs = JSON.parse(await readFile(new URL("./questions.json", import.meta.url)));
const rows = [];
for (const q of qs) {
  const t0 = Date.now();
  let ctx = {};
  if (variant === "ai") {
    const assisted = await assistedResearchSpec(q, buildResearchSpec(q), { force: true, env: { ...process.env, AI_QUERY_INTERPRETATION: "on" } });
    if (assisted) ctx = { assistedResearchSpec: assisted };
  }
  const plan = buildResearchPlan(q, 5, undefined, undefined, ctx);
  const queries = liveSearchQueries(plan, q);
  const d = await discoverSourcesForScope(queries, 10, plan.researchSpec.mode, "library", { researchSpec: plan.researchSpec });
  rows.push({ q, variant, ms: Date.now() - t0, mode: plan.researchSpec.mode, aiUsed: plan.researchSpec.interpretation?.method === "ai-assisted", query: researchSpecQuery(plan.researchSpec), count: d.results.length,
    failures: (d.outcomes.library || []).filter((a) => ["timeout", "error", "rate_limited"].includes(a.status)).length,
    top: d.results.slice(0, 5).map((r) => ({ title: r.title, type: r.type, year: String(r.date || "").slice(0, 4), abstract: String(r.abstractText || r.abstractExcerpt || "").slice(0, 600), label: r.matchExplanation?.label, peer: r.peerReviewed === true })) });
  process.stderr.write(`${variant} ${rows.length}/${qs.length} ${Date.now() - t0}ms ${d.results.length}\n`);
}
await writeFile(out, JSON.stringify(rows, null, 1));
