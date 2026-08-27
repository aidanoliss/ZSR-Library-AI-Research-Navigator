/**
 * Governance state for integrations that must not be activated by code alone.
 * These records are status contracts, not feature flags or approval claims.
 */
export const RESEARCH_INTEGRATION_POLICY_VERSION = "1.0.0";

export const RESEARCH_INTEGRATION_POLICY = Object.freeze({
  openAccessFullTextSummaries: Object.freeze({
    state: "gated-not-implemented",
    enabled: false,
    retrievesFullText: false,
    requirements: Object.freeze([
      "Institutional pilot owner and written approval",
      "Per-location rights check for the exact version retrieved",
      "Approved content retention and provider privacy terms",
      "Citation-preserving summary evaluation with librarian review",
    ]),
  }),
  sciteMcp: Object.freeze({
    state: "gated-not-integrated",
    enabled: false,
    requirements: Object.freeze([
      "Confirmed institutional subscription and permitted use",
      "OAuth and data-flow privacy review",
      "Vendor retention and citation-context review",
      "Librarian-approved pilot scope",
    ]),
  }),
  repositoryLicense: Object.freeze({
    state: "decision-pending",
    enabled: false,
    note: "A public repository is not represented as open source until a software license is deliberately selected and added.",
  }),
});
