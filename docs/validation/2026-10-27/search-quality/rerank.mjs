import { readFile, writeFile } from "node:fs/promises";
const [root, out] = process.argv.slice(2);
process.chdir(root);
await import(root + "/node_modules/dotenv/config.js");
const { buildResearchPlan } = await import(root + "/config/researchAgent.js");
const { buildResearchSpec } = await import(root + "/config/researchSpec.js");
const { liveSearchQueries } = await import(root + "/server/liveSearchQueries.js");
const { discoverSourcesForScope } = await import(root + "/server/sourceDiscovery.js");
const { assistedResearchSpec } = await import(root + "/server/queryInterpretation.js");
const qs = JSON.parse(await readFile(new URL("./questions.json", import.meta.url)));
const gemini = async (system, user, thinking = 0) => {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature: 0, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: thinking } } }) });
  const j = await res.json(); return JSON.parse(j.candidates[0].content.parts[0].text);
};
const RERANK = `Order library records by how well each could help a student answer their research question. Score each 0-3: 3 = directly studies or argues the question; 2 = substantially relevant; 1 = background or partial; 0 = only shares keywords, or is news/trade/promotional when scholarship is expected. Use only the given title, type and abstract. Return {"scores":[{"i":number,"s":number}]}.`;
const rows = [];
for (const q of qs) {
  const assisted = await assistedResearchSpec(q, buildResearchSpec(q), { force: true, env: { ...process.env, AI_QUERY_INTERPRETATION: "on" } });
  const plan = buildResearchPlan(q, 5, undefined, undefined, assisted ? { assistedResearchSpec: assisted } : {});
  const d = await discoverSourcesForScope(liveSearchQueries(plan, q), 20, plan.researchSpec.mode, "library", { researchSpec: plan.researchSpec });
  const pool = d.results.slice(0, 20);
  let order = pool.map((_, i) => i);
  const t0 = Date.now();
  if (pool.length > 1) {
    try {
      const list = pool.map((s, i) => `${i + 1}. [${s.type || "?"}, ${String(s.date || "").slice(0, 4)}] ${s.title}\n   ${String(s.abstractText || s.abstractExcerpt || "(no abstract)").slice(0, 300)}`).join("\n");
      const scored = await gemini(RERANK, `Question: ${q}\n\nRecords:\n${list}`, 0);
      const score = (i) => scored.scores.find((x) => x.i === i + 1)?.s ?? 0;
      order = pool.map((_, i) => i).sort((a, b) => score(b) - score(a) || a - b);
    } catch {}
  }
  rows.push({ q, variant: "rerank", rerankMs: Date.now() - t0, pool: pool.length, top: order.slice(0, 5).map((i) => pool[i]).map((r) => ({ title: r.title, type: r.type, year: String(r.date || "").slice(0, 4), abstract: String(r.abstractText || r.abstractExcerpt || "").slice(0, 600) })) });
  process.stderr.write(`rerank ${rows.length}/${qs.length} pool ${pool.length} ${Date.now() - t0}ms\n`);
}
await writeFile(out, JSON.stringify(rows, null, 1));
