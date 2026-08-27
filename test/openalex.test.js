import test from "node:test";
import assert from "node:assert/strict";

import { getOpenAlexStatus, searchOpenAlex } from "../server/openalex.js";

function openAlexWork(overrides = {}) {
  const title = overrides.display_name || "Climate change and biodiversity conservation";
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return {
    id: `https://openalex.org/W${Math.abs(slug.length * 7919)}`,
    doi: `https://doi.org/10.1234/${slug || "work"}`,
    display_name: title,
    publication_year: 2025,
    publication_date: "2025-04-02",
    type: "article",
    type_crossref: "journal-article",
    is_retracted: false,
    authorships: [
      { author: { display_name: "Ada Researcher" } },
      { author: { display_name: "Noor Scholar" } },
    ],
    concepts: [
      { display_name: "Climate change" },
      { display_name: "Biodiversity" },
    ],
    open_access: {
      is_oa: true,
      oa_status: "gold",
      oa_url: `https://example.org/articles/${slug}`,
      any_repository_has_fulltext: true,
    },
    best_oa_location: {
      is_oa: true,
      landing_page_url: `https://example.org/articles/${slug}`,
      pdf_url: `https://example.org/articles/${slug}.pdf`,
      license: "cc-by",
      license_id: "https://creativecommons.org/licenses/by/4.0/",
      version: "publishedVersion",
      source: {
        display_name: "Journal of Test Research",
        host_organization_name: "Test Publisher",
        type: "journal",
      },
    },
    primary_location: {
      is_oa: true,
      landing_page_url: `https://example.org/articles/${slug}`,
      license: "cc-by",
      version: "publishedVersion",
      source: { display_name: "Journal of Test Research" },
    },
    biblio: { volume: "12", issue: "3", first_page: "4", last_page: "19" },
    ...overrides,
  };
}

function okResponse(results) {
  return { ok: true, json: async () => ({ results }) };
}

test("constructs the current OpenAlex works search URL with bounded server credentials", async () => {
  let requestUrl = "";
  let requestOptions;
  const fetchImpl = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return okResponse([openAlexWork()]);
  };

  const results = await searchOpenAlex("climate change AND biodiversity", 99, {
    apiKey: "server secret key",
    fetchImpl,
  });

  const url = new URL(requestUrl);
  assert.equal(url.origin, "https://api.openalex.org");
  assert.equal(url.pathname, "/works");
  assert.equal(url.searchParams.get("search"), "climate change biodiversity");
  assert.equal(url.searchParams.get("filter"), "is_oa:true,is_retracted:false");
  assert.equal(url.searchParams.get("per-page"), "40");
  assert.equal(url.searchParams.get("sort"), "relevance_score:desc");
  assert.equal(url.searchParams.get("api_key"), "server secret key");
  assert.equal(requestOptions.headers.Accept, "application/json");
  assert.ok(requestOptions.signal instanceof AbortSignal);
  assert.equal(results.length, 1);
  assert.doesNotMatch(JSON.stringify(results), /server secret key/);
});

test("is disabled without a server API key and exposes only key-safe status", async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return okResponse([]);
  };

  assert.deepEqual(await searchOpenAlex("climate biodiversity", 5, {
    apiKey: "",
    fetchImpl,
  }), []);
  assert.equal(fetchCalls, 0);

  const missing = getOpenAlexStatus({ apiKey: "" });
  assert.equal(missing.enabled, false);
  assert.equal(missing.configured, false);
  assert.equal(missing.reason, "missing-api-key");
  assert.equal(missing.retrievesFullText, false);
  assert.doesNotMatch(JSON.stringify(missing), /apiKey|secret/i);

  const ready = getOpenAlexStatus({ apiKey: "do-not-return-me" });
  assert.equal(ready.enabled, true);
  assert.equal(ready.configured, true);
  assert.doesNotMatch(JSON.stringify(ready), /do-not-return-me/);
});

test("can omit the API OA filter while still enforcing the open-access lane locally", async () => {
  let requestUrl = "";
  const fetchImpl = async (url) => {
    requestUrl = url;
    return okResponse([
      openAlexWork(),
      openAlexWork({
        display_name: "Climate change and biodiversity behind a paywall",
        doi: "https://doi.org/10.1234/closed-work",
        open_access: { is_oa: false, oa_status: "closed", oa_url: null },
      }),
    ]);
  };

  const results = await searchOpenAlex("climate change biodiversity", 5, {
    apiKey: "test-key",
    fetchImpl,
    oaOnly: false,
  });

  assert.equal(new URL(requestUrl).searchParams.get("filter"), "is_retracted:false");
  assert.equal(results.length, 1);
  assert.equal(results[0].accessScope, "open-access");
});

test("allows summary eligibility only for CC BY, CC0, and public-domain locations", async () => {
  const licenses = [
    ["cc-by", "", true],
    ["cc0", "", true],
    ["public-domain", "", true],
    ["cc-by-nc", "", false],
    ["cc-by-sa", "", false],
    ["", "https://creativecommons.org/licenses/by/4.0/", true],
    ["", "", false],
  ];
  const works = licenses.map(([license, licenseId], index) => openAlexWork({
    display_name: `Open pedagogy evidence example ${index + 1}`,
    doi: `https://doi.org/10.1234/open-pedagogy-${index + 1}`,
    concepts: [{ display_name: "Open pedagogy" }, { display_name: "Evidence" }],
    best_oa_location: {
      is_oa: true,
      landing_page_url: `https://example.org/open-pedagogy-${index + 1}`,
      license,
      license_id: licenseId,
      version: "acceptedVersion",
      source: { display_name: "Open Pedagogy Archive" },
    },
  }));

  const results = await searchOpenAlex("open pedagogy evidence", 10, {
    apiKey: "test-key",
    fetchImpl: async () => okResponse(works),
  });

  assert.deepEqual(results.map((result) => result.summaryEligible), licenses.map((entry) => entry[2]));
  assert.deepEqual(results.map((result) => result.openAccess.license), licenses.map((entry) => entry[0]));
  assert.equal(results[0].provenance.version, "acceptedVersion");
  assert.equal(results[0].provenance.host, "Open Pedagogy Archive");
});

test("sanitizes malicious metadata and rejects unsafe or credential-bearing links", async () => {
  const sanitized = openAlexWork({
    display_name: "<script>alert(1)</script> Climate change biodiversity evidence",
    doi: "javascript:alert(1)",
    authorships: [{ author: { display_name: "<b>Ada</b> Researcher\u0000" } }],
    concepts: [{ display_name: "<i>Climate change</i>" }, { display_name: "Biodiversity" }],
    best_oa_location: {
      is_oa: true,
      landing_page_url: "https://example.org/safe-climate-work#tracking",
      pdf_url: "javascript:alert(1)",
      license: "<b>cc-by</b>",
      version: "<em>publishedVersion</em>",
      source: { display_name: "<strong>Safe Journal</strong>" },
    },
  });
  const unsafeOnly = openAlexWork({
    display_name: "Climate change biodiversity malicious links",
    doi: "data:text/html,bad",
    id: "https://user:password@openalex.org/W999",
    open_access: { is_oa: true, oa_status: "green", oa_url: "javascript:alert(1)" },
    best_oa_location: {
      is_oa: true,
      landing_page_url: "javascript:alert(1)",
      pdf_url: "data:text/plain,bad",
      license: "cc-by",
    },
    primary_location: null,
    locations: [],
  });

  const results = await searchOpenAlex("climate change biodiversity", 10, {
    apiKey: "test-key",
    fetchImpl: async () => okResponse([sanitized, unsafeOnly]),
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://example.org/safe-climate-work");
  assert.equal(results[0].author, "Ada Researcher");
  assert.equal(results[0].openAccess.pdfUrl, "");
  assert.equal(results[0].openAccess.license, "cc-by");
  assert.equal(results[0].openAccess.version, "publishedVersion");
  assert.equal(results[0].openAccess.host, "Safe Journal");
  assert.doesNotMatch(JSON.stringify(results), /<script|<b>|<em>|javascript:|data:text|user:password/i);
});

test("deduplicates works by canonical DOI and independently by normalized title", async () => {
  const works = [
    openAlexWork({ display_name: "AI and cognitive offloading in learning", doi: "https://doi.org/10.5555/shared" }),
    openAlexWork({ display_name: "AI cognitive offloading duplicate DOI", doi: "10.5555/shared" }),
    openAlexWork({ display_name: "The AI and Cognitive Offloading in Learning", doi: "https://doi.org/10.5555/different" }),
    openAlexWork({ display_name: "AI cognitive offloading in higher education", doi: "https://doi.org/10.5555/unique" }),
  ];
  for (let index = 0; index < works.length; index += 1) {
    works[index].best_oa_location = {
      ...works[index].best_oa_location,
      landing_page_url: `https://example.org/dedupe-${index}`,
    };
    works[index].concepts = [
      { display_name: "Artificial intelligence" },
      { display_name: "Cognitive offloading" },
    ];
  }

  const results = await searchOpenAlex("AI cognitive offloading", 10, {
    apiKey: "test-key",
    fetchImpl: async () => okResponse(works),
  });

  assert.equal(results.length, 2);
  assert.deepEqual(results.map((result) => result.doi), ["10.5555/shared", "10.5555/unique"]);
});

test("excludes retractions and off-topic works despite provider ranking", async () => {
  const retracted = openAlexWork({ is_retracted: true });
  const offTopic = openAlexWork({
    display_name: "Quarterly corporate finance performance",
    concepts: [{ display_name: "Business" }],
  });
  const relevant = openAlexWork();

  const results = await searchOpenAlex("climate change biodiversity", 5, {
    apiKey: "test-key",
    fetchImpl: async () => okResponse([retracted, offTopic, relevant]),
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].title, relevant.display_name);
});

test("fails safely on timeout, caller cancellation, HTTP errors, and invalid JSON", async () => {
  const neverCompletes = (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
  });
  assert.deepEqual(await searchOpenAlex("climate biodiversity", 5, {
    apiKey: "test-key",
    fetchImpl: neverCompletes,
    timeoutMs: 5,
  }), []);

  const caller = new AbortController();
  caller.abort();
  assert.deepEqual(await searchOpenAlex("climate biodiversity", 5, {
    apiKey: "test-key",
    fetchImpl: neverCompletes,
    signal: caller.signal,
  }), []);

  assert.deepEqual(await searchOpenAlex("climate biodiversity", 5, {
    apiKey: "test-key",
    fetchImpl: async () => ({ ok: false, status: 503 }),
  }), []);
  assert.deepEqual(await searchOpenAlex("climate biodiversity", 5, {
    apiKey: "test-key",
    fetchImpl: async () => ({ ok: true, json: async () => { throw new Error("bad json"); } }),
  }), []);
  assert.deepEqual(await searchOpenAlex("climate biodiversity", 5, {
    apiKey: "test-key",
    fetchImpl: async () => { throw new Error("network failure"); },
  }), []);
});

test("returns citation and rights metadata without retrieving or summarizing full text", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return okResponse([openAlexWork()]);
  };
  const [result] = await searchOpenAlex("climate change biodiversity", 5, {
    apiKey: "test-key",
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0]).hostname, "api.openalex.org");
  assert.equal(result.abstractExcerpt, "");
  assert.equal(result.abstractSource, "");
  assert.equal(result.provenance.metadataOnly, true);
  assert.equal(result.provenance.accessVerified, false);
  assert.equal(result.openAccess.pdfUrl.endsWith(".pdf"), true);
  assert.deepEqual(result.citation.authors, ["Ada Researcher", "Noor Scholar"]);
  assert.equal(result.citation.volume, "12");
  assert.equal(result.citation.issue, "3");
  assert.equal(result.citation.firstPage, "4");
  assert.equal(result.citation.lastPage, "19");
  assert.equal("fullText" in result, false);
  assert.equal("summary" in result, false);
});
