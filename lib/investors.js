import { normalizeVcProfile } from "./vcProfiles.js";

function overlap(a = [], b = []) {
  const normalized = new Set(a.map((item) => String(item).toLowerCase()));
  return b.filter((item) => normalized.has(String(item).toLowerCase()));
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeStage(stage) {
  return String(stage || "").toLowerCase().replace(/\s+/g, "-");
}

function stageScore(companyStage, investorStages = []) {
  const target = normalizeStage(companyStage);
  return investorStages.some((stage) => normalizeStage(stage) === target) ? 16 : 5;
}

function domainScore(company, investor) {
  const companyTerms = [company.domain, company.subdomain, ...(company.tags || [])].filter(Boolean);
  const matches = overlap(companyTerms, investor.domains || investor.sector_focus || []);
  if (matches.includes(company.domain)) return 28;
  if (matches.length) return 16;
  const broadText = `${companyTerms.join(" ")} ${(investor.domains || []).join(" ")}`.toLowerCase();
  if (/applied ai|consumer ai|ai-native/.test(broadText) && /consumer ai|enterprise saas|developer tools/.test(broadText)) return 8;
  return 0;
}

function geographyScore(company, investor) {
  const geos = investor.geography || [];
  if (geos.includes("Global")) return 8;
  return geos.some((geo) => String(company.geography || "").includes(geo)) ? 8 : 3;
}

function thesisScore(company, investor) {
  const text = `${investor.thesis} ${investor.relevance_notes} ${investor.public_thesis_language} ${(investor.business_model_preference || []).join(" ")} ${(investor.examples_fit || []).join(" ")}`.toLowerCase();
  const hits = [company.domain, company.subdomain, company.business_model, company.positioning_wedge, ...(company.tags || [])].filter((term) =>
    text.includes(String(term || "").toLowerCase().split(" ")[0])
  );
  return Math.min(16, hits.length * 4);
}

function strategicScore(company, investor) {
  const type = String(investor.type || "").toLowerCase();
  const profileText = `${investor.name} ${investor.risk_tolerance} ${investor.technical_depth_preference} ${(investor.examples_fit || []).join(" ")} ${(investor.historical_investments || []).join(" ")}`.toLowerCase();
  const companyText = `${company.domain} ${company.subdomain} ${company.description} ${company.positioning_wedge || ""} ${company.technical_summary || ""} ${(company.tags || []).join(" ")}`.toLowerCase();
  if (type.includes("strategic") && /operations|robotics|healthcare|warehouse|industrial/i.test(`${company.domain} ${company.description}`)) {
    return 8;
  }
  if (/very_high|high/.test(profileText) && /robotics|defense|infrastructure|biotech|climate|hard|deep|compute|industrial|logistics/i.test(companyText)) {
    return 8;
  }
  if (/network effects|marketplaces/.test(profileText) && /consumer|marketplace|network|social|community/.test(companyText)) return 8;
  if (type.includes("accelerator") && /pre-seed/i.test(company.stage)) return 6;
  if (type.includes("university") && /university|education|research|student/i.test(`${company.domain} ${company.description}`)) return 6;
  return 3;
}

function technicalPreferenceScore(company, investor) {
  const preference = String(investor.technical_depth_preference || "medium").toLowerCase();
  const technicalSignal = Number(company.score_inputs?.technical_defensibility || 0);
  if (preference === "very_high") return technicalSignal >= 80 ? 10 : technicalSignal >= 65 ? 7 : 1;
  if (preference === "high" || preference === "medium_high") return technicalSignal >= 70 ? 9 : technicalSignal >= 55 ? 6 : 2;
  return technicalSignal >= 45 ? 5 : 3;
}

function riskToleranceScore(company, investor) {
  const tolerance = String(investor.risk_tolerance || "medium").toLowerCase();
  const highRisk = (company.risk_flags || []).some((risk) => risk.severity === "high");
  if (!highRisk) return 7;
  if (tolerance === "very_high") return 5;
  if (tolerance === "high" || tolerance === "medium_high") return 3;
  return 1;
}

function tractionFitScore(company) {
  const tractionSignal = Number(company.score_inputs?.traction_signal || 0);
  if (tractionSignal >= 78) return 7;
  if (tractionSignal >= 65) return 5;
  if (tractionSignal >= 50) return 3;
  return 1;
}

function confidenceForScore(score, company) {
  const evidenceCount = [
    ...(company.evidence?.confirmed || []),
    ...(company.evidence?.inferred || []),
  ].length;
  if (score >= 80 && evidenceCount >= 3) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

function relevantPartners(company, investor) {
  const text = `${company.domain} ${company.subdomain} ${(company.tags || []).join(" ")}`.toLowerCase();
  const partners = (investor.partner_interests || [])
    .map((partner) => ({
      ...partner,
      hits: (partner.areas || []).filter((area) => text.includes(String(area).toLowerCase().split(" ")[0])).length,
    }))
    .filter((partner) => partner.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map(({ hits, ...partner }) => partner);
  if (partners.length) return partners;
  return (investor.partner_interests || []).slice(0, 2);
}

function firstRisk(company) {
  return company.risk_flags?.[0]?.explanation || "Unverified traction and source depth may limit confidence.";
}

function possessive(name) {
  return String(name).endsWith("s") ? `${name}'` : `${name}'s`;
}

function articleFor(value) {
  return /^[aeiou]/i.test(String(value || "")) ? "an" : "a";
}

function matchedSectorText(company, investor) {
  const matches = overlap([company.domain, company.subdomain, ...(company.tags || [])], investor.domains || investor.sector_focus || []);
  return matches.length ? matches.slice(0, 2).join(" / ") : company.domain;
}

function whyCare(company, investor, componentScores) {
  const sector = matchedSectorText(company, investor);
  const parts = [
    `${company.name} is ${articleFor(company.domain)} ${company.domain} company around ${company.positioning_wedge || String(company.subdomain || "").toLowerCase()}.`,
  ];
  if (componentScores.sector_fit >= 16) {
    parts.push(`That maps to ${investor.name}'s ${sector} focus.`);
  } else {
    parts.push(`The sector fit is indirect, so this should be framed as an adjacent thesis check rather than a core fit.`);
  }
  if (componentScores.technical_fit >= 7) {
    parts.push(`The source suggests enough technical depth for ${investor.name}'s stated technical preference.`);
  }
  if (componentScores.traction_fit >= 5) {
    parts.push(company.traction_summary || "There is some public traction signal, but it still needs diligence.");
  }
  return parts.join(" ");
}

function suggestedAngle(company, matchScore) {
  const wedge = company.positioning_wedge || String(company.subdomain || company.domain).toLowerCase();
  const diligence = company.diligence_questions?.[0] || "verify the core customer evidence";
  if (matchScore >= 82) {
    return `Lead with ${possessive(company.name)} ${wedge}, then show the source evidence and the first diligence question: ${diligence}`;
  }
  return `Frame ${company.name} as a possible thesis-adjacent lead around ${wedge}; be explicit about the open diligence question: ${diligence}`;
}

export function matchInvestors(company, investors, limit = 5) {
  return investors
    .map((rawInvestor) => {
      const investor = normalizeVcProfile(rawInvestor);
      const component_scores = {
        stage_fit: stageScore(company.stage, investor.stages),
        sector_fit: domainScore(company, investor),
        geography_fit: geographyScore(company, investor),
        thesis_fit: thesisScore(company, investor),
        strategic_fit: strategicScore(company, investor),
        technical_fit: technicalPreferenceScore(company, investor),
        risk_fit: riskToleranceScore(company, investor),
        traction_fit: tractionFitScore(company),
      };
      const match_score = clampScore(Object.values(component_scores).reduce((total, score) => total + score, 0));
      const partners = relevantPartners(company, investor);
      const partnerNames = partners.map((partner) => partner.name).filter(Boolean);
      const confidence_level = confidenceForScore(match_score, company);
      const why_this_firm_might_care = whyCare(company, investor, component_scores);
      const why_this_firm_might_pass = `${investor.name} may pass if diligence cannot verify ${firstRisk(company).toLowerCase()}`;
      return {
        id: `${company.id}-${investor.id}`,
        company_id: company.id,
        investor_id: investor.id,
        investor,
        match_score,
        vc_fit_score: match_score,
        component_scores,
        confidence_level,
        relevant_partners: partners,
        why_this_firm_might_care,
        why_this_firm_might_pass,
        best_contact_target: partnerNames[0] || investor.partner_names?.[0] || investor.name,
        reasoning: `${investor.name} matches ${company.name} through ${matchedSectorText(company, investor)} fit, ${company.stage} stage fit, and relevance to ${company.positioning_wedge || company.subdomain}.`,
        suggested_angle: suggestedAngle(company, match_score),
        created_at: new Date().toISOString(),
      };
    })
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limit);
}

export function matchInvestorsForCompanies(companies, investors, limitPerCompany = 3) {
  return companies.flatMap((company) => matchInvestors(company, investors, limitPerCompany));
}

export function bestCompanyForEachInvestor(companies, investors) {
  return investors.map((investor) => {
    const matches = companies
      .map((company) => matchInvestors(company, [investor], 1)[0])
      .sort((a, b) => b.match_score - a.match_score);
    return matches[0];
  });
}
