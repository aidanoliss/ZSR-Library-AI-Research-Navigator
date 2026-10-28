import { readFile, writeFile } from "node:fs/promises";
const [root, input, output] = process.argv.slice(2);
process.chdir(root);
await import(root + "/node_modules/dotenv/config.js");
const rows = JSON.parse(await readFile(input, "utf8"));
const RUBRIC = `You grade search results for a college student's research question. For each numbered source, give rating 2 if it directly addresses the question (a student could cite it for this exact question), 1 if it is related background or covers only part of the question, 0 if it is off-topic or only shares keywords. Judge from title, type and abstract only; be strict. Return JSON {"ratings":[{"i":number,"rating":0|1|2}]}.`;
for (const row of rows) {
  if (!row.top.length) { row.ratings = []; continue; }
  const list = row.top.map((s, i) => `${i + 1}. [${s.type || "?"}, ${s.year || "?"}] ${s.title}\n   ${s.abstract.slice(0, 450) || "(no abstract)"}`).join("\n");
  const body = { systemInstruction: { parts: [{ text: RUBRIC }] }, contents: [{ role: "user", parts: [{ text: `Question: ${row.q}\n\nSources:\n${list}` }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 512 } } };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify(body) });
      const j = await res.json();
      const parsed = JSON.parse(j.candidates[0].content.parts[0].text);
      row.ratings = row.top.map((_, i) => parsed.ratings.find((r) => r.i === i + 1)?.rating ?? 0);
      break;
    } catch (e) { if (attempt === 2) row.ratings = row.top.map(() => null); }
  }
}
await writeFile(output, JSON.stringify(rows, null, 1));
