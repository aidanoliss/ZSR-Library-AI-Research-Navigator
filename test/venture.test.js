import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCompany, scoreCompanies, summarizeDomains } from "../lib/scoring.js";
import { matchInvestors } from "../lib/investors.js";
import { generateFirmSpecificMemo, generateOutreachVariants } from "../lib/memos.js";
import { generateWeeklyReport } from "../lib/reports.js";
import { unsupportedClaimGuard, validateScorecard } from "../lib/validation.js";
import { dedupeCompanyCandidates } from "../lib/dedupe.js";
import { runWeeklyScan } from "../lib/pipeline.js";
import { extractCompanyFromCandidate, fetchHackerNewsLaunchPosts } from "../lib/sources.js";
import { buildWeeklyScanSummary } from "../lib/weeklySummary.js";
import { buildVcRecommendationPacket } from "../lib/vcRecommendationPacket.js";
import { normalizeVcProfiles } from "../lib/vcProfiles.js";

const startups = JSON.parse(await readFile(new URL("../data/sample_startups.json", import.meta.url), "utf8"));
const investors = JSON.parse(await readFile(new URL("../data/sample_investors.json", import.meta.url), "utf8"));
const vcProfiles = normalizeVcProfiles(JSON.parse(await readFile(new URL("../config/vc_profiles.json", import.meta.url), "utf8")));

test("sample investor database has at least 25 entries", () => {
  assert.ok(investors.length >= 25);
});

test("institutional VC profile config includes the requested firms", () => {
  const names = vcProfiles.map((profile) => profile.name);
  for (const name of ["8VC", "Founders Fund", "Andreessen Horowitz", "General Catalyst", "Lux Capital", "DCVC", "First Round Capital", "Pear VC", "Contrary", "NFX", "Sequoia Capital", "Khosla Ventures"]) {
    assert.ok(names.includes(name), `${name} profile missing`);
  }
  assert.ok(vcProfiles.every((profile) => profile.source_links.length > 0));
});

test("scorecards include numeric component scores and reasoning", () => {
  const scorecard = scoreCompany(startups[0]);
  const validation = validateScorecard(scorecard);
  assert.equal(validation.ok, true);
  assert.ok(scorecard.overall_score >= 0 && scorecard.overall_score <= 100);
  assert.equal(scorecard.explanation.length, 7);
});

test("companies are ranked by overall score", () => {
  const scored = scoreCompanies(startups);
  assert.ok(scored[0].scorecard.overall_score >= scored.at(-1).scorecard.overall_score);
});

test("domain summaries identify a best company", () => {
  const domains = summarizeDomains(startups);
  assert.ok(domains.length >= 10);
  assert.ok(domains.every((domain) => domain.best_company && domain.average_score > 0));
});

test("investor matching returns thesis-relevant matches", () => {
  const company = startups.find((item) => item.domain === "AI infrastructure");
  const matches = matchInvestors(company, investors, 3);
  assert.equal(matches.length, 3);
  assert.ok(matches[0].match_score >= matches[1].match_score);
  assert.match(matches[0].reasoning, new RegExp(company.name));
});

test("VC matching includes firm-specific rationale and partners", () => {
  const company = startups.find((item) => item.domain === "AI infrastructure");
  const matches = matchInvestors(company, vcProfiles, 5);
  assert.equal(matches.length, 5);
  assert.ok(matches[0].vc_fit_score >= matches[1].vc_fit_score);
  assert.ok(matches[0].why_this_firm_might_care.includes(company.name));
  assert.ok(matches[0].why_this_firm_might_pass);
  assert.ok(Array.isArray(matches[0].relevant_partners));
  assert.ok(["Low", "Medium", "High"].includes(matches[0].confidence_level));
});

test("weekly report has required core sections", () => {
  const report = generateWeeklyReport(startups, vcProfiles);
  assert.match(report.content_markdown, /# Weekly Venture Radar Report/);
  assert.match(report.content_markdown, /## Best Startup by Domain/);
  assert.match(report.content_markdown, /## VC \/ Investor Outreach Targets/);
  assert.match(report.content_markdown, /## Best Startup by VC Firm/);
  assert.ok(report.content_json.top_10_startups.length <= 10);
  assert.equal(report.content_json.best_startup_by_vc_firm.length, vcProfiles.length);
  assert.ok(report.content_json.outreach_drafts.length > 0);
  assert.ok(report.content_json.limitations.length > 0);
});

test("firm-specific memo and outreach variants are generated from VC fit", () => {
  const company = startups[0];
  const scorecard = scoreCompany(company);
  const match = matchInvestors(company, vcProfiles, 1)[0];
  const memo = generateFirmSpecificMemo(company, scorecard, match);
  const outreach = generateOutreachVariants(company, match);

  assert.match(memo, new RegExp(`Why ${company.name} Fits`));
  assert.match(memo, /## Why This Firm Might Care/);
  assert.ok(outreach.investor_linkedin_dm.includes(company.name));
  assert.ok(outreach.founder_intro_email.includes(company.domain));
});

test("compliance guard rejects investment-promise language", () => {
  assert.equal(unsupportedClaimGuard("This guarantees a certain return.").ok, false);
  assert.equal(unsupportedClaimGuard("Track for diligence; this is not investment advice.").ok, true);
});

function mockHnFetch() {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        hits: [
          {
            objectID: "42600001",
            title: "Launch HN: LedgerPilot (YC S26) - AI agents for finance operations",
            url: "https://example.com/ledgerpilot",
            author: "founder",
            points: 96,
            num_comments: 31,
            created_at: "2026-06-18T12:00:00Z",
            story_text: "LedgerPilot helps finance teams automate invoice exception workflows.",
          },
        ],
      };
    },
  });
}

function mockHnFetchForClassification() {
  return async (url) => {
    const isItem = String(url).includes("/items/");
    if (isItem) {
      const id = String(url).split("/").pop();
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            children: id === "48543908"
              ? [
                { text: "Several generated plans do not make sense: bedrooms missing closets, external doors against fire code, and a staircase in a single-story home." },
              ]
              : [],
          };
        },
      };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          hits: [
            {
              objectID: "48356312",
              title: "Launch HN: Expanse (YC P26) - Unlock Wasted GPU Capacity",
              url: "",
              author: "founder",
              points: 19,
              num_comments: 5,
              created_at: "2026-06-19T12:00:00Z",
              story_text: "We built Expanse to increase the effective capacity of HPC/GPU clusters running Kubernetes and SLURM by predicting resource needs before scheduling. We are onboarding customers as paid pilots.",
            },
            {
              objectID: "48543908",
              title: "Launch HN: Drafted (YC P26) - Models for residential architecture",
              url: "https://www.drafted.ai",
              author: "founder",
              points: 60,
              num_comments: 63,
              created_at: "2026-06-17T12:00:00Z",
              story_text: "Drafted trains models that generate residential architecture, floor plans, and exterior elevations. More than 120,000 people generated 325,000 home designs.",
            },
            {
              objectID: "48400001",
              title: "Launch HN: Adam (YC W25) - Open-Source AI CAD",
              url: "https://github.com/Adam-CAD/CADAM",
              author: "founder",
              points: 210,
              num_comments: 97,
              created_at: "2026-06-16T12:00:00Z",
              story_text: "Adam is building CADAM, an open source text-to-CAD platform for mechanical design. It outputs OpenSCAD code and parametric 3D models.",
            },
          ],
        };
      },
    };
  };
}

test("HN launch fetch normalizes launch candidates", async () => {
  const result = await fetchHackerNewsLaunchPosts({ fetchImpl: mockHnFetch(), limit: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].name, "LedgerPilot");
  assert.equal(result.candidates[0].metadata.batch, "YC S26");
});

test("HN launch candidates extract source-disciplined company profiles", async () => {
  const result = await fetchHackerNewsLaunchPosts({ fetchImpl: mockHnFetch(), limit: 1 });
  const company = extractCompanyFromCandidate(result.candidates[0]);
  assert.match(company.id, /^cmp-ledgerpilot-/);
  assert.equal(company.source_name, "Hacker News Launch HN");
  assert.equal(company.stage, "Pre-seed");
  assert.ok(company.evidence.confirmed.length > 0);
  assert.ok(company.evidence.unverified.some((item) => /revenue|funding|founder/i.test(item)));
});

test("HN extraction uses precise categories for AI infra, architecture, and CAD", async () => {
  const result = await fetchHackerNewsLaunchPosts({ fetchImpl: mockHnFetchForClassification(), limit: 3 });
  const companies = result.candidates.map(extractCompanyFromCandidate);
  const expanse = companies.find((company) => company.name === "Expanse");
  const drafted = companies.find((company) => company.name === "Drafted");
  const adam = companies.find((company) => company.name === "Adam");

  assert.equal(expanse.domain, "AI infrastructure");
  assert.match(expanse.positioning_wedge, /GPU cluster/i);
  assert.ok(expanse.score_inputs.traction_signal > drafted.score_inputs.traction_signal);
  assert.equal(drafted.domain, "Architecture and design software");
  assert.ok(drafted.risk_flags.some((risk) => risk.risk_type === "Source-quality concerns"));
  assert.equal(adam.domain, "CAD and engineering design tools");
});

test("dedupe prevents repeated source candidates", async () => {
  const result = await fetchHackerNewsLaunchPosts({ fetchImpl: mockHnFetch(), limit: 1 });
  const company = extractCompanyFromCandidate(result.candidates[0]);
  const deduped = dedupeCompanyCandidates([company], [company]);
  assert.equal(deduped.unique.length, 0);
  assert.equal(deduped.duplicates.length, 1);
});

test("weekly scan pipeline adds unique HN companies and report limitations", async () => {
  const result = await runWeeklyScan({
    companies: startups.slice(0, 2),
    investors: investors.slice(0, 4),
    fetchImpl: mockHnFetch(),
    limit: 1,
    now: new Date("2026-06-19T12:00:00Z"),
  });

  assert.equal(result.new_company_count, 1);
  assert.equal(result.duplicate_count, 0);
  assert.ok(result.scorecards.length >= 3);
  assert.match(result.report.content_markdown, /HN launch profiles/);
  assert.doesNotMatch(result.report.content_markdown, /fictional placeholders/);
});

test("weekly scan refreshes duplicate companies with corrected extraction", async () => {
  const staleDrafted = {
    ...startups[0],
    id: "cmp-drafted-stale",
    name: "Drafted",
    domain: "AI infrastructure",
    subdomain: "Model infrastructure",
    source_url: "https://www.drafted.ai",
    source_uid: "src-hn-launch:hn-48543908",
  };
  const result = await runWeeklyScan({
    companies: [staleDrafted],
    investors: investors.slice(0, 4),
    fetchImpl: mockHnFetchForClassification(),
    limit: 3,
    now: new Date("2026-06-19T12:00:00Z"),
  });

  const drafted = result.companies.find((company) => company.id === staleDrafted.id);
  assert.equal(result.updated_company_count, 1);
  assert.equal(drafted.domain, "Architecture and design software");
  assert.equal(drafted.subdomain, "Generative spatial design");
});

test("weekly scan summary reports additions, top companies, and diligence actions", async () => {
  const result = await runWeeklyScan({
    companies: startups.slice(0, 2),
    investors: investors.slice(0, 4),
    fetchImpl: mockHnFetch(),
    limit: 1,
    now: new Date("2026-06-19T12:00:00Z"),
  });
  const summary = buildWeeklyScanSummary(result, {
    dataMode: "local",
    companies: result.companies,
    jobs: [{ id: "job-test", status: "completed" }],
  }, { createdAt: "2026-06-19T12:00:00.000Z" });

  assert.equal(summary.json.new_company_count, 1);
  assert.ok(summary.json.top_new_companies.some((company) => company.name === "LedgerPilot"));
  assert.match(summary.markdown, /## Next Diligence Actions/);
  assert.match(summary.markdown, /HN engagement is treated as community interest/);
});

test("VC recommendation packet creates firm sections and outbound copy", () => {
  const packet = buildVcRecommendationPacket(startups.slice(0, 5), vcProfiles.slice(0, 3), {
    topN: 2,
    minFitScore: 0,
    minCompanyScore: 0,
    createdAt: "2026-06-19T12:00:00.000Z",
    includeMockSources: true,
  });

  assert.equal(packet.json.firm_count, 3);
  assert.equal(packet.json.firm_recommendations[0].recommended_companies.length, 2);
  assert.match(packet.markdown, /## 8VC/);
  assert.match(packet.markdown, /Suggested Email/);
  assert.match(packet.json.firm_recommendations[0].outbound_email, /I built Venture Radar/);
});

test("VC recommendation packet excludes placeholder-source companies by default", () => {
  const realCompany = {
    ...startups[0],
    id: "cmp-real-launch",
    name: "RealLaunch",
    website_url: "https://reallaunch.dev",
    source_url: "https://news.ycombinator.com/item?id=123",
  };
  const packet = buildVcRecommendationPacket([startups[0], realCompany], vcProfiles.slice(0, 1), {
    topN: 2,
    createdAt: "2026-06-19T12:00:00.000Z",
  });

  const names = packet.json.firm_recommendations[0].recommended_companies.map((company) => company.name);
  assert.deepEqual(names, ["RealLaunch"]);
  assert.equal(packet.json.company_count, 2);
  assert.equal(packet.json.outreach_ready_company_count, 1);
  assert.equal(packet.json.excluded_company_count, 1);
});
