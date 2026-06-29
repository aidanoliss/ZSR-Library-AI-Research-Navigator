import { scoreCompanies, summarizeDomains } from "./scoring.js";
import { hasOutreachReadyCompanySource } from "./sourceQuality.js";

function plural(count, singular, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function latestJob(state) {
  return Array.isArray(state.jobs) ? state.jobs[0] : null;
}

function riskLine(company) {
  const risk = company.risk_flags?.[0];
  if (!risk) return "No risk flag recorded.";
  return `${risk.severity?.toUpperCase?.() || "UNKNOWN"}: ${risk.risk_type} - ${risk.explanation}`;
}

export function buildWeeklyScanSummary(result, state, options = {}) {
  const createdAt = options.createdAt || new Date().toISOString();
  const allCompanies = state.companies || [];
  const outreachReadyCompanies = allCompanies.filter(hasOutreachReadyCompanySource);
  const summaryCompanies = outreachReadyCompanies.length ? outreachReadyCompanies : allCompanies;
  const scored = scoreCompanies(summaryCompanies);
  const domains = summarizeDomains(summaryCompanies, scored);
  const newCompanyIds = new Set((result.newCompanies || []).map((company) => company.id));
  const updatedCompanyIds = new Set((result.updatedCompanies || []).map((company) => company.id));
  const newScored = scored.filter(({ company }) => newCompanyIds.has(company.id));
  const updatedScored = scored.filter(({ company }) => updatedCompanyIds.has(company.id));
  const topNew = newScored.slice(0, 5);
  const topUpdated = updatedScored.slice(0, 5);
  const topOverall = scored.slice(0, 5);
  const highRiskNew = (result.newCompanies || []).filter((company) =>
    (company.risk_flags || []).some((risk) => risk.severity === "high")
  );
  const job = latestJob(state);

  const summary = {
    title: "Weekly Venture Radar Scan Summary",
    created_at: createdAt,
    source: result.source,
    data_mode: state.dataMode || "unknown",
    job_status: job?.status || "unknown",
    job_id: job?.id || null,
    fetched_count: result.fetched_count,
    candidate_count: result.candidate_count,
    new_company_count: result.new_company_count,
    updated_company_count: result.updated_company_count || 0,
    duplicate_count: result.duplicate_count,
    total_company_count: allCompanies.length,
    outreach_ready_company_count: outreachReadyCompanies.length,
    top_new_companies: topNew.map(({ company, scorecard }) => ({
      name: company.name,
      domain: company.domain,
      score: scorecard.overall_score,
      risk: scorecard.risk_level,
      source_url: company.source_url,
      first_diligence_question: company.diligence_questions?.[0] || "Run human diligence.",
    })),
    top_overall_companies: topOverall.map(({ company, scorecard }) => ({
      name: company.name,
      domain: company.domain,
      score: scorecard.overall_score,
      risk: scorecard.risk_level,
    })),
    top_updated_companies: topUpdated.map(({ company, scorecard }) => ({
      name: company.name,
      domain: company.domain,
      score: scorecard.overall_score,
      risk: scorecard.risk_level,
      source_url: company.source_url,
      first_diligence_question: company.diligence_questions?.[0] || "Run human diligence.",
    })),
    highest_momentum_domains: domains.slice(0, 5).map((domain) => ({
      name: domain.name,
      company_count: domain.company_count,
      momentum_score: domain.momentum_score,
      best_company: domain.best_company,
    })),
    high_risk_new_companies: highRiskNew.map((company) => ({
      name: company.name,
      domain: company.domain,
      risk: riskLine(company),
      source_url: company.source_url,
    })),
    next_actions: topNew.length
      ? topNew.map(({ company }) => `${company.name}: ${company.diligence_questions?.[0] || "Confirm current product, users, and founder-market fit."}`)
      : topUpdated.length
        ? topUpdated.map(({ company }) => `${company.name}: ${company.diligence_questions?.[0] || "Confirm current product, users, and founder-market fit."}`)
        : ["No new companies were added. Review duplicates and consider expanding sources."],
  };

  return {
    json: summary,
    markdown: renderWeeklyScanSummary(summary),
  };
}

function renderList(items, renderItem) {
  if (!items.length) return "- None";
  return items.map(renderItem).join("\n");
}

export function renderWeeklyScanSummary(summary) {
  return `# ${summary.title}

Generated: ${summary.created_at}

## Run Status
- Source: ${summary.source}
- Runtime: ${summary.data_mode}
- Job: ${summary.job_status}${summary.job_id ? ` (${summary.job_id})` : ""}
- Fetched: ${plural(summary.fetched_count, "raw item")}
- Candidates: ${plural(summary.candidate_count, "Launch HN candidate")}
- New companies: ${summary.new_company_count}
- Updated existing companies: ${summary.updated_company_count}
- Duplicates skipped: ${summary.duplicate_count}
- Total tracked companies: ${summary.total_company_count}
- Outreach-ready companies: ${summary.outreach_ready_company_count}/${summary.total_company_count}

## Top New Companies
${renderList(
  summary.top_new_companies,
  (item) => `- ${item.name} (${item.domain}) - ${item.score}/100, ${item.risk} risk. Next: ${item.first_diligence_question}`
)}

## Top Overall Companies
${renderList(
  summary.top_overall_companies,
  (item) => `- ${item.name} (${item.domain}) - ${item.score}/100, ${item.risk} risk`
)}

## Top Updated Companies
${renderList(
  summary.top_updated_companies,
  (item) => `- ${item.name} (${item.domain}) - ${item.score}/100, ${item.risk} risk. Next: ${item.first_diligence_question}`
)}

## Highest Momentum Domains
${renderList(
  summary.highest_momentum_domains,
  (item) => `- ${item.name}: ${item.momentum_score}/100 momentum, ${item.company_count} tracked, best company ${item.best_company}`
)}

## High-Risk New Items
${renderList(
  summary.high_risk_new_companies,
  (item) => `- ${item.name} (${item.domain}) - ${item.risk}`
)}

## Next Diligence Actions
${renderList(summary.next_actions, (item) => `- ${item}`)}

## Notes
- HN engagement is treated as community interest, not customer traction or investment advice.
- Funding, founder credentials, customer claims, and revenue must be independently verified.
`;
}
