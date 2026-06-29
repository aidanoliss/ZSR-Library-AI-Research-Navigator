import { dedupeCompanyCandidates } from "./dedupe.js";
import { matchInvestors } from "./investors.js";
import { generateWeeklyReport } from "./reports.js";
import { scoreCompanies } from "./scoring.js";
import { extractCompanyFromCandidate, fetchHackerNewsLaunchPosts } from "./sources.js";

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function periodWindow(now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  return { period_start: isoDate(start), period_end: isoDate(end) };
}

function companyIdentity(company = {}) {
  return company.id || company.source_uid || company.source_url || company.name;
}

function updatedDuplicateCompanies(duplicates = []) {
  return duplicates.map(({ candidate, matched_company }) => ({
    ...matched_company,
    ...candidate,
    id: matched_company.id || candidate.id,
    discovered_at: matched_company.discovered_at || candidate.discovered_at,
  }));
}

export async function runWeeklyScan(options = {}) {
  const {
    source = "hn",
    companies = [],
    investors = [],
    limit = 12,
    fetchImpl = globalThis.fetch,
    weights,
    now = new Date(),
  } = options;

  if (source !== "hn") {
    throw new Error(`Unsupported source "${source}". Only hn is implemented for this milestone.`);
  }

  const sourceResult = await fetchHackerNewsLaunchPosts({ limit, fetchImpl });
  if (!sourceResult.ok) {
    throw new Error(sourceResult.reason || "Hacker News ingestion failed.");
  }

  const extractedCompanies = sourceResult.candidates.map((candidate) => extractCompanyFromCandidate(candidate));
  const { unique, duplicates } = dedupeCompanyCandidates(companies, extractedCompanies);
  const updatedCompanies = updatedDuplicateCompanies(duplicates);
  const updatedByIdentity = new Map(updatedCompanies.map((company) => [companyIdentity(company), company]));
  const existingWithUpdates = companies.map((company) => updatedByIdentity.get(companyIdentity(company)) || company);
  const mergedCompanies = [...unique, ...existingWithUpdates].sort((a, b) =>
    String(b.discovered_at || "").localeCompare(String(a.discovered_at || ""))
  );
  const scorecards = scoreCompanies(mergedCompanies, weights);
  const newCompanyIds = new Set(unique.map((company) => company.id));
  const newScorecards = scorecards.filter(({ company }) => newCompanyIds.has(company.id));
  const investorMatches = scorecards
    .slice(0, 10)
    .flatMap(({ company }) => matchInvestors(company, investors, 2));
  const period = periodWindow(now);
  const report = generateWeeklyReport(mergedCompanies, investors, {
    weights,
    ...period,
    limitations: [
      "HN launch profiles are based on public launch metadata and deterministic extraction, not private diligence.",
      "Community engagement is treated as market interest, not revenue, customer traction, or investment performance.",
      "Funding, founder credentials, customer names, pricing, and product claims must be independently verified.",
      "Investor matches indicate thesis relevance, not actual investor interest.",
    ],
  });

  return {
    source,
    fetched_at: sourceResult.fetched_at,
    fetched_count: sourceResult.raw_count,
    candidate_count: sourceResult.candidates.length,
    new_company_count: unique.length,
    updated_company_count: updatedCompanies.length,
    duplicate_count: duplicates.length,
    companies: mergedCompanies,
    newCompanies: unique,
    updatedCompanies,
    duplicates,
    scorecards,
    newScorecards,
    investorMatches,
    report,
  };
}
