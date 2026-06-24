import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { createSupabaseRestClient, hasSupabaseServerConfig } from "../lib/db.js";
import { companyFingerprint } from "../lib/dedupe.js";
import { generateWeeklyReport } from "../lib/reports.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const CONFIG_DIR = join(__dirname, "..", "config");
const RUNTIME_PATH = join(DATA_DIR, "venture_runtime.json");

async function readJson(filename) {
  const text = await readFile(join(DATA_DIR, filename), "utf8");
  return JSON.parse(text);
}

async function baseState() {
  const [companies, investors, sources, vcProfiles] = await Promise.all([
    readJson("sample_startups.json"),
    readJson("sample_investors.json"),
    readJson("sample_sources.json"),
    readFile(join(CONFIG_DIR, "vc_profiles.json"), "utf8").then(JSON.parse),
  ]);
  const investorRows = [...vcProfiles, ...investors];
  return {
    dataMode: "local",
    companies,
    investors: investorRows,
    sources,
    reports: [generateWeeklyReport(companies, investorRows)],
    jobs: [],
  };
}

function normalizeState(state) {
  return {
    dataMode: state.dataMode || "local",
    companies: Array.isArray(state.companies) ? state.companies : [],
    investors: Array.isArray(state.investors) ? state.investors : [],
    sources: Array.isArray(state.sources) ? state.sources : [],
    reports: Array.isArray(state.reports) ? state.reports : [],
    jobs: Array.isArray(state.jobs) ? state.jobs : [],
    storageError: state.storageError || "",
  };
}

function mergeCompanies(existing, incoming) {
  const byKey = new Map();
  for (const company of existing) {
    byKey.set(companyFingerprint(company) || company.id, company);
  }
  for (const company of incoming) {
    const key = companyFingerprint(company) || company.id;
    byKey.set(key, { ...byKey.get(key), ...company });
  }
  return Array.from(byKey.values()).sort((a, b) => String(b.discovered_at || "").localeCompare(String(a.discovered_at || "")));
}

function jobLog(message, meta = {}) {
  return { at: new Date().toISOString(), message, ...meta };
}

function uuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function companyRow(company) {
  return {
    source_uid: company.source_uid || companyFingerprint(company),
    name: company.name,
    website_url: company.website_url || null,
    source_url: company.source_url || null,
    source_name: company.source_name || null,
    discovered_at: company.discovered_at || new Date().toISOString(),
    launch_date: company.launch_date || null,
    domain: company.domain || "Unknown",
    subdomain: company.subdomain || null,
    description: company.description || null,
    product_summary: company.product_summary || null,
    business_model: company.business_model || null,
    target_customer: company.target_customer || null,
    pricing: company.pricing || null,
    geography: company.geography || null,
    stage: company.stage || null,
    funding_status: company.funding_status || null,
    founders: company.founders || [],
    founder_background_summary: company.founder_background_summary || null,
    technical_summary: company.technical_summary || null,
    traction_summary: company.traction_summary || null,
    competitors: company.competitors || [],
    tags: company.tags || [],
    confidence_score: company.confidence_score || 0,
    score_inputs: company.score_inputs || {},
    evidence: company.evidence || {},
    traction_signals: company.traction_signals || [],
    pros: company.pros || [],
    cons: company.cons || [],
    risk_flags: company.risk_flags || [],
    diligence_questions: company.diligence_questions || [],
    raw_candidate: company.raw_candidate || {},
  };
}

function hydrateCompany(row) {
  return {
    ...row,
    id: row.id,
    source_uid: row.source_uid || companyFingerprint(row),
    founders: row.founders || [],
    competitors: row.competitors || [],
    tags: row.tags || [],
    score_inputs: row.score_inputs || {},
    evidence: row.evidence || { confirmed: [], inferred: [], unverified: [], needs_diligence: [] },
    traction_signals: row.traction_signals || [],
    pros: row.pros || [],
    cons: row.cons || [],
    risk_flags: row.risk_flags || [],
    diligence_questions: row.diligence_questions || [],
  };
}

class LocalVentureStore {
  dataMode = "local";

  constructor(env = process.env) {
    this.runtimePath = env.VENTURE_RADAR_RUNTIME_PATH || RUNTIME_PATH;
  }

  async readState() {
    try {
      const text = await readFile(this.runtimePath, "utf8");
      const parsed = normalizeState(JSON.parse(text));
      if (!parsed.sources.length || !parsed.investors.length || !parsed.companies.length) {
        const fallback = await baseState();
        return normalizeState({ ...fallback, ...parsed, dataMode: "local" });
      }
      return { ...parsed, dataMode: "local" };
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      const state = await baseState();
      await this.writeState(state);
      return state;
    }
  }

  async writeState(state) {
    await mkdir(dirname(this.runtimePath), { recursive: true });
    await writeFile(this.runtimePath, `${JSON.stringify(normalizeState(state), null, 2)}\n`, "utf8");
  }

  async createJob({ source = "hn" } = {}) {
    const state = await this.readState();
    const job = {
      id: `job-${Date.now()}`,
      job_type: "weekly_scan",
      source,
      status: "running",
      started_at: new Date().toISOString(),
      completed_at: null,
      logs: [jobLog("Started weekly source scan.", { source })],
      error: null,
    };
    await this.writeState({ ...state, jobs: [job, ...state.jobs].slice(0, 50) });
    return job;
  }

  async completeJob(jobId, result) {
    const state = await this.readState();
    const companies = mergeCompanies(state.companies, [...(result.newCompanies || []), ...(result.updatedCompanies || [])]);
    const reports = [result.report, ...state.reports.filter((report) => report.id !== result.report.id)].slice(0, 20);
    const jobs = state.jobs.map((job) =>
      job.id === jobId
        ? {
          ...job,
          status: "completed",
          completed_at: new Date().toISOString(),
          logs: [
            ...(job.logs || []),
            jobLog("Completed weekly source scan.", {
              fetched_count: result.fetched_count,
              new_company_count: result.new_company_count,
              updated_company_count: result.updated_company_count || 0,
              duplicate_count: result.duplicate_count,
            }),
          ],
        }
        : job
    );
    await this.writeState({ ...state, companies, reports, jobs });
    return this.readState();
  }

  async failJob(jobId, error) {
    const state = await this.readState();
    const jobs = state.jobs.map((job) =>
      job.id === jobId
        ? {
          ...job,
          status: "failed",
          completed_at: new Date().toISOString(),
          error: error.message,
          logs: [...(job.logs || []), jobLog("Source scan failed.", { error: error.message })],
        }
        : job
    );
    await this.writeState({ ...state, jobs });
  }
}

class SupabaseVentureStore {
  dataMode = "supabase";

  constructor(client) {
    this.client = client;
  }

  async readState() {
    const fallback = await baseState();
    const [companies, investors, reports, jobs] = await Promise.all([
      this.client.select("companies", "select=*&order=discovered_at.desc"),
      this.client.select("investors", "select=*"),
      this.client.select("reports", "select=*&order=created_at.desc&limit=20"),
      this.client.select("jobs", "select=*&order=started_at.desc&limit=50"),
    ]);

    return {
      dataMode: this.dataMode,
      companies: companies?.length ? companies.map(hydrateCompany) : fallback.companies,
      investors: investors?.length ? investors : fallback.investors,
      sources: fallback.sources,
      reports: reports?.length ? reports : fallback.reports,
      jobs: jobs || [],
    };
  }

  async createJob({ source = "hn" } = {}) {
    const [job] = await this.client.insert("jobs", {
      job_type: "weekly_scan",
      status: "running",
      started_at: new Date().toISOString(),
      logs: [jobLog("Started weekly source scan.", { source })],
    });
    return job;
  }

  async completeJob(jobId, result) {
    const companiesToPersist = [...(result.newCompanies || []), ...(result.updatedCompanies || [])];
    const persistedCompanies = companiesToPersist.length
      ? await this.client.upsert("companies", companiesToPersist.map(companyRow), { onConflict: "source_uid" })
      : [];
    const bySourceUid = new Map((persistedCompanies || []).map((row) => [row.source_uid, row.id]));

    if (persistedCompanies?.length) {
      const sourceRows = companiesToPersist
        .map((company) => ({
          company_id: bySourceUid.get(company.source_uid || companyFingerprint(company)),
          source_name: company.source_name || "Unknown source",
          source_url: company.source_url || "",
          raw_text: company.raw_candidate?.raw_text || company.description || "",
          extracted_text: company.description || "",
          reliability_score: Math.max(0, Math.min(1, (company.confidence_score || 64) / 100)),
        }))
        .filter((row) => row.company_id && row.source_url);
      if (sourceRows.length) await this.client.insert("company_sources", sourceRows, { prefer: "return=minimal" });

      const persistedIds = new Set(companiesToPersist.map((company) => company.id));
      const scoreRows = result.scorecards
        .filter(({ company }) => persistedIds.has(company.id))
        .map(({ company, scorecard }) => ({
          company_id: bySourceUid.get(company.source_uid || companyFingerprint(company)),
          founder_score: scorecard.founder_score,
          market_score: scorecard.market_score,
          product_score: scorecard.product_score,
          traction_score: scorecard.traction_score,
          defensibility_score: scorecard.defensibility_score,
          timing_score: scorecard.timing_score,
          risk_score: scorecard.risk_score,
          overall_score: scorecard.overall_score,
          explanation: scorecard.explanation,
        }))
        .filter((row) => row.company_id);
      if (scoreRows.length) await this.client.insert("company_scores", scoreRows, { prefer: "return=minimal" });

      const riskRows = companiesToPersist.flatMap((company) =>
        (company.risk_flags || [])
          .map((risk) => ({
            company_id: bySourceUid.get(company.source_uid || companyFingerprint(company)),
            risk_type: risk.risk_type,
            severity: risk.severity,
            explanation: risk.explanation,
            evidence_url: risk.evidence_url || company.source_url,
          }))
          .filter((row) => row.company_id)
      );
      if (riskRows.length) await this.client.insert("company_risks", riskRows, { prefer: "return=minimal" });
    }

    const matchRows = result.investorMatches
      .map((match) => ({
        company_id: bySourceUid.get(result.companies.find((company) => company.id === match.company_id)?.source_uid),
        investor_id: match.investor_id,
        match_score: match.match_score,
        reasoning: match.reasoning,
        suggested_angle: match.suggested_angle,
      }))
      .filter((row) => uuidLike(row.company_id) && uuidLike(row.investor_id));
    if (matchRows.length) {
      await this.client.upsert("investor_matches", matchRows, {
        onConflict: "company_id,investor_id",
        prefer: "resolution=merge-duplicates,return=minimal",
      });
    }

    await this.client.insert("reports", {
      title: result.report.title,
      report_type: result.report.report_type,
      period_start: result.report.period_start,
      period_end: result.report.period_end,
      content_markdown: result.report.content_markdown,
      content_json: result.report.content_json,
    }, { prefer: "return=minimal" });

    await this.client.update("jobs", { id: `eq.${jobId}` }, {
      status: "completed",
      completed_at: new Date().toISOString(),
      logs: [
        jobLog("Completed weekly source scan.", {
          fetched_count: result.fetched_count,
          new_company_count: result.new_company_count,
          updated_company_count: result.updated_company_count || 0,
          duplicate_count: result.duplicate_count,
        }),
      ],
    }, { prefer: "return=minimal" });

    return this.readState();
  }

  async failJob(jobId, error) {
    await this.client.update("jobs", { id: `eq.${jobId}` }, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error: error.message,
      logs: [jobLog("Source scan failed.", { error: error.message })],
    }, { prefer: "return=minimal" });
  }
}

export function getVentureStore(env = process.env) {
  if (hasSupabaseServerConfig(env)) {
    const client = createSupabaseRestClient(env);
    if (client) return new SupabaseVentureStore(client);
  }
  return new LocalVentureStore(env);
}

export async function readVentureState(env = process.env) {
  const store = getVentureStore(env);
  try {
    return await store.readState();
  } catch (err) {
    if (store.dataMode === "supabase") {
      const fallback = new LocalVentureStore(env);
      const state = await fallback.readState();
      return { ...state, dataMode: "local-fallback", storageError: err.message };
    }
    throw err;
  }
}
