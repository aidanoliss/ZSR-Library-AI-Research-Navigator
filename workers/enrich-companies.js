import { readJson, shouldWrite, writeJson } from "./_data.js";

const companies = await readJson("data/sample_startups.json");
const enriched = companies.map((company) => ({
  ...company,
  enrichment_status: "sample_only",
  enrichment_notes:
    "MVP enrichment preserves source-backed fields and does not fabricate funding, revenue, customers, or founder credentials.",
}));

if (shouldWrite()) {
  await writeJson("data/generated_enriched_companies.json", enriched);
}

console.log(JSON.stringify({ ok: true, companies: enriched }, null, 2));
