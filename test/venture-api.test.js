import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

import { runWeeklyScan } from "../lib/pipeline.js";
import { getVentureStore } from "../server/ventureStore.js";

function mockHnFetch() {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        hits: [
          {
            objectID: "42600002",
            title: "Launch HN: ContractLens - AI review for sales contracts",
            url: "https://example.com/contractlens",
            author: "founder",
            points: 54,
            num_comments: 14,
            created_at: "2026-06-18T12:00:00Z",
            story_text: "ContractLens helps revenue teams review risky terms before signature.",
          },
        ],
      };
    },
  });
}

test("venture runtime store can persist a mocked HN scan", async () => {
  const runtimeDir = await mkdtemp(join(tmpdir(), "venture-radar-api-"));
  const env = {
    ...process.env,
    VENTURE_RADAR_RUNTIME_PATH: join(runtimeDir, "runtime.json"),
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
  };
  const store = getVentureStore(env);
  const state = await store.readState();
  const job = await store.createJob({ source: "hn" });
  const result = await runWeeklyScan({
    companies: state.companies,
    investors: state.investors,
    fetchImpl: mockHnFetch(),
    limit: 1,
    now: new Date("2026-06-19T12:00:00Z"),
  });
  const nextState = await store.completeJob(job.id, result);

  assert.equal(nextState.dataMode, "local");
  assert.equal(nextState.jobs[0].status, "completed");
  assert.ok(nextState.companies.some((company) => company.name === "ContractLens"));
  assert.ok(nextState.reports[0].content_markdown.includes("HN launch profiles"));
});
