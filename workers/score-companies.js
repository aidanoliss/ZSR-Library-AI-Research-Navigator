import { scoreCompanies } from "../lib/scoring.js";
import { readJson, shouldWrite, writeJson } from "./_data.js";

const companies = await readJson("data/sample_startups.json");
const scored = scoreCompanies(companies).map(({ company, scorecard }) => ({
  company_id: company.id,
  company_name: company.name,
  ...scorecard,
}));

if (shouldWrite()) {
  await writeJson("data/generated_company_scores.json", scored);
}

console.log(JSON.stringify({ ok: true, company_scores: scored }, null, 2));
