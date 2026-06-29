export const DEFAULT_USER_PROFILE = {
  name: "Aidan Oliss",
  role: "Wake Forest student focused on AI governance, startups, political economy, and venture research",
  background:
    "Politics and International Affairs major with Entrepreneurship and Global Trade minors; founder of TaskPilot; experience in private equity deal sourcing, AI policy research, and Python-based market modeling",
  goal: "Surface high-quality early-stage startup opportunities and produce disciplined venture research",
};

function possessive(name) {
  return String(name).endsWith("s") ? `${name}'` : `${name}'s`;
}

export function generateInvestmentMemo(company, scorecard, investorMatch = null) {
  const risks = company.risk_flags || [];
  const confirmed = company.evidence?.confirmed || [];
  const inferred = company.evidence?.inferred || [];
  const unknowns = [...(company.evidence?.unverified || []), ...(company.evidence?.needs_diligence || [])];

  return `# ${company.name} Investment Memo

## Company
${company.name} is a ${company.stage || "stage unknown"} company in ${company.domain}${company.subdomain ? ` (${company.subdomain})` : ""}.

## What It Does
${company.product_summary || company.description}

## Why It Matters
${company.description}

## Why Now
${scorecard.explanation.find((item) => item.component === "timing_signal")?.reasoning || "Timing requires diligence."}

## Founder Signal
Score: ${scorecard.founder_score}/100. ${company.founder_background_summary || "Founder background requires diligence."}

## Market Signal
Score: ${scorecard.market_score}/100. Target customer: ${company.target_customer || "unknown"}.

## Product Signal
Score: ${scorecard.product_score}/100. Business model: ${company.business_model || "unknown"}.

## Traction Signal
Score: ${scorecard.traction_score}/100. ${company.traction_summary || "No verified traction yet."}

## Evidence Discipline
Confirmed: ${confirmed.length ? confirmed.join(" ") : "No confirmed facts beyond the source record."}

Inferred: ${inferred.length ? inferred.join(" ") : "No model inference recorded."}

Unknowns: ${unknowns.length ? unknowns.join(" ") : "No unknowns recorded."}

## Risks
${risks.length ? risks.map((risk) => `- ${risk.severity.toUpperCase()}: ${risk.risk_type} - ${risk.explanation}`).join("\n") : "- No material risk flags recorded."}

## Diligence Questions
${(company.diligence_questions || ["What evidence supports the core traction claim?"]).map((question) => `- ${question}`).join("\n")}

## Recommendation
Track for human diligence. The current analytical score is ${scorecard.overall_score}/100 with ${scorecard.confidence_label.toLowerCase()} confidence. This is not investment advice.

## Investor Fit
${investorMatch ? `${investorMatch.investor.name}: ${investorMatch.reasoning}` : "Generate investor matches before sending outreach."}
`;
}

export function generateProposal(company, investorMatch, userProfile = DEFAULT_USER_PROFILE) {
  const investor = investorMatch.investor;
  const summary = company.product_summary || company.description || "has an emerging startup profile that needs diligence.";
  const lowerSummary = `${summary.charAt(0).toLowerCase()}${summary.slice(1)}`;
  const subject = `Research memo for ${investor.name}: ${company.name} in ${company.domain}`;
  const short_email = `Hi ${investor.partner_names?.[0] || "there"},

I am reaching out because ${possessive(investor.name)} thesis appears relevant to a new ${company.domain} company I am tracking.

${company.name} is ${lowerSummary}

It may fit your focus on ${investor.thesis.toLowerCase()}

Would you be open to reviewing a short source-backed memo with the main evidence, risks, and diligence questions?`;

  const proposal_memo = `# Proposal Memo: ${company.name} x ${investor.name}

## Opportunity
${company.name} is a newly surfaced ${company.domain} company. ${company.product_summary}

## Why This Investor
${investorMatch.reasoning}

## Why Now
The timing score is ${company.score_inputs?.timing_signal ?? "unknown"}/100, driven by the current market context and sector-specific urgency.

## Company Snapshot
- Stage: ${company.stage || "Unknown"}
- Target customer: ${company.target_customer || "Unknown"}
- Business model: ${company.business_model || "Unknown"}
- Confidence: ${company.confidence_score || "Unknown"}/100

## Evidence
${(company.evidence?.confirmed || []).map((item) => `- ${item}`).join("\n") || "- No confirmed evidence beyond the source record."}

## Risks
${(company.risk_flags || []).map((risk) => `- ${risk.severity}: ${risk.explanation}`).join("\n") || "- Risks require review."}

## Why I Am Surfacing It
${userProfile.name} is a ${userProfile.role}. ${userProfile.background}. Goal: ${userProfile.goal}.

## Suggested Next Step
Ask whether ${investor.name} would review a one-page memo or suggest a relevant partner for initial feedback.`;

  return {
    id: `${company.id}-${investor.id}-proposal`,
    company_id: company.id,
    investor_id: investor.id,
    proposal_type: "investor_outreach",
    subject,
    short_email,
    body_markdown: proposal_memo,
    created_at: new Date().toISOString(),
  };
}

export function generateFirmSpecificMemo(company, scorecard, investorMatch) {
  const investor = investorMatch.investor;
  const partners = (investorMatch.relevant_partners || [])
    .map((partner) => `${partner.name}${partner.areas?.length ? ` (${partner.areas.slice(0, 2).join(", ")})` : ""}`)
    .join(", ") || investorMatch.best_contact_target || investor.name;

  return `# Why ${company.name} Fits ${investor.name}

## Fit Score
${investorMatch.match_score}/100 (${investorMatch.confidence_level || "Medium"} confidence)

## Company Snapshot
- Website: ${company.website_url || "Unknown"}
- Sector: ${company.domain}
- Subsector: ${company.subdomain || "Unknown"}
- Stage estimate: ${company.stage || "Unknown"}
- Overall attractiveness: ${scorecard.overall_score}/100

## Why This Firm Might Care
${investorMatch.why_this_firm_might_care}

## Why This Firm Might Pass
${investorMatch.why_this_firm_might_pass}

## Relevant Partners
${partners}

## Outreach Angle
${investorMatch.suggested_angle}

## Evidence To Lead With
${(company.evidence?.confirmed || ["Source-backed evidence needs review."]).map((item) => `- ${item}`).join("\n")}

## Missing Information
${[...(company.evidence?.unverified || []), ...(company.evidence?.needs_diligence || [])].slice(0, 5).map((item) => `- ${item}`).join("\n") || "- Customer, revenue, and founder background verification."}

## Recommendation
${investorMatch.match_score >= 82 ? "high-priority" : investorMatch.match_score >= 68 ? "reach out" : investorMatch.match_score >= 55 ? "monitor" : "pass"}

## Sources
${[company.source_url, ...(investor.source_links || [])].filter(Boolean).map((url) => `- ${url}`).join("\n")}
`;
}

export function generateOutreachVariants(company, investorMatch, userProfile = DEFAULT_USER_PROFILE) {
  const investor = investorMatch.investor;
  const partner = investorMatch.best_contact_target || investor.partner_names?.[0] || "there";
  const sourceLine = company.source_url ? `Source: ${company.source_url}` : "Source available in the memo.";
  const angle = investorMatch.suggested_angle;

  return {
    investor_linkedin_dm: `Hi ${partner}, I found ${company.name}, a ${company.domain} startup that appears aligned with ${possessive(investor.name)} thesis. I separated source-backed evidence from open diligence questions and can send a one-page memo if useful.`,
    investor_short_email: `Hi ${partner},

I am tracking early-stage companies that fit specific venture theses. ${company.name} surfaced as a potential match for ${investor.name}: ${angle}

I have a concise memo with evidence, risks, and diligence questions. Would it be useful to send it over?

${sourceLine}`,
    investor_system_builder_email: `Hi ${partner},

I built Venture Radar to source and score early-stage startups against firm-specific theses. One current match for ${investor.name} is ${company.name}, in ${company.domain}.

The fit score is ${investorMatch.match_score}/100, with the main open questions around ${company.diligence_questions?.[0] || "customer traction and founder-market fit"}.

I would value feedback on whether this type of source-backed venture screen is useful for your team.`,
    founder_intro_email: `Hi ${company.founders?.[0]?.name || "there"},

I am mapping early-stage companies in ${company.domain}. ${company.name} came up in my research, and I am trying to understand the product, customer evidence, and current financing stage.

Would you be open to a short intro call? I can share the diligence questions I am using so the conversation is concrete.`,
    founder_diligence_questions: (company.diligence_questions || []).slice(0, 5),
  };
}
