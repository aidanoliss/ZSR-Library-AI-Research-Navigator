import test from "node:test";
import assert from "node:assert/strict";
import { exploreSources } from "../server/sourceExploration.js";
import { buildResearchSpec } from "../config/researchSpec.js";
import { requestSourceExploration, sourceExplorationSeed } from "../src/sourceExploration.js";
import { sourceMethodEvidence } from "../src/sourceMetadataChecks.js";
import { exploreCrossrefSources } from "../server/crossrefExploration.js";

const seed = { title: "Climate change and biodiversity", doi: "10.1234/seed" };
const spec = buildResearchSpec("Climate change and biodiversity");
const index = (text) => text.split(" ").reduce((map, word, position) => ({ ...map, [word]: [...(map[word] || []), position] }), {});
const work = (n, extra = {}) => ({ id: `https://openalex.org/W${n}`, display_name: `Climate change and biodiversity ${n}`, doi: `https://doi.org/10.1234/work${n}`, type: "article", type_crossref: "journal-article", publication_year: 2025, publication_date: "2025-01-01", ...extra });
const seedWork = (extra = {}) => work(1, { display_name: seed.title, doi: `https://doi.org/${seed.doi}`, referenced_works: ["https://openalex.org/W2", "https://openalex.org/W3"], related_works: ["https://openalex.org/W2"], ...extra });
function fixture(seedRecord, results, options = {}) {
  const requests = [];
  return { requests, options: { apiKey: "server-test-secret", ...options, fetchImpl: async (url, init) => {
    requests.push({ url: new URL(url), init });
    return { ok: true, status: 200, json: async () => requests.length === 1 ? seedRecord : { results, meta: { count: results.length } } };
  } } };
}

test("references only return IDs from the seed's actual reference list, preserve spec and deduplicate", async () => {
  const researchSpec = { ...spec, sourceRequirements: { publicationYearFrom: 2021 } };
  const before = JSON.stringify(researchSpec);
  const f = fixture(seedWork(), [work(2), work(2), work(3, { publication_year: 2019, publication_date: "2019-01-01" }), work(4), seedWork()]);
  const result = await exploreSources({ seed, researchSpec, relationship: "references" }, f.options);
  assert.equal(result.status, "success"); assert.equal(result.results.length, 1);
  assert.equal(result.results[0].exploration.relationship, "references");
  assert.equal(result.results[0].exploration.citationRelationship, true);
  assert.equal(result.coverage.excludedCount, 4);
  assert.equal(JSON.stringify(researchSpec), before);
  assert.match(f.requests[1].url.searchParams.get("filter"), /openalex:W2\|W3/);
  assert.equal(f.requests.length, 2);
  assert.equal(JSON.stringify(result).includes("server-test-secret"), false);
  assert.equal(f.requests[0].init.redirect, "error");
  assert.equal(result.coverage.query, f.requests[1].url.searchParams.get("filter"));
  assert.equal(result.coverage.queries[0].query, result.coverage.query);
  assert.equal(result.coverage.seedQuery.query, `https://doi.org/${seed.doi}`);
});

test("citing works require the actual seed ID in each returned reference list", async () => {
  const f = fixture(seedWork(), [work(2, { referenced_works: ["https://openalex.org/W1"] }), work(3, { referenced_works: ["https://openalex.org/W9"] }), work(4)]);
  const result = await exploreSources({ seed, researchSpec: spec, relationship: "citing" }, f.options);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].title, work(2).display_name);
  assert.match(f.requests[1].url.searchParams.get("filter"), /^cites:W1/);
  assert.equal(result.results[0].exploration.label, "Cites your selected source");
});

test("similarity is explicitly algorithmic and never asserted to be a citation", async () => {
  const f = fixture(seedWork(), [work(2), work(3)]);
  const result = await exploreSources({ seed, researchSpec: spec, relationship: "similar" }, f.options);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].exploration.citationRelationship, false);
  assert.match(result.results[0].exploration.label, /Algorithmically/);
});

test("no identifiers and missing key produce honest unavailability without network calls", async () => {
  let calls = 0;
  const options = { apiKey: "", crossrefFallback: false, fetchImpl: async () => { calls++; } };
  assert.equal((await exploreSources({ seed: { title: "A book" } }, options)).status, "unsupported");
  assert.equal((await exploreSources({ seed }, options)).status, "unavailable");
  assert.equal(calls, 0);
});

test("untrusted seed URL cannot choose a request origin", async () => {
  const result = await exploreSources({ seed: { title: "Bad", openAlexId: "https://localhost:3000/secrets" } }, { apiKey: "test" });
  assert.equal(result.status, "unsupported");
  const f = fixture(seedWork(), [work(2)]);
  await exploreSources({ seed: { ...seed, doi: "https://bad.invalid/10.1234/seed" }, researchSpec: spec }, f.options);
  assert.ok(f.requests.every((request) => request.url.origin === "https://api.openalex.org"));
});

test("known or newly detected DOI/title discrepancies stop neighborhood exploration", async () => {
  let calls = 0;
  const known = await exploreSources({ seed: { ...seed, identityCheck: { status: "title-difference" } } }, { apiKey: "test", fetchImpl: async () => { calls++; } });
  assert.equal(known.status, "identity_mismatch"); assert.equal(calls, 0);
  const f = fixture(seedWork({ display_name: "Unrelated source title" }), [work(2)]);
  const discovered = await exploreSources({ seed, researchSpec: spec }, f.options);
  assert.equal(discovered.status, "identity_mismatch"); assert.equal(f.requests.length, 1);
});

test("wrong DOI, retracted seed and retracted connections never become results", async () => {
  for (const [extra, status] of [[{ doi: "https://doi.org/10.1234/other" }, "identity_mismatch"], [{ is_retracted: true }, "retracted"]]) {
    const f = fixture(seedWork(extra), [work(2)]);
    assert.equal((await exploreSources({ seed, researchSpec: spec }, f.options)).status, status);
  }
  const f = fixture(seedWork(), [work(2, { is_retracted: true })]);
  assert.equal((await exploreSources({ seed, researchSpec: spec }, f.options)).results.length, 0);
});

test("population and requested study design contradictions remain excluded", async () => {
  const researchSpec = buildResearchSpec("Systematic reviews of online teaching among undergraduate students in the United States since 2020");
  const f = fixture(seedWork(), [
    work(2, { display_name: "Online teaching among K-12 students", abstract_inverted_index: index("We conducted a randomized controlled trial of online teaching among K-12 children in the United States.") }),
    work(3, { display_name: "Online teaching for undergraduate students", abstract_inverted_index: index("We conducted a randomized controlled trial of online teaching among undergraduate students in the United States.") }),
  ]);
  const result = await exploreSources({ seed, researchSpec, relationship: "references" }, f.options);
  assert.equal(result.results.length, 0);
  assert.equal(result.coverage.excludedCount, 2);
  assert.match(result.message, /Requirements were kept/);
});

test("explicit own-study trials contradict review requests; cited and planned trials do not", () => {
  for (const abstractText of ["We conducted a randomized controlled trial of online teaching.", "Methods: This study used a randomised controlled trial of online teaching."]) {
    assert.equal(sourceMethodEvidence({ abstractText }, "systematic review").status, "mismatch");
    assert.equal(sourceMethodEvidence({ abstractText }, "randomized controlled trial").status, "meets");
  }
  for (const abstractText of ["A previous study conducted a randomized controlled trial.", "We will conduct a randomized controlled trial.", "We did not conduct a randomized controlled trial.", "We reviewed a randomized controlled trial."]) {
    assert.equal(sourceMethodEvidence({ abstractText }, "systematic review").status, "unverified");
  }
});

test("unknown geography remains unverified rather than inferred from author affiliations", async () => {
  const researchSpec = { ...spec, facets: { geography: "United States" } };
  const f = fixture(seedWork(), [work(2, { authorships: [{ author: { display_name: "A. Researcher" }, institutions: [{ country_code: "US" }] }] })]);
  const result = await exploreSources({ seed, researchSpec }, f.options);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].sourceAssessment.checks.find((check) => check.id === "geography").status, "unverified");
  assert.equal(result.results[0].metadataRank.requestFit, "partial-or-unverified");
});

test("known-item title and author become seed exploration while source format and dates remain", async () => {
  const researchSpec = buildResearchSpec("Find the book Governing the Commons by Elinor Ostrom");
  researchSpec.sourceRequirements.publicationYearFrom = 2020;
  const f = fixture(seedWork(), [work(2, { display_name: "A different book on institutions", type: "book", type_crossref: "book" }), work(3)]);
  const result = await exploreSources({ seed, researchSpec, relationship: "references" }, f.options);
  assert.equal(result.coverage.knownItemIdentityReplacedBySeed, true);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].type, "book");
});

test("OA scope is enforced locally and unknown access is not promised", async () => {
  const f = fixture(seedWork(), [work(2)]);
  const result = await exploreSources({ seed, researchSpec: spec, accessScope: "open-access" }, f.options);
  assert.equal(result.results.length, 0);
  assert.match(f.requests[1].url.searchParams.get("filter"), /is_oa:true/);
  const all = fixture(seedWork(), [work(2)]);
  const unrestricted = await exploreSources({ seed, researchSpec: spec }, all.options);
  assert.equal(unrestricted.results[0].provenance.accessVerified, false);
});

test("bounded sampling and five/ten result limits are explicit", async () => {
  const ids = Array.from({ length: 70 }, (_, i) => `https://openalex.org/W${i + 2}`);
  const f = fixture(seedWork({ related_works: ids }), Array.from({ length: 45 }, (_, i) => work(i + 2)));
  const result = await exploreSources({ seed, researchSpec: spec, limit: 200 }, f.options);
  assert.equal(result.results.length, 10);
  assert.equal(result.coverage.retrievedCount, 30);
  assert.equal(result.coverage.indexedConnectionCount, 70);
  assert.equal(result.coverage.exhaustive, false);
  assert.equal(f.requests[1].url.searchParams.get("per-page"), "30");
  assert.equal(f.requests[1].url.searchParams.get("filter").split("|").length, 30);
});

test("missing connection lists and malformed provider arrays yield honest empty states", async () => {
  for (const value of [null, {}, []]) {
    const f = fixture(seedWork({ related_works: value }), []);
    const result = await exploreSources({ seed, researchSpec: spec }, f.options);
    assert.equal(result.status, "empty"); assert.equal(f.requests.length, 1);
  }
});

test("timeout, cancellation, not found, and rate limits have distinct outcomes", async () => {
  const timeout = await exploreSources({ seed }, { apiKey: "test", timeoutMs: 5, fetchImpl: async () => new Promise(() => {}) });
  assert.equal(timeout.status, "timeout");
  const controller = new AbortController(); controller.abort();
  assert.equal((await exploreSources({ seed }, { apiKey: "test", signal: controller.signal })).status, "cancelled");
  for (const [code, status] of [[404, "not_found"], [429, "rate_limited"], [500, "unavailable"]]) {
    const result = await exploreSources({ seed }, { apiKey: "test", fetchImpl: async () => ({ ok: false, status: code }) });
    assert.equal(result.status, status);
  }
});

test("provider abstract gaps cannot be bridged into a fabricated continuous passage", async () => {
  const f = fixture(seedWork(), [work(2, { abstract_inverted_index: { Climate: [0], change: [1], causes: [3], harm: [4] } })]);
  const result = await exploreSources({ seed, researchSpec: spec }, f.options);
  assert.equal(result.results[0].abstractText, "Climate change");
});

test("client sends only the minimal seed and preserves the request's constraints", async () => {
  const payloadSeed = sourceExplorationSeed({ ...seed, notes: "private note", identityCheck: { status: "title-difference", detail: "private text" } });
  assert.equal(JSON.stringify(payloadSeed).includes("private"), false);
  assert.equal(payloadSeed.identityCheck.status, "title-difference");
  assert.equal(sourceExplorationSeed({ identityCheck: { status: "unverified", observedStatus: "title-difference" } }).identityCheck.status, "title-difference");
  await requestSourceExploration({ seed: payloadSeed, researchSpec: spec, relationship: "references" }, { fetchImpl: async (url, init) => {
    assert.equal(url, "/api/explore-sources");
    assert.equal(init.credentials, "same-origin");
    assert.deepEqual(JSON.parse(init.body).researchSpec, spec);
    return { ok: true, json: async () => ({ status: "empty", results: [] }) };
  } });
  await assert.rejects(requestSourceExploration({}, { fetchImpl: async () => ({ ok: false, status: 429 }) }), /Wait a moment/);
  await assert.rejects(requestSourceExploration({}, { fetchImpl: async () => ({ ok: true, json: async () => ({ status: "success" }) }) }), /unreadable/);
});

const crossrefWork = (n, extra = {}) => ({ DOI: `10.1234/work${n}`, title: [`Climate change and biodiversity research ${n}`], type: "journal-article", published: { "date-parts": [[2025, 1, 1]] }, ...extra });
const crossrefSeed = (extra = {}) => crossrefWork(1, { DOI: seed.doi, title: [seed.title], reference: [{ DOI: "10.1234/work2" }, { DOI: "10.1234/work3" }], ...extra });
function crossrefFixture(seedRecord, records = []) {
  const requests = [];
  const options = { apiKey: "", fetchImpl: async (url, init) => {
    const parsed = new URL(url); requests.push({ url: parsed, init });
    const identifier = decodeURIComponent(parsed.pathname.replace(/^\/works\//, ""));
    const record = identifier === seed.doi ? seedRecord : records.find((item) => item.DOI === identifier);
    return { ok: parsed.pathname === "/works" || Boolean(record), status: record || parsed.pathname === "/works" ? 200 : 404, json: async () => ({ message: parsed.pathname === "/works" ? { items: records } : record }) };
  } };
  return { requests, options };
}

test("missing OpenAlex credentials uses public Crossref bibliographic results without inventing citations", async () => {
  const f = crossrefFixture(crossrefSeed(), [crossrefWork(2), crossrefWork(3)]);
  const result = await exploreSources({ seed, researchSpec: spec, relationship: "similar" }, f.options);
  assert.equal(result.status, "success"); assert.equal(result.coverage.provider, "Crossref");
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].exploration.citationRelationship, false);
  assert.match(result.results[0].exploration.label, /no citation relationship/);
  assert.ok(f.requests.every((request) => request.url.origin === "https://api.crossref.org"));
  assert.equal(f.requests[1].url.searchParams.get("query.bibliographic"), seed.title);
  assert.equal(result.coverage.queries[0].query, f.requests[1].url.searchParams.toString());
  assert.equal(result.coverage.seedQuery.query, seed.doi);
});

test("Crossref references use actual deposited DOI links, remove duplicates, and keep hard dates", async () => {
  const f = crossrefFixture(crossrefSeed({ reference: [{ DOI: "10.1234/work2" }, { DOI: "10.1234/work2" }, { DOI: "10.1234/work3" }, { unstructured: "Unresolved citation" }] }), [crossrefWork(2), crossrefWork(3, { published: { "date-parts": [[2010]] } })]);
  const result = await exploreSources({ seed, relationship: "references", researchSpec: { ...spec, sourceRequirements: { publicationYearFrom: 2020 } } }, f.options);
  assert.equal(result.results.length, 1); assert.equal(result.results[0].doi, "10.1234/work2");
  assert.equal(result.results[0].exploration.citationRelationship, true);
  assert.equal(result.results[0].exploration.seedId, `https://doi.org/${seed.doi}`);
  assert.equal(result.coverage.indexedConnectionCount, 2);
  assert.equal(result.coverage.queries.length, 2); assert.equal(f.requests.length, 3);
});

test("Crossref supports title-only related searches but not invented DOI reference resolution", async () => {
  const f = crossrefFixture(null, [crossrefWork(2)]);
  const result = await exploreSources({ seed: { title: seed.title }, relationship: "similar", researchSpec: spec }, f.options);
  assert.equal(result.results.length, 1); assert.equal(f.requests.length, 1);
  assert.equal(result.coverage.seedQuery, undefined);
  const refs = await exploreSources({ seed: { title: seed.title }, relationship: "references", researchSpec: spec }, f.options);
  assert.equal(refs.status, "unsupported"); assert.equal(f.requests.length, 1);
});

test("Crossref never pretends to resolve incoming citations or open access", async () => {
  const f = crossrefFixture(crossrefSeed(), [crossrefWork(2)]);
  assert.equal((await exploreSources({ seed, relationship: "citing", researchSpec: spec }, f.options)).status, "unavailable");
  assert.equal((await exploreSources({ seed, relationship: "references", researchSpec: spec, accessScope: "open-access" }, f.options)).status, "unsupported");
  assert.equal(f.requests.length, 0);
});

test("Crossref reference lookups have bounded concurrency and honest partial failure reporting", async () => {
  const refs = Array.from({ length: 20 }, (_, i) => ({ DOI: `10.1234/work${i + 2}` }));
  const f = crossrefFixture(crossrefSeed({ reference: refs }), [crossrefWork(2)]);
  const result = await exploreSources({ seed, relationship: "references", researchSpec: spec }, f.options);
  assert.equal(result.results.length, 1); assert.equal(result.coverage.failedLookupCount, 7);
  assert.equal(result.coverage.queries.length, 8); assert.equal(f.requests.length, 9);
  assert.equal(result.coverage.indexedConnectionCount, 20);
  assert.match(result.message, /results are partial/);
});

test("Crossref identity discrepancies and wrong returned reference identifiers fail closed", async () => {
  const f = crossrefFixture(crossrefSeed({ title: ["Wrong title"] }), [crossrefWork(2)]);
  const result = await exploreSources({ seed, relationship: "references", researchSpec: spec }, f.options);
  assert.equal(result.status, "identity_mismatch"); assert.equal(f.requests.length, 1);
  let calls = 0;
  const mismatched = await exploreCrossrefSources({ seed, relationship: "references", researchSpec: spec }, { fetchImpl: async () => ({ ok: true, json: async () => ({ message: ++calls === 1 ? crossrefSeed() : crossrefWork(99) }) }) });
  assert.equal(mismatched.results.length, 0); assert.equal(mismatched.coverage.failedLookupCount, 2);
});

test("Crossref reference empty, malformed, rate-limit, and timeout states remain distinguishable", async () => {
  const f = crossrefFixture(crossrefSeed({ reference: [] }), []);
  const empty = await exploreSources({ seed, relationship: "references", researchSpec: spec }, f.options);
  assert.equal(empty.status, "empty"); assert.match(empty.message, /does not mean/);
  const timeout = await exploreCrossrefSources({ seed, researchSpec: spec }, { timeoutMs: 5, fetchImpl: async () => new Promise(() => {}) });
  assert.equal(timeout.status, "timeout");
  const limited = await exploreCrossrefSources({ seed, researchSpec: spec }, { fetchImpl: async () => ({ ok: false, status: 429 }) });
  assert.equal(limited.status, "rate_limited");
});

test("Crossref known-item exploration retains source-format constraints and excludes seed editions", async () => {
  const researchSpec = buildResearchSpec("Find the book Governing the Commons by Elinor Ostrom");
  const f = crossrefFixture(crossrefSeed(), [crossrefWork(2, { title: ["Another institutional theory book"], type: "book" }), crossrefWork(3), crossrefWork(4, { title: [seed.title], type: "book" })]);
  const result = await exploreSources({ seed, researchSpec }, f.options);
  assert.equal(result.results.length, 1); assert.equal(result.results[0].type, "book");
  assert.equal(result.coverage.knownItemIdentityReplacedBySeed, true);
});

test("Crossref DOI 404 permits only an explicitly unverified related title search", async () => {
  const f = crossrefFixture(null, [crossrefWork(2)]);
  const result = await exploreCrossrefSources({ seed, relationship: "similar", researchSpec: spec }, f.options);
  assert.equal(result.status, "success"); assert.equal(result.results.length, 1);
  assert.equal(result.coverage.seedLookupStatus, "not_found");
  assert.match(result.message, /identity remains unverified/);
  assert.match(result.message, /not a citation relationship/);
  assert.equal(result.results[0].exploration.citationRelationship, false);
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].url.searchParams.get("query.bibliographic"), seed.title);
  const refs = crossrefFixture(null, [crossrefWork(2)]);
  assert.equal((await exploreCrossrefSources({ seed, relationship: "references", researchSpec: spec }, refs.options)).status, "not_found");
  assert.equal(refs.requests.length, 1);
  for (const status of [429, 500]) {
    let calls = 0;
    const error = await exploreCrossrefSources({ seed, relationship: "similar", researchSpec: spec }, { fetchImpl: async () => { calls++; return { ok: false, status }; } });
    assert.equal(error.results.length, 0); assert.equal(calls, 1);
    assert.equal(error.status, status === 429 ? "rate_limited" : "unavailable");
  }
});
