import "dotenv/config";
import { pathToFileURL } from "node:url";
import { getDiscoveryReadiness } from "../server/discoveryReadiness.js";

const HELP = `Usage: node scripts/check-discovery.mjs [--live] [--scope library|open-access|both]
Default: configuration-only report; no network requests or AI calls.
--live: one fixed public bibliographic query (climate change and biodiversity),
bounded to 10 seconds overall. Reports counts and provider outcomes, never accuracy.
No student query input, result titles, credentials, or endpoint URLs are printed.
Exit 1 if a requested lane is unavailable, incomplete, or reports a failed attempt.
An empty completed search is reachable, but is not evidence of useful results.
`;
const COMPLETED = new Set(["success", "empty"]);
const PROVIDERS = new Set(["Primo API", "Primo public", "Crossref", "OpenAlex"]);
const STATUSES = new Set(["success", "empty", "error", "timeout", "rate_limited", "cancelled", "disabled", "unsupported", "not_requested"]);

export async function runDiscoveryCheck(args = [], { env = process.env, discover } = {}) {
  if (args.includes("--help")) return { exitCode: 0, help: HELP };
  let scope = "library";
  let live = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--live") live = true;
    else if (args[index] === "--scope" && ["library", "open-access", "both"].includes(args[index + 1])) scope = args[++index];
    else return { exitCode: 2, report: { ok: false, error: "Invalid option. Use --help for supported arguments." } };
  }
  const configuration = getDiscoveryReadiness(env);
  if (!live) return { exitCode: 0, report: { mode: "configuration-only", configuration, networkRequestsMade: false } };
  const requested = scope === "both" ? ["library", "openAccess"] : [scope === "open-access" ? "openAccess" : "library"];
  const controller = new AbortController();
  let timer;
  try {
    const search = discover || (await import("../server/sourceDiscovery.js")).discoverSourcesForScope;
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("DIAGNOSTIC_TIMEOUT")); }, 10000); });
    const discovery = await Promise.race([search(["climate change AND biodiversity"], 3, "scholarly", scope, {
      signal: controller.signal, timeoutMs: 4000, discoveryBudgetMs: 8000,
      researchSpec: { topic: "climate change and biodiversity", mode: "scholarly", concepts: [{ preferredTerm: "climate change", required: true }, { preferredTerm: "biodiversity", required: true }], facets: {} },
    }), deadline]);
    const lanes = Object.fromEntries(requested.map((lane) => {
      const attempts = (discovery.outcomes?.[lane] || []).map((attempt) => ({
        provider: PROVIDERS.has(attempt.provider) ? attempt.provider : "Other provider",
        status: STATUSES.has(attempt.status) ? attempt.status : "error",
        ...(Number.isInteger(attempt.resultCount) ? { resultCount: attempt.resultCount } : {}),
      }));
      const passed = configuration.lanes[lane].configured && attempts.length > 0 && attempts.every((attempt) => COMPLETED.has(attempt.status));
      return [lane, { configured: configuration.lanes[lane].configured, completedWithoutFailure: passed, attempts }];
    }));
    const ok = Object.values(lanes).every((lane) => lane.completedWithoutFailure);
    return { exitCode: ok ? 0 : 1, report: { mode: "live-diagnostic", ok, scope, configuration, lanes, resultCount: discovery.results?.length || 0, interpretation: "One diagnostic retrieval, not a source accuracy or access-rights evaluation. Zero results may still be a completed request." } };
  } catch {
    return { exitCode: 1, report: { mode: "live-diagnostic", ok: false, scope, configuration, error: controller.signal.aborted ? "DIAGNOSTIC_TIMEOUT" : "DISCOVERY_CHECK_FAILED" } };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runDiscoveryCheck(process.argv.slice(2));
  console.log(result.help || JSON.stringify(result.report, null, 2));
  process.exitCode = result.exitCode;
}
