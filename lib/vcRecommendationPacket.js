import { matchInvestors } from "./investors.js";
import { scoreCompanies } from "./scoring.js";
import { hasOutreachReadyCompanySource } from "./sourceQuality.js";
import { refreshExtractedCompanyProfile } from "./sources.js";
import { normalizeVcProfiles } from "./vcProfiles.js";

function sourceLinks(company, investor) {
  return [company.source_url, ...(investor.source_links || [])].filter(Boolean);
}

function recommendationLevel(score) {
  if (score >= 82) return "High-priority";
  if (score >= 68) return "Worth a conversation";
  if (score >= 55) return "Monitor";
  return "Weak fit";
}

function diligenceLine(company) {
  return company.diligence_questions?.[0] || "Verify customer usage, current stage, founder background, and product maturity.";
}

function platformPitch(firmCount, companyCount) {
  return `I built Venture Radar, a source-backed venture intelligence system that ingests public startup signals, deduplicates companies, scores them with explainable criteria, and maps each company against ${firmCount} VC thesis profiles. The current run screened ${companyCount} tracked companies and generated firm-specific recommendations with evidence, pass risks, and diligence questions.`;
}

export function buildVcRecommendationPacket(companies = [], vcProfiles = [], options = {}) {
  const firms = normalizeVcProfiles(vcProfiles);
  const refreshedCompanies = companies.map(refreshExtractedCompanyProfile);
  const outreachCompanies = options.includeMockSources ? refreshedCompanies : refreshedCompanies.filter(hasOutreachReadyCompanySource);
  const scored = scoreCompanies(outreachCompanies);
  const byCompanyId = new Map(scored.map((item) => [item.company.id, item]));
  const topN = options.topN || 4;
  const minFitScore = Number.isFinite(options.minFitScore) ? options.minFitScore : 60;
  const minCompanyScore = Number.isFinite(options.minCompanyScore) ? options.minCompanyScore : 60;

  const firm_recommendations = firms.map((firm) => {
    const matches = outreachCompanies
      .map((company) => {
        const match = matchInvestors(company, [firm], 1)[0];
        const scoredCompany = byCompanyId.get(company.id);
        return {
          company,
          scorecard: scoredCompany?.scorecard,
          match,
        };
      })
      .sort((a, b) => b.match.match_score - a.match.match_score)
      .filter(({ scorecard, match }) => match.match_score >= minFitScore && (scorecard?.overall_score ?? 0) >= minCompanyScore)
      .slice(0, topN);

    return {
      firm: {
        id: firm.id,
        name: firm.name,
        website_url: firm.website_url,
        thesis: firm.thesis,
        sector_focus: firm.domains,
        stage_focus: firm.stages,
        relevant_partners: Array.from(new Set(matches.flatMap(({ match }) => (match.relevant_partners || []).map((partner) => partner.name)))).slice(0, 4),
      },
      recommended_companies: matches.map(({ company, scorecard, match }) => ({
        name: company.name,
        domain: company.domain,
        stage: company.stage || "Unknown",
        source_url: company.source_url,
        company_score: scorecard?.overall_score ?? null,
        vc_fit_score: match.match_score,
        recommendation: recommendationLevel(match.match_score),
        confidence_level: match.confidence_level,
        why_this_firm_might_care: match.why_this_firm_might_care,
        why_this_firm_might_pass: match.why_this_firm_might_pass,
        relevant_partners: (match.relevant_partners || []).map((partner) => partner.name),
        suggested_angle: match.suggested_angle,
        diligence_question: diligenceLine(company),
        sources: sourceLinks(company, firm),
      })),
      outbound_email: buildFirmEmail(firm, matches),
      linkedin_dm: buildFirmLinkedInDm(firm, matches),
    };
  });

  const json = {
    title: "Venture Radar VC Recommendation Packet",
    created_at: options.createdAt || new Date().toISOString(),
    platform_pitch: platformPitch(firms.length, companies.length),
    firm_count: firms.length,
    company_count: companies.length,
    outreach_ready_company_count: outreachCompanies.length,
    excluded_company_count: companies.length - outreachCompanies.length,
    min_fit_score: minFitScore,
    min_company_score: minCompanyScore,
    firm_recommendations,
    caveats: [
      "These are source-backed screening recommendations, not investment advice.",
      "Fit scores estimate thesis relevance and outreach priority, not company quality with certainty.",
      "Customer traction, revenue, founder background, and funding status need direct diligence before any investment claim.",
      "Companies with placeholder or reserved example-domain sources are excluded from outreach packets by default.",
    ],
  };

  return {
    json,
    markdown: renderVcRecommendationPacket(json),
  };
}

function buildFirmEmail(firm, matches) {
  const top = matches[0];
  const companyLines = matches
    .slice(0, 3)
    .map(({ company, match }) => `- ${company.name} (${company.domain}) - ${match.match_score}/100 VC fit. ${match.suggested_angle}`)
    .join("\n") || "- No current company cleared the packet fit threshold for this firm.";

  return `Subject: Source-backed startup recommendations for ${firm.name}

Hi ${top?.match.best_contact_target || "there"},

I built Venture Radar, a venture intelligence system that screens public startup signals and maps companies to firm-specific thesis profiles.

For ${firm.name}, the current run surfaced:

${companyLines}

I am not treating these as investment recommendations. The output is a structured sourcing screen: evidence, fit rationale, pass risks, and diligence questions. I would value 15 minutes of feedback on whether this kind of source-backed sourcing workflow is useful for your team.

Best,
Aidan`;
}

function buildFirmLinkedInDm(firm, matches) {
  const top = matches[0];
  if (!top) {
    return `I built Venture Radar to screen public startup signals against firm-specific VC theses. I did not force a current recommendation for ${firm.name} because no company cleared the fit threshold; I would value feedback on the system and its sourcing workflow.`;
  }
  return `I built Venture Radar to screen public startup signals against firm-specific VC theses. For ${firm.name}, it surfaced ${top?.company.name || "several companies"} as a current fit, with evidence, pass risks, and diligence questions. I would value feedback on the system and whether this kind of sourcing workflow is useful for your team.`;
}

function renderCompany(item) {
  return `### ${item.name}
- Domain: ${item.domain}
- Stage: ${item.stage}
- Company score: ${item.company_score ?? "n/a"}/100
- VC fit score: ${item.vc_fit_score}/100 (${item.confidence_level} confidence)
- Recommendation: ${item.recommendation}
- Why they might care: ${item.why_this_firm_might_care}
- Why they might pass: ${item.why_this_firm_might_pass}
- Suggested angle: ${item.suggested_angle}
- Diligence question: ${item.diligence_question}
- Sources: ${item.sources.join(", ")}`;
}

export function renderVcRecommendationPacket(packet) {
  return `# ${packet.title}

Generated: ${packet.created_at}

## Platform Pitch
${packet.platform_pitch}

Outreach-ready companies: ${packet.outreach_ready_company_count}/${packet.company_count}
Packet fit threshold: ${packet.min_fit_score}/100
Company score threshold: ${packet.min_company_score}/100

## How To Position This
- This is a sourcing and thesis-matching system, not an investment recommendation engine.
- Lead with the product you built, the repeatable workflow, and the evidence discipline.
- Use the company lists as examples of what the system found, then ask for feedback or a conversation.

${packet.firm_recommendations.map((firm) => `## ${firm.firm.name}

Thesis profile: ${firm.firm.thesis}

Relevant partners: ${firm.firm.relevant_partners.length ? firm.firm.relevant_partners.join(", ") : "Not identified from profile data"}

${firm.recommended_companies.length ? firm.recommended_companies.map(renderCompany).join("\n\n") : `No current company cleared the packet thresholds for ${firm.firm.name}.`}

### Suggested Email
${firm.outbound_email}

### LinkedIn DM
${firm.linkedin_dm}
`).join("\n")}

## Caveats
${packet.caveats.map((item) => `- ${item}`).join("\n")}
`;
}
