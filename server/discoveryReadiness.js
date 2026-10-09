import { getPrimoApiStatus } from "./primoApi.js";
import { getOpenAlexStatus } from "./openalex.js";

/** Configuration inventory only: never makes a request or exposes endpoints/keys. */
export function getDiscoveryReadiness(env = process.env) {
  const primo = getPrimoApiStatus(env);
  const oa = getOpenAlexStatus({ apiKey: env.OPENALEX_API_KEY || "", enabled: String(env.OPENALEX_LIVE || "on").toLowerCase() !== "off" });
  const publicEnabled = String(env.PRIMO_LIVE || "on").toLowerCase() !== "off";
  const institutionalEnabled = primo.eligibleForStudentResults;
  return {
    atLeastOneConfigured: publicEnabled || institutionalEnabled || oa.enabled,
    liveReachability: "unmeasured",
    interpretation: "Configuration is not live availability, retrieval success, access entitlement, or source accuracy. Crossref is a scholarly metadata fallback, not a configured catalog provider.",
    lanes: {
      library: { configured: publicEnabled || institutionalEnabled },
      openAccess: { configured: oa.enabled },
    },
    providers: {
      publicPrimo: { configured: publicEnabled, enabled: publicEnabled, active: publicEnabled && !institutionalEnabled, role: institutionalEnabled ? "fallback" : "primary", reason: publicEnabled ? "public-metadata-enabled" : "disabled-by-config" },
      institutionalPrimo: { configured: primo.configured, enabled: institutionalEnabled, profile: primo.profile, eligibleForStudentResults: institutionalEnabled, reason: primo.reason },
      openAlex: { configured: oa.configured, enabled: oa.enabled, reason: oa.reason },
      crossref: { role: "scholarly-metadata-fallback", configurationRequired: false, countedForPrimaryReadiness: false },
    },
  };
}
