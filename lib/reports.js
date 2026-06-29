import { bestByDomain, scoreCompanies, summarizeDomains } from "./scoring.js";
import { bestCompanyForEachInvestor, matchInvestors } from "./investors.js";
import { generateOutreachVariants, generateProposal } from "./memos.js";

export function generateWeeklyReport(companies, investors, options = {}) {
  const scored = scoreCompanies(companies, options.weights);
  const topCompanies = scored.slice(0, 10);
  const domainSummaries = summarizeDomains(companies, scored);
  const domainWinners = bestByDomain(companies, scored);
  const strongestDomain = domainSummaries[0];
  const weakestDomain = [...domainSummaries].sort((a, b) => a.average_score - b.average_score)[0];
  const matches = topCompanies.flatMap(({ company }) => matchInvestors(company, investors, 2));
  const bestByInvestor = bestCompanyForEachInvestor(companies, investors);
  const proposals = matches.slice(0, 8).map((match) => {
    const company = companies.find((item) => item.id === match.company_id);
    return generateProposal(company, match, options.userProfile);
  });
  const outreachDrafts = matches.slice(0, 8).map((match) => {
    const company = companies.find((item) => item.id === match.company_id);
    return {
      company: company?.name,
      investor_name: match.investor.name,
      ...generateOutreachVariants(company, match, options.userProfile),
    };
  });

  const title = options.title || "Weekly Venture Radar Report";
  const period_start = options.period_start || "2026-06-10";
  const period_end = options.period_end || "2026-06-17";
  const content_json = {
    title,
    report_type: "weekly",
    period_start,
    period_end,
    executive_overview: `This sample report surfaced ${companies.length} startup opportunities. ${strongestDomain?.name} shows the strongest current momentum, while ${weakestDomain?.name} needs the most careful diligence based on the present sample.`,
    best_startup_by_domain: domainWinners.map(({ domain, company, scorecard }) => ({
      domain,
      company: company.name,
      overall_score: scorecard.overall_score,
      why_it_won: company.pros?.[0] || "Highest score in domain.",
      main_risk: company.risk_flags?.[0]?.explanation || "No risk recorded.",
      confidence_level: scorecard.confidence_label,
      suggested_next_step: company.diligence_questions?.[0] || "Run human diligence.",
    })),
    top_10_startups: topCompanies.map(({ company, scorecard }, index) => ({
      rank: index + 1,
      company: company.name,
      domain: company.domain,
      score: scorecard.overall_score,
      one_sentence_thesis: company.product_summary,
      key_evidence: company.evidence?.confirmed?.[0] || "Source record only.",
      main_concern: company.risk_flags?.[0]?.explanation || "No risk recorded.",
      recommended_action: "Prepare memo and verify source-backed claims.",
    })),
    domain_momentum: domainSummaries,
    investor_targets: matches.map((match) => ({
      investor_name: match.investor.name,
      type: match.investor.type,
      relevant_thesis: match.investor.thesis,
      best_matched_company: companies.find((company) => company.id === match.company_id)?.name,
      why_they_fit: match.reasoning,
      why_they_might_care: match.why_this_firm_might_care,
      why_they_might_pass: match.why_this_firm_might_pass,
      relevant_partners: match.relevant_partners?.map((partner) => partner.name) || [],
      confidence_level: match.confidence_level,
      suggested_outreach_angle: match.suggested_angle,
    })),
    best_startup_by_vc_firm: bestByInvestor.map((match) => ({
      investor_name: match.investor.name,
      company: companies.find((company) => company.id === match.company_id)?.name,
      vc_fit_score: match.match_score,
      confidence_level: match.confidence_level,
      relevant_partners: match.relevant_partners?.map((partner) => partner.name) || [],
      why_they_might_care: match.why_this_firm_might_care,
      why_they_might_pass: match.why_this_firm_might_pass,
      suggested_outreach_angle: match.suggested_angle,
    })),
    proposals,
    outreach_drafts: outreachDrafts,
    diligence_questions: Array.from(new Set(topCompanies.flatMap(({ company }) => company.diligence_questions || []))).slice(0, 15),
    limitations: options.limitations || [
      "Sample records are fictional placeholders for MVP demonstration.",
      "Scores are analytical estimates, not investment advice.",
      "Revenue, funding, customer names, and founder credentials must be independently verified.",
      "Investor matches indicate thesis relevance, not actual investor interest.",
    ],
  };

  const content_markdown = renderWeeklyMarkdown(content_json);

  return {
    id: `report-weekly-${period_start}-${period_end}`,
    title,
    report_type: "weekly",
    period_start,
    period_end,
    content_markdown,
    content_json,
    created_at: new Date().toISOString(),
  };
}

function renderWeeklyMarkdown(report) {
  return `# ${report.title}

## Executive Overview
${report.executive_overview}

## Best Startup by Domain
${report.best_startup_by_domain
  .map(
    (item) => `### ${item.domain}
- Best startup: ${item.company}
- Overall score: ${item.overall_score}
- Why it won: ${item.why_it_won}
- Main risk: ${item.main_risk}
- Confidence level: ${item.confidence_level}
- Suggested next step: ${item.suggested_next_step}`
  )
  .join("\n\n")}

## Top 10 Startups Overall
${report.top_10_startups
  .map(
    (item) => `${item.rank}. ${item.company} (${item.domain}) - ${item.score}/100
   - Thesis: ${item.one_sentence_thesis}
   - Key evidence: ${item.key_evidence}
   - Main concern: ${item.main_concern}
   - Recommended action: ${item.recommended_action}`
  )
  .join("\n")}

## Domain Momentum
${report.domain_momentum
  .map(
    (domain) => `- ${domain.name}: ${domain.company_count} companies, ${domain.average_score}/100 average score. ${domain.market_context} Investor interest: ${domain.investor_interest_score}/100.`
  )
  .join("\n")}

## VC / Investor Outreach Targets
${report.investor_targets
  .slice(0, 12)
  .map(
    (target) => `- ${target.investor_name} (${target.type}) for ${target.best_matched_company}: ${target.suggested_outreach_angle}`
  )
  .join("\n")}

## Best Startup by VC Firm
${report.best_startup_by_vc_firm
  .map(
    (item) => `- ${item.investor_name}: ${item.company} - ${item.vc_fit_score}/100 fit. ${item.suggested_outreach_angle}`
  )
  .join("\n")}

## Drafted Proposals
${report.proposals
  .map((proposal) => `### ${proposal.subject}\n\n${proposal.short_email}\n\n${proposal.body_markdown}`)
  .join("\n\n")}

## Diligence Questions
${report.diligence_questions.map((question) => `- ${question}`).join("\n")}

## Limitations
${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
