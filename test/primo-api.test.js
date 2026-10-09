import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrimoRequest,
  getPrimoApiStatus,
  searchLibrarySourceCandidates,
  searchPrimoApi,
} from "../server/primoApi.js";

function guestEnv(overrides = {}) {
  return {
    PRIMO_API_PROFILE: "guest",
    PRIMO_API_KEY: "guest-test-key",
    PRIMO_API_USE_FOR_DISCOVERY: "off",
    ...overrides,
  };
}

function institutionalEnv(overrides = {}) {
  return {
    PRIMO_API_PROFILE: "institutional",
    PRIMO_API_ENDPOINT: "https://api-na.hosted.exlibrisgroup.com/primo/v1/search",
    PRIMO_API_KEY: "institutional-test-key",
    PRIMO_API_VID: "01WAKE_INST:ZSR",
    PRIMO_API_INST: "01WAKE_INST",
    PRIMO_API_RECORD_HOST: "https://wfu.primo.exlibrisgroup.com",
    PRIMO_API_CATALOG_TAB: "LibraryCatalog",
    PRIMO_API_CATALOG_SCOPE: "ZSR",
    PRIMO_API_ARTICLES_TAB: "Articles",
    PRIMO_API_ARTICLES_SCOPE: "CentralIndex",
    ...overrides,
  };
}

function primoBookDoc() {
  return {
    context: "L",
    pnx: {
      control: { recordid: ["demo-cloud-book"] },
      display: {
        title: ["Cloud computing foundations"],
        type: ["book"],
        creator: ["Elia Zafrani"],
        subject: ["Cloud computing"],
        creationdate: ["2024"],
      },
      addata: {
        isbn: ["9781234567890"],
      },
    },
  };
}

test("guest profile builds the documented sandbox request without placing the key in the URL", () => {
  const request = buildPrimoRequest("cloud computing", "books", 7, guestEnv());
  const url = new URL(request.url);

  assert.equal(request.configured, true);
  assert.equal(request.profile, "guest");
  assert.equal(request.demoData, true);
  assert.equal(request.discoveryEnabled, false);
  assert.equal(url.origin, "https://api-na.hosted.exlibrisgroup.com");
  assert.equal(url.pathname, "/primo/v1/search");
  assert.equal(url.searchParams.get("vid"), "API_GUEST_INST:API_GUEST_INST");
  assert.equal(url.searchParams.get("inst"), "API_GUEST_INST");
  assert.equal(url.searchParams.get("tab"), "LibraryCatalog");
  assert.equal(url.searchParams.get("scope"), "MyInstitution");
  assert.equal(url.searchParams.get("q"), "any,contains,cloud computing");
  assert.equal(url.searchParams.get("limit"), "7");
  assert.equal(url.searchParams.has("apikey"), false);
  assert.doesNotMatch(request.url, /guest-test-key/);
});

test("guest API responses are explicitly demo-labelled and use Ex Libris header authentication", async () => {
  const originalFetch = globalThis.fetch;
  let observed;
  globalThis.fetch = async (url, options) => {
    observed = { url: String(url), options };
    return {
      ok: true,
      json: async () => ({ info: { total: 1 }, docs: [primoBookDoc()] }),
    };
  };

  try {
    const response = await searchPrimoApi(
      "cloud computing",
      "books",
      5,
      { fallbackToPublic: false, env: guestEnv() }
    );
    assert.equal(observed.options.headers.Authorization, "apikey guest-test-key");
    assert.doesNotMatch(observed.url, /guest-test-key/);
    assert.equal(response.profile, "guest");
    assert.equal(response.demoData, true);
    assert.equal(response.results.length, 1);
    assert.equal(response.results[0].sourceProvider, "Ex Libris guest sandbox demo");
    assert.equal(response.results[0].accessScope, "demo");
    assert.equal(response.results[0].provenance.demoData, true);
    assert.match(response.results[0].description, /not a Wake Forest holding/i);
    assert.match(response.results[0].detailPoints.join(" "), /do not use.*ZSR holdings/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("only an explicitly enabled institutional profile is eligible for student results", () => {
  const guest = getPrimoApiStatus(guestEnv({ PRIMO_API_USE_FOR_DISCOVERY: "on" }));
  assert.equal(guest.configured, true);
  assert.equal(guest.discoveryEnabled, false);
  assert.equal(guest.eligibleForStudentResults, false);
  assert.equal(guest.reason, "guest-contract-test-only");

  const staged = getPrimoApiStatus(institutionalEnv({ PRIMO_API_USE_FOR_DISCOVERY: "off" }));
  assert.equal(staged.configured, true);
  assert.equal(staged.discoveryEnabled, false);
  assert.equal(staged.eligibleForStudentResults, false);
  assert.equal(staged.reason, "institutional-adapter-ready");

  const approved = getPrimoApiStatus(institutionalEnv({ PRIMO_API_USE_FOR_DISCOVERY: "on" }));
  assert.equal(approved.demoData, false);
  assert.equal(approved.discoveryEnabled, true);
  assert.equal(approved.eligibleForStudentResults, true);
  assert.equal(approved.reason, "institutional-discovery-enabled");
});

test("guest configuration never routes demo records into the library-results lane", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, json: async () => ({ docs: [primoBookDoc()] }) };
  };

  try {
    const results = await searchLibrarySourceCandidates(
      ["cloud computing"],
      3,
      "books",
      guestEnv({ PRIMO_API_USE_FOR_DISCOVERY: "on" })
    );
    assert.equal(results.length, 1);
    assert.equal(results[0].sourceProvider, "ZSR discovery");
    assert.equal(results[0].accessScope, "library");
    assert.equal(results[0].provenance.demoData, false);
    assert.ok(calls.every((url) => url.includes("wfu.primo.exlibrisgroup.com/primaws/rest/pub/pnxs")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid or incomplete API settings fail closed", () => {
  const status = getPrimoApiStatus(institutionalEnv({
    PRIMO_API_ENDPOINT: "http://insecure.example.test/primo/v1/search",
    PRIMO_API_USE_FOR_DISCOVERY: "on",
  }));
  assert.equal(status.configured, false);
  assert.equal(status.endpointConfigured, false);
  assert.equal(status.discoveryEnabled, false);
  assert.equal(status.eligibleForStudentResults, false);
  assert.equal(status.reason, "missing-or-invalid-configuration");
});
