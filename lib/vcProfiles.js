export function normalizeVcProfile(profile = {}) {
  const sectorFocus = profile.sector_focus || profile.domains || [];
  const stageFocus = profile.stage_focus || profile.stages || [];
  const partnerNames = profile.partner_names || (profile.partner_interests || []).map((partner) => partner.name);
  const thesis = profile.public_thesis_language || profile.thesis || profile.relevance_notes || "";

  return {
    ...profile,
    type: profile.type || "VC",
    thesis,
    domains: sectorFocus,
    stages: stageFocus,
    sector_focus: sectorFocus,
    stage_focus: stageFocus,
    geography: profile.geography || [],
    partner_names: partnerNames,
    partner_interests: profile.partner_interests || partnerNames.map((name) => ({ name, areas: [] })),
    notable_investments: profile.notable_investments || profile.historical_investments || [],
    historical_investments: profile.historical_investments || profile.notable_investments || [],
    business_model_preference: profile.business_model_preference || [],
    risk_tolerance: profile.risk_tolerance || "medium",
    technical_depth_preference: profile.technical_depth_preference || "medium",
    examples_fit: profile.examples_fit || [],
    examples_not_fit: profile.examples_not_fit || [],
    source_links: profile.source_links || [profile.website_url].filter(Boolean),
    contact_url: profile.contact_url || profile.website_url || "",
  };
}

export function normalizeVcProfiles(profiles = []) {
  return profiles.map((profile) => normalizeVcProfile(profile));
}

export function findVcProfile(profiles = [], idOrName) {
  const target = String(idOrName || "").toLowerCase();
  return normalizeVcProfiles(profiles).find((profile) =>
    String(profile.id).toLowerCase() === target || String(profile.name).toLowerCase() === target
  );
}
