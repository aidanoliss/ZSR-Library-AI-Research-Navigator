import { matchInvestors } from "../lib/investors.js";
import { generateProposal } from "../lib/memos.js";
import { readJson, shouldWrite, writeJson } from "./_data.js";

const companies = await readJson("data/sample_startups.json");
const investors = await readJson("data/sample_investors.json");

const proposals = companies.flatMap((company) =>
  matchInvestors(company, investors, 2).map((match) => generateProposal(company, match))
);

if (shouldWrite()) {
  await writeJson("data/generated_investor_proposals.json", proposals);
}

console.log(JSON.stringify({ ok: true, proposals }, null, 2));
