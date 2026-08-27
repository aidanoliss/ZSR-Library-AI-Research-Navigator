import test from "node:test";
import assert from "node:assert/strict";

import {
  searchSourceCandidatesForScope,
  sourceDiscoveryStatus,
} from "../server/sourceDiscovery.js";

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
