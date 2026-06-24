import express from "express";

import { matchInvestors } from "../lib/investors.js";
import { runWeeklyScan } from "../lib/pipeline.js";
import { generateWeeklyReport } from "../lib/reports.js";
import { scoreCompanies, summarizeDomains } from "../lib/scoring.js";
import { getVentureStore, readVentureState } from "./ventureStore.js";

export const ventureRouter = express.Router();

function latestReport(state) {
  if (state.reports?.length) return state.reports[0];
  return generateWeeklyReport(state.companies, state.investors);
}

function presentState(state) {
  const scorecards = scoreCompanies(state.companies);
  const domains = summarizeDomains(state.companies, scorecards);
  return {
    ok: true,
    dataMode: state.dataMode,
    storageError: state.storageError || "",
    companies: state.companies,
    investors: state.investors,
    sources: state.sources,
    jobs: state.jobs,
    latestReport: latestReport(state),
    scorecards,
    domains,
  };
}

ventureRouter.get("/state", async (_req, res) => {
  try {
    const state = await readVentureState();
    res.json(presentState(state));
  } catch (err) {
    console.error("[/api/venture/state]", err.message);
    res.status(500).json({ ok: false, error: "Could not read Venture Radar state." });
  }
});

ventureRouter.get("/scorecards", async (_req, res) => {
  try {
    const state = await readVentureState();
    res.json({ ok: true, scorecards: scoreCompanies(state.companies), dataMode: state.dataMode });
  } catch (err) {
    console.error("[/api/venture/scorecards]", err.message);
    res.status(500).json({ ok: false, error: "Could not score companies." });
  }
});

ventureRouter.get("/investor-matches/:companyId", async (req, res) => {
  try {
    const state = await readVentureState();
    const company = state.companies.find((item) => item.id === req.params.companyId);
    if (!company) return res.status(404).json({ ok: false, error: "Company not found." });
    res.json({ ok: true, matches: matchInvestors(company, state.investors, 5), dataMode: state.dataMode });
  } catch (err) {
    console.error("[/api/venture/investor-matches]", err.message);
    res.status(500).json({ ok: false, error: "Could not match investors." });
  }
});

ventureRouter.get("/weekly-report", async (_req, res) => {
  try {
    const state = await readVentureState();
    res.json({ ok: true, report: latestReport(state), dataMode: state.dataMode });
  } catch (err) {
    console.error("[/api/venture/weekly-report]", err.message);
    res.status(500).json({ ok: false, error: "Could not generate weekly report." });
  }
});

ventureRouter.get("/jobs", async (_req, res) => {
  try {
    const state = await readVentureState();
    res.json({ ok: true, jobs: state.jobs, dataMode: state.dataMode });
  } catch (err) {
    console.error("[/api/venture/jobs]", err.message);
    res.status(500).json({ ok: false, error: "Could not read jobs." });
  }
});

ventureRouter.post("/run-weekly-scan", async (req, res) => {
  const source = req.body?.source || "hn";
  const limit = Number(req.body?.limit || 12);
  const store = getVentureStore();
  let job;

  try {
    const state = await store.readState();
    job = await store.createJob({ source });
    const result = await runWeeklyScan({
      source,
      limit: Number.isFinite(limit) ? Math.max(1, Math.min(30, limit)) : 12,
      companies: state.companies,
      investors: state.investors,
    });
    const nextState = await store.completeJob(job.id, result);
    res.json({
      ok: true,
      dataMode: nextState.dataMode,
      jobId: job.id,
      result: {
        fetched_count: result.fetched_count,
        candidate_count: result.candidate_count,
        new_company_count: result.new_company_count,
        duplicate_count: result.duplicate_count,
      },
      state: presentState(nextState),
    });
  } catch (err) {
    console.error("[/api/venture/run-weekly-scan]", err.message);
    if (job) await store.failJob(job.id, err).catch((failErr) => console.error("[/api/venture/run-weekly-scan failJob]", failErr.message));
    res.status(502).json({ ok: false, error: err.message || "Weekly source scan failed." });
  }
});
