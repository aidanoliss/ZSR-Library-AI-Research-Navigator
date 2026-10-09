import test from "node:test";
import assert from "node:assert/strict";
import { getDiscoveryReadiness } from "../server/discoveryReadiness.js";
import { runDiscoveryCheck } from "../scripts/check-discovery.mjs";

test("configuration readiness distinguishes public discovery from institutional credentials", () => {
  const status = getDiscoveryReadiness({});
  assert.equal(status.atLeastOneConfigured, true);
  assert.equal(status.providers.publicPrimo.active, true);
  assert.equal(status.providers.institutionalPrimo.enabled, false);
  assert.equal(status.providers.openAlex.reason, "missing-api-key");
  assert.equal(status.liveReachability, "unmeasured");
  assert.equal(getDiscoveryReadiness({ PRIMO_LIVE: "off", OPENALEX_LIVE: "off" }).atLeastOneConfigured, false);
});

test("only enabled institutional production discovery is eligible; secrets never appear", () => {
  const env = { PRIMO_LIVE: "off", PRIMO_API_PROFILE: "institutional", PRIMO_API_ENDPOINT: "https://private.example/search", PRIMO_API_KEY: "private-secret", PRIMO_API_USE_FOR_DISCOVERY: "on", OPENALEX_API_KEY: "oa-secret" };
  const status = getDiscoveryReadiness(env);
  assert.equal(status.providers.institutionalPrimo.enabled, true);
  assert.equal(status.providers.openAlex.enabled, true);
  assert.doesNotMatch(JSON.stringify(status), /private-secret|oa-secret|private\.example/);
  assert.equal(getDiscoveryReadiness({ ...env, PRIMO_API_PROFILE: "guest", OPENALEX_LIVE: "off" }).atLeastOneConfigured, false);
  assert.equal(getDiscoveryReadiness({ ...env, PRIMO_API_USE_FOR_DISCOVERY: "off", OPENALEX_LIVE: "off" }).atLeastOneConfigured, false);
});

test("CLI defaults, help, and invalid arguments make no discovery requests", async () => {
  const never = async () => { throw new Error("Unexpected request"); };
  const options = { env: {}, discover: never };
  assert.equal((await runDiscoveryCheck([], options)).report.networkRequestsMade, false);
  assert.match((await runDiscoveryCheck(["--help"], options)).help, /no network requests/);
  assert.equal((await runDiscoveryCheck(["--query", "student private topic"], options)).exitCode, 2);
  assert.equal((await runDiscoveryCheck(["--scope", "invalid"], options)).exitCode, 2);
});

test("live CLI is bounded, reports only counts/outcomes, and distinguishes empty from failure", async () => {
  let calls = 0;
  const discover = async (queries, limit, mode, scope, options) => {
    calls += 1;
    assert.deepEqual(queries, ["climate change AND biodiversity"]);
    assert.equal(limit, 3);
    assert.equal(options.timeoutMs, 4000);
    assert.equal(options.discoveryBudgetMs, 8000);
    assert.ok(options.signal instanceof AbortSignal);
    return { results: [], outcomes: { library: [{ provider: "Primo public", status: "empty", resultCount: 0, query: "private query", apiKey: "secret" }] } };
  };
  const result = await runDiscoveryCheck(["--live"], { env: {}, discover });
  assert.equal(calls, 1);
  assert.equal(result.exitCode, 0);
  assert.doesNotMatch(JSON.stringify(result), /private query|secret/);
  const partial = await runDiscoveryCheck(["--live"], { env: {}, discover: async () => ({ results: [{}], outcomes: { library: [{ provider: "Primo public", status: "timeout" }, { provider: "Crossref", status: "success" }] } }) });
  assert.equal(partial.exitCode, 1);
  const unavailable = await runDiscoveryCheck(["--live", "--scope", "open-access"], { env: {}, discover: async () => ({ outcomes: { openAccess: [{ provider: "OpenAlex", status: "disabled" }] } }) });
  assert.equal(unavailable.exitCode, 1);
});
