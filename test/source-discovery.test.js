import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  searchSourceCandidatesForScope,
  sourceDiscoveryStatus,
  discoverSourcesForScope,
} from "../server/sourceDiscovery.js";

test("per-request discovery status preserves provider outages and partial fallback success", async () => {
  const originalFetch = globalThis.fetch;
  const priorKey = process.env.OPENALEX_API_KEY;
  process.env.OPENALEX_API_KEY = "fixture-key";
  globalThis.fetch = async () => ({ ok: false, status: 429 });
  try {
    const { results, outcomes } = await discoverSourcesForScope(["climate biodiversity"], 5, "scholarly", "open-access");
    const status = sourceDiscoveryStatus("open-access", results, outcomes);
    assert.equal(status.lanes.openAccess.status, "rate_limited");
    assert.equal(status.lanes.openAccess.errorCode, "HTTP_429");
    assert.equal(status.lanes.library.status, "not_requested");
    const partial = sourceDiscoveryStatus("library", [{ accessScope: "library" }], { library: [{ provider: "Primo", status: "timeout" }, { provider: "Crossref", status: "success" }] });
    assert.equal(partial.lanes.library.status, "partial");
  } finally {
    globalThis.fetch = originalFetch;
    if (priorKey === undefined) delete process.env.OPENALEX_API_KEY;
    else process.env.OPENALEX_API_KEY = priorKey;
  }
});

function primoDoc() {
  return {
    context: "PC",
    pnx: {
      control: { recordid: ["zsr-source-1"] },
      display: {
        title: ["Climate change and biodiversity conservation"],
        type: ["article"],
        creator: ["Library Author"],
        subject: ["Climate change", "Biodiversity"],
        creationdate: ["2025"],
      },
      addata: { doi: ["10.1000/zsr-source"] },
    },
  };
}

function openAlexWork() {
  return {
    id: "https://openalex.org/W123",
    doi: "https://doi.org/10.1000/open-source",
    display_name: "Climate change and biodiversity conservation in cities",
    publication_year: 2025,
    type: "article",
    is_retracted: false,
    authorships: [{ author: { display_name: "Open Author" } }],
    concepts: [{ display_name: "Climate change" }, { display_name: "Biodiversity" }],
    open_access: { is_oa: true, oa_status: "gold" },
    best_oa_location: {
      is_oa: true,
      landing_page_url: "https://example.org/open-source",
      license: "cc-by",
      version: "publishedVersion",
      source: { display_name: "Open Journal" },
    },
  };
}

test("both scope keeps library and open-access results in explicit lanes", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENALEX_API_KEY;
  const calls = [];
  process.env.OPENALEX_API_KEY = "test-key";
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith("https://api.openalex.org/")) {
      return { ok: true, json: async () => ({ results: [openAlexWork()] }) };
    }
    return { ok: true, json: async () => ({ docs: [primoDoc()] }) };
  };

  try {
    const results = await searchSourceCandidatesForScope(
      ["climate change biodiversity"],
      5,
      "scholarly",
      "both"
    );
    assert.equal(results.length, 2);
    assert.deepEqual(results.map((result) => result.accessScope), ["library", "open-access"]);
    assert.equal(calls.filter((url) => url.includes("primaws/rest/pub/pnxs")).length, 1);
    assert.equal(calls.filter((url) => url.includes("api.openalex.org/works")).length, 1);
    const status = sourceDiscoveryStatus("both", results);
    assert.equal(status.lanes.library.resultCount, 1);
    assert.equal(status.lanes.openAccess.resultCount, 1);
    assert.equal(status.lanes.openAccess.enabled, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey == null) delete process.env.OPENALEX_API_KEY;
    else process.env.OPENALEX_API_KEY = originalKey;
  }
});

test("library scope never sends a query to OpenAlex", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENALEX_API_KEY;
  const calls = [];
  process.env.OPENALEX_API_KEY = "test-key";
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, json: async () => ({ docs: [primoDoc()] }) };
  };

  try {
    const results = await searchSourceCandidatesForScope(
      ["climate change biodiversity"],
      5,
      "scholarly",
      "library"
    );
    assert.equal(results.length, 1);
    assert.ok(calls.every((url) => !url.includes("api.openalex.org")));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey == null) delete process.env.OPENALEX_API_KEY;
    else process.env.OPENALEX_API_KEY = originalKey;
  }
});

test("missing OpenAlex configuration is a visible safe-disabled status", async () => {
  const originalKey = process.env.OPENALEX_API_KEY;
  delete process.env.OPENALEX_API_KEY;
  try {
    const results = await searchSourceCandidatesForScope(
      ["climate change biodiversity"],
      5,
      "scholarly",
      "open-access"
    );
    assert.deepEqual(results, []);
    const status = sourceDiscoveryStatus("open-access", results);
    assert.equal(status.lanes.library.requested, false);
    assert.equal(status.lanes.openAccess.requested, true);
    assert.equal(status.lanes.openAccess.enabled, false);
    assert.equal(status.lanes.openAccess.reason, "missing-api-key");
    assert.equal(status.lanes.openAccess.retrievesFullText, false);
  } finally {
    if (originalKey == null) delete process.env.OPENALEX_API_KEY;
    else process.env.OPENALEX_API_KEY = originalKey;
  }
});

test("the source workspace explains unavailable discovery without claiming no sources exist", async () => {
  const jsx = (await Promise.all(["SourceResults.jsx", "SourceEmptyState.jsx", "sourcePresentation.js"].map((file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8")))).join("\n");
  assert.match(jsx, /not configured|not connected/i);
  assert.match(jsx, /OpenAlex reports an open-access location/);
  assert.match(jsx, /This does not mean relevant sources/);
});

test("open-access works merged into a library card retain truthful outcome counts", () => {
  const result = { title: "A merged article", accessScope: "library", url: "https://library.example/record", accessLinks: [{ url: "https://open.example/article", label: "Open record", accessScope: "open-access" }] };
  const status = sourceDiscoveryStatus("both", [result], { library: [{ status: "success" }], openAccess: [{ status: "success" }] });
  assert.equal(status.lanes.library.resultCount, 1);
  assert.equal(status.lanes.openAccess.resultCount, 1);
  assert.equal(status.lanes.openAccess.separateResultCount, 0);
  assert.equal(status.lanes.openAccess.mergedResultCount, 1);
  assert.equal(status.lanes.openAccess.outcome, "success");
});

test("empty lanes retain the difference between zero hits, rejected records and failed attempts", () => {
  const lane = (attempts) => sourceDiscoveryStatus("library", [], { library: attempts }).lanes.library;
  assert.equal(lane([{ status: "empty", retrievedCount: 0 }]).emptyReason, "no_records");
  assert.equal(lane([{ status: "empty", retrievedCount: 12 }]).emptyReason, "no_eligible_records");
  assert.equal(lane([{ status: "empty" }]).emptyReason, "no_matches");
  assert.equal(lane([{ status: "empty", retrievedCount: 0 }, { status: "timeout" }]).emptyReason, "search_incomplete");
  assert.equal(lane([{ status: "disabled" }]).emptyReason, "provider_unavailable");
});
