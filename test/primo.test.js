import test from "node:test";
import assert from "node:assert/strict";

import { normalizePrimoDocs, searchCrossref, searchPrimo, searchSourceCandidates } from "../server/primo.js";
import { uniqueSourceResults } from "../src/sourceDedup.js";
import { buildResearchSpec } from "../config/researchSpec.js";
import { rankSourceResults } from "../server/sourceRelevance.js";
import { sourceKeywordFallback, sourceQueryVariants } from "../config/searchQueries.js";

test("explicit article type survives subject and method words that resemble other formats", () => {
  for (const abstract of ["The results were statistically significant.", "We conducted interviews with participants.", "We assessed emotion regulation in participants.", "This article discusses legislation and manuscript evidence."]) {
    const docs = { docs: [{ title: "Loneliness among adults", type: "article", abstract, date: "2024", url: "https://example.org/article" }] };
    assert.equal(normalizePrimoDocs(docs, { query: "loneliness", modeId: "scholarly" }).length, 1, abstract);
    assert.equal(normalizePrimoDocs(docs, { query: "loneliness", modeId: "data" }).length, 0, abstract);
  }
  const dataset = { docs: [{ title: "Loneliness among adults", type: "dataset", abstract: "A dataset associated with a journal article.", url: "https://example.org/data" }] };
  assert.equal(normalizePrimoDocs(dataset, { query: "loneliness", modeId: "scholarly" }).length, 0);
  assert.equal(normalizePrimoDocs(dataset, { query: "loneliness", modeId: "data" }).length, 1);
});

test("generic oral-history recordings retain their genre without overriding explicit document types", () => {
  for (const [type, title] of [["video", "The HistoryMakers video oral history with Ronald Walters."], ["other", "Williamson, George (Audio Interview and Transcript)"]]) {
    const doc = { title, type, url: "https://example.org/record" };
    assert.equal(normalizePrimoDocs({ docs: [doc] }, { query: title, modeId: "primary" }).length, 1);
    assert.equal(normalizePrimoDocs({ docs: [{ ...doc, type: "article" }] }, { query: "oral history", modeId: "primary" }).length, 0);
    assert.equal(normalizePrimoDocs({ docs: [{ ...doc, type: "article" }] }, { query: title, modeId: "scholarly" }).length, 1);
  }
  assert.equal(normalizePrimoDocs({ docs: [{ title: "Methods for studying oral history", type: "other", abstract: "We used an audio interview and transcript.", url: "https://example.org/methods" }] }, { query: "oral history", modeId: "primary" }).length, 0);
});

function primoDoc({
  title,
  type = "article",
  subject = [],
  creator = "Test Author",
  date = "2026",
  abstract = "",
  description = [],
  addata = {},
  search = {},
}) {
  return {
    context: "PC",
    pnx: {
      control: { recordid: [`record-${title.slice(0, 8).replace(/\W/g, "")}`] },
      display: {
        title: [title],
        type: [type],
        creator: [creator],
        subject,
        creationdate: [date],
        description,
      },
      addata: {
        ...addata,
        ...(abstract ? { abstract: [abstract] } : {}),
      },
      search,
    },
  };
}

test("source leads collapse duplicate titles across record IDs and author order", () => {
  const title = "Are All Dictators Equal? The Selective Targeting of Democratic Sanctions against Authoritarian Regimes";
  const duplicateA = primoDoc({ title, creator: "Christian von Soest; Michael Wahman" });
  const duplicateB = primoDoc({ title, creator: "von Soest, Christian; Wahman, Michael" });
  duplicateB.pnx.control.recordid = ["different-provider-record"];
  const other = primoDoc({ title: "Economic sanctions against authoritarian regimes", creator: "Another Author" });
  const results = normalizePrimoDocs({ docs: [duplicateA, duplicateB, other] }, { query: "sanctions authoritarian regimes", modeId: "scholarly", limit: 10 });
  assert.equal(results.length, 2);
  assert.equal(results.filter((result) => result.title === title).length, 1);

  const storedResults = uniqueSourceResults([
    { title, doi: "10.1000/one", author: "Christian von Soest; Michael Wahman" },
    { title: title.toLowerCase(), doi: "10.1000/two", author: "Wahman, Michael; von Soest, Christian" },
    { title: "Economic sanctions against authoritarian regimes", doi: "10.1000/three" },
  ]);
  assert.equal(storedResults.length, 3, "conflicting DOIs must not be merged just because titles match");
  const mergedAuthors = uniqueSourceResults([
    { title, author: "Christian von Soest; Michael Wahman", authors: ["Christian von Soest", "Michael Wahman"] },
    { title, author: "Wahman, Michael; von Soest, Christian", authors: ["Wahman, Michael", "von Soest, Christian"] },
  ])[0];
  assert.equal(mergedAuthors.authors.length, 2);
  assert.doesNotMatch(mergedAuthors.author, /et al/);
});

test("Primo enforces publication requirements and trusts only explicit peer-review metadata", () => {
  const peerReviewed = primoDoc({ title: "Medieval trade networks recent reviewed", date: "2024" });
  peerReviewed.pnx.facets = { toplevel: ["peer_reviewed"] };
  const results = normalizePrimoDocs({ docs: [peerReviewed,
    primoDoc({ title: "Medieval trade networks old", date: "2010" }),
    primoDoc({ title: "Medieval trade networks undated", date: "" }),
  ] }, { query: "medieval trade networks", researchSpec: { mode: "scholarly", sourceRequirements: { publicationYearFrom: 2021, peerReviewed: true } } });
  assert.equal(results.length, 2);
  assert.equal(results.find((result) => /reviewed/.test(result.title)).sourceAssessment.status, "meets");
  assert.equal(results.find((result) => /undated/.test(result.title)).sourceAssessment.status, "unverified");
});

test("shared concept checks preserve known-item title and author matching", () => {
  const results = normalizePrimoDocs({ docs: [primoDoc({ title: "The Prince", creator: "Niccolo Machiavelli", type: "book" })] }, {
    query: "The Prince Niccolo Machiavelli", modeId: "books", researchSpec: {
      mode: "books", knownItem: { title: "The Prince", author: "Niccolo Machiavelli" },
      concepts: [{ preferredTerm: "The Prince", required: true }, { preferredTerm: "Niccolo Machiavelli", required: true }],
    },
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].matchExplanation.status, "meets");
});

test("Crossref cannot drop a required concept and enforces publication dates independently of provider filtering", async () => {
  const originalFetch = globalThis.fetch;
  let filter;
  globalThis.fetch = async (url) => {
    filter = new URL(url).searchParams.get("filter");
    return { ok: true, json: async () => ({ message: { items: [
      { title: ["Artificial intelligence in manufacturing"], DOI: "10.1000/wrong", type: "journal-article", published: { "date-parts": [[2024]] } },
      { title: ["Artificial intelligence and cognitive offloading old study"], DOI: "10.1000/old", type: "journal-article", published: { "date-parts": [[2010]] } },
      { title: ["Artificial intelligence and cognitive offloading recent study"], DOI: "10.1000/recent", type: "journal-article", published: { "date-parts": [[2024]] } },
    ] } }) };
  };
  try {
    const results = await searchCrossref("artificial intelligence cognitive offloading", 5, "scholarly", { researchSpec: {
      mode: "scholarly", concepts: [{ preferredTerm: "artificial intelligence", required: true }, { preferredTerm: "cognitive offloading", required: true }],
      sourceRequirements: { publicationYearFrom: 2021, peerReviewed: true },
    } });
    assert.match(filter, /from-pub-date:2021-01-01/);
    assert.deepEqual(results.map((result) => result.doi), ["10.1000/recent"]);
    assert.equal(results[0].sourceAssessment.status, "unverified");
    assert.deepEqual(results[0].matchExplanation.matchedConcepts, ["artificial intelligence", "cognitive offloading"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("Primo lookup suppresses raw off-topic records when no strong match exists", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({
          title: "Quarterly market performance and corporate finance",
          subject: ["Business", "Finance"],
        }),
      ],
    }),
  });

  try {
    const results = await searchPrimo("AI cognitive offloading", 5, "scholarly");
    assert.deepEqual(results, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Primo lookup keeps records with strong title and subject overlap", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({
          title: "Artificial intelligence and cognitive offloading in student learning",
          subject: ["Cognitive offloading", "Artificial intelligence", "Learning"],
        }),
      ],
    }),
  });

  try {
    const results = await searchPrimo("AI cognitive offloading", 5, "scholarly");
    assert.equal(results.length, 1);
    assert.match(results[0].title, /cognitive offloading/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Primo never treats an ISSN display identifier as a DOI or PMID", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({
          title: "Climate change and biodiversity conservation",
          subject: ["Climate change", "Biodiversity"],
          addata: {},
          search: {},
        }),
      ].map((doc) => ({
        ...doc,
        pnx: {
          ...doc.pnx,
          display: {
            ...doc.pnx.display,
            identifier: ["$$CISSN$$V2310-1490"],
          },
        },
      })),
    }),
  });

  try {
    const [result] = await searchPrimo("climate change biodiversity", 5, "scholarly");
    assert.ok(result);
    assert.equal(result.doi, "");
    assert.equal(result.pmid, "");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Primo exposes only a bounded provider-supplied abstract excerpt", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({
          title: "Artificial intelligence and cognitive offloading in student learning",
          subject: ["Cognitive offloading", "Artificial intelligence", "Learning"],
          abstract: "<jats:p>The study examines how students use artificial intelligence to externalize memory tasks. It reports associations between tool use and cognitive offloading behavior. A third sentence should not appear in the excerpt.</jats:p>",
        }),
      ],
    }),
  });

  try {
    const [result] = await searchPrimo("AI cognitive offloading", 5, "scholarly");
    assert.ok(result);
    assert.equal(result.abstractSource, "ZSR record metadata");
    assert.match(result.abstractExcerpt, /^The study examines/);
    assert.match(result.abstractExcerpt, /cognitive offloading behavior\./);
    assert.doesNotMatch(result.abstractExcerpt, /third sentence/i);
    assert.doesNotMatch(result.abstractExcerpt, /<jats:/i);
    assert.ok(result.abstractExcerpt.length <= 363);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Primo does not relabel an unverified display description as an abstract", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({
          title: "Artificial intelligence and cognitive offloading in student learning",
          subject: ["Cognitive offloading", "Artificial intelligence", "Learning"],
          description: ["Publisher copy that is not explicitly identified as an abstract."],
        }),
      ],
    }),
  });

  try {
    const [result] = await searchPrimo("AI cognitive offloading", 5, "scholarly");
    assert.ok(result);
    assert.equal(result.abstractExcerpt, "");
    assert.equal(result.abstractSource, "");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Primo lookup keeps affiliations and funding noise out of the visible author byline", async () => {
  const originalFetch = globalThis.fetch;
  const pollutedCreator = [
    "Colinet, H",
    "Ecosystemes, biodiversite, evolution [Rennes] (ECOBIO)",
    "Universite de Rennes (UR)-Institut Ecologie et Environnement",
    "Grant Number: Project IPEV 136 Subanteco",
    "Leclerc, C",
    "Natural Environment Research Council (NERC)",
    "Convey, P",
    "Chown, S",
  ].join(" ; ");
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({
          title: "Climate change sensitivity across arthropod biodiversity",
          subject: ["Climate change", "Biodiversity", "Arthropoda"],
          creator: pollutedCreator,
          addata: { au: ["Colinet, H", "Leclerc, C", "Convey, P", "Chown, S"] },
        }),
      ],
    }),
  });

  try {
    const [result] = await searchPrimo("climate change biodiversity arthropods", 5, "scholarly");
    assert.ok(result);
    assert.equal(result.author, "Colinet, H; Leclerc, C et al.");
    assert.ok(result.author.length < 80);
    assert.match(result.detailPoints.join(" "), /Authors: Colinet, H; Leclerc, C; Convey, P; Chown, S/);
    assert.doesNotMatch([result.author, ...result.detailPoints].join(" "), /Universit|Grant Number|Research Council/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Primo lookup extracts person names when only a polluted display creator is available", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({
          title: "Climate change and biodiversity redistribution",
          subject: ["Climate change", "Biodiversity"],
          creator: "Colinet, H ; Universite de Rennes ; Grant Number: 136 ; Leclerc, C ; British Antarctic Survey ; Chown, S",
        }),
      ],
    }),
  });

  try {
    const [result] = await searchPrimo("climate change biodiversity", 5, "scholarly");
    assert.ok(result);
    assert.equal(result.author, "Colinet, H; Leclerc, C et al.");
    assert.doesNotMatch(result.author, /Universit|Grant|Survey/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Primo lookup rejects adjacent cognitive records missing the AI concept", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({
          title: "Gambling behavior in college students and cognitive distortions",
          subject: ["College students", "Cognitive distortions", "Behavior"],
        }),
      ],
    }),
  });

  try {
    const results = await searchPrimo("AI cognitive offloading in college students", 5, "scholarly");
    assert.deepEqual(results, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Primo lookup requires both concepts in short multi-concept queries", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({ title: "Climate adaptation planning", subject: ["Climate change"] }),
        primoDoc({ title: "Artificial intelligence in radiology", subject: ["Artificial intelligence", "Radiology"] }),
      ],
    }),
  });

  try {
    assert.deepEqual(await searchPrimo("climate justice", 5, "scholarly"), []);
    assert.deepEqual(await searchPrimo("AI ethics", 5, "scholarly"), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Primo biodiversity-climate searches reject records missing the climate concept", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({
          title: "Groundwater biodiversity and ecosystem services",
          subject: ["Biodiversity", "Groundwater ecology", "Ecosystem services"],
        }),
        primoDoc({
          title: "Biodiversity and ecosystem resilience under climate change",
          subject: ["Biodiversity", "Climate change", "Ecosystem resilience"],
        }),
      ],
    }),
  });

  try {
    const results = await searchPrimo("biodiversity AND climate resilience", 5, "scholarly");
    assert.deepEqual(results.map((result) => result.title), [
      "Biodiversity and ecosystem resilience under climate change",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("hidden Primo description and indexing metadata cannot satisfy a required climate concept", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({
          title: "Restoration and repair of damaged ecosystems",
          creator: "Climate Change Research Consortium",
          subject: [
            "Biodiversity",
            "Ecological restoration",
            "Ecosystem services",
            "Conservation",
            "Habitat recovery",
            "Species richness",
            "Climate change",
          ],
          abstract: "The first sentence discusses biodiversity restoration. The second sentence describes ecosystem repair. A later sentence mentions climate change.",
          description: ["Publisher description mentioning climate change."],
          search: { general: ["Climate change"] },
        }),
      ],
    }),
  });

  try {
    const results = await searchPrimo("biodiversity AND climate resilience", 5, "scholarly");
    assert.deepEqual(results, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Primo lookup can use exact subject metadata when a title is opaque", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({
          title: "Whose pain counts?",
          subject: ["Epistemic injustice", "Clinical pain", "Patient testimony"],
        }),
      ],
    }),
  });

  try {
    const results = await searchPrimo("epistemic injustice clinical pain", 5, "scholarly");
    assert.equal(results.length, 1);
    assert.equal(results[0].title, "Whose pain counts?");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("scholarly mode does not fall back to trade or magazine records", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({
          title: "Artificial intelligence and cognitive offloading in student learning",
          type: "trade magazine",
          subject: ["Artificial intelligence", "Cognitive offloading"],
        }),
      ],
    }),
  });

  try {
    assert.deepEqual(await searchPrimo("AI cognitive offloading", 5, "scholarly"), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Primo deduplication preserves distinct authors for the same title", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        primoDoc({ title: "Climate justice in cities", creator: "Alex Rivera", date: "2024", subject: ["Climate justice"] }),
        primoDoc({ title: "Climate justice in cities", creator: "Morgan Lee", date: "2025", subject: ["Climate justice"] }),
      ],
    }),
  });

  try {
    const results = await searchPrimo("climate justice", 5, "scholarly");
    assert.equal(results.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("source retrieval tries semantic ZSR queries after a literal query returns nothing", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    const query = parsed.searchParams.get("q") || "";
    const docs = /political leaders/i.test(query)
      ? Array.from({ length: 5 }, (_, index) => primoDoc({
          title: `Political leaders, narcissism, and public power ${index + 1}`,
          subject: ["Political leaders", "Narcissism", "Political psychology"],
          creator: `Scholar ${index + 1}`,
        }))
      : [];
    return { ok: true, json: async () => ({ docs }) };
  };

  try {
    const results = await searchSourceCandidates([
      '"literal malformed wording" AND psychology',
      '"political leaders" AND narcissism',
    ], 10, "scholarly");
    assert.equal(results.length, 5);
    assert.ok(results.every((result) => result.sourceProvider === "ZSR discovery"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("source retrieval uses verified Crossref metadata when ZSR has no records", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("api.crossref.org")) {
      return {
        ok: true,
        json: async () => ({
          message: {
            items: [{
              DOI: "10.1234/example",
              title: ["Authoritarian Leaders as Successful Psychopaths"],
              author: [{ given: "Ada", family: "Scholar" }],
              abstract: "<jats:p>The article examines psychopathy as a framework for studying authoritarian leadership. It evaluates the limits of applying clinical concepts to political figures. Additional text is not part of the excerpt.</jats:p>",
              published: { "date-parts": [[2024]] },
              type: "journal-article",
              URL: "https://doi.org/10.1234/example",
              "container-title": ["Political Psychology Review"],
            }],
          },
        }),
      };
    }
    return { ok: true, json: async () => ({ docs: [] }) };
  };

  try {
    const results = await searchSourceCandidates([
      '"authoritarian leaders" AND psychopathy',
    ], 10, "scholarly");
    assert.equal(results.length, 1);
    assert.equal(results[0].sourceProvider, "Crossref scholarly metadata");
    assert.equal(results[0].doi, "10.1234/example");
    assert.equal(results[0].abstractSource, "Crossref record metadata");
    assert.match(results[0].abstractExcerpt, /authoritarian leadership/);
    assert.doesNotMatch(results[0].abstractExcerpt, /Additional text/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a later query can outrank the first five with full-question comparison evidence", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const spec = buildResearchSpec("Sanctions and their impact on authoritarian regimes vs democracies");
  globalThis.fetch = async (url) => {
    const query = new URL(url).searchParams.get("q");
    calls.push(query);
    const docs = query.includes("expanded")
      ? [primoDoc({ title: "Comparing sanctions in authoritarian regimes and democracies", abstract: "A comparison of sanctions across regime types.", creator: "Full Match Author" })]
      : Array.from({ length: 5 }, (_, index) => primoDoc({ title: `Sanctions against authoritarian regimes ${index}`, creator: `Author ${index}` }));
    return { ok: true, json: async () => ({ docs }) };
  };
  try {
    const results = await searchSourceCandidates(["sanctions authoritarian regimes democracies", "expanded sanctions authoritarian democracies"], 5, "scholarly", { researchSpec: spec });
    assert.equal(calls.length, 2, "retrieval must explore alternatives even after five early matches");
    assert.equal(results.length, 5);
    assert.match(results[0].title, /^Comparing/);
    assert.equal(results[0].matchExplanation.category, "direct-comparison");
    assert.equal(results[1].matchExplanation.status, "partial");
    assert.equal(results[1].matchExplanation.category, "supporting");
    assert.deepEqual(results[1].matchExplanation.missingConcepts, ["democracies"]);
    assert.equal(results[0].matchExplanation.evidence[0].field, "title");
  } finally { globalThis.fetch = originalFetch; }
});

test("pool ranking preserves hard publication and peer-review exclusions", () => {
  const spec = buildResearchSpec("Sanctions in authoritarian regimes vs democracies, peer-reviewed sources published since 2020");
  const title = "Comparing sanctions in authoritarian regimes and democracies";
  const results = rankSourceResults([
    { title, author: "Old", date: "2010", type: "article", peerReviewed: true },
    { title, author: "Not reviewed", date: "2024", type: "article", peerReviewed: false },
    { title, author: "Current", date: "2024", type: "article", peerReviewed: true },
    { title: "Sanctions against authoritarian regimes", author: "Partial", date: "2024", type: "article", peerReviewed: true },
  ], spec);
  assert.deepEqual(results.map((result) => result.author), ["Current", "Partial"]);
  assert.ok(results.every((result) => result.sourceAssessment.status === "meets"));
});

test("duplicate records consolidate actual metadata and safe alternate access links", () => {
  const title = "Economic sanctions against authoritarian governments";
  const results = uniqueSourceResults([
    { title, author: "A Scholar", doi: "10.1000/merge", date: "", containerTitle: "", url: "https://library.example/record", sourceProvider: "Library", accessScope: "library" },
    { title, author: "Scholar, A", doi: "https://doi.org/10.1000/merge", date: "2024", containerTitle: "Political Studies", abstractExcerpt: "Provider abstract text.", abstractSource: "Open provider", url: "https://doi.org/10.1000/merge", sourceProvider: "Open metadata", accessScope: "open-access", openAccess: { pdfUrl: "https://publisher.example/article.pdf" }, accessLinks: [{ label: "Unsafe", url: "javascript:alert(1)" }] },
  ]);
  assert.equal(results.length, 1);
  assert.equal(results[0].date, "2024");
  assert.equal(results[0].containerTitle, "Political Studies");
  assert.equal(results[0].abstractSource, "Open provider");
  assert.equal(results[0].accessScope, "library");
  assert.equal(results[0].accessLinks.length, 3);
  assert.ok(results[0].accessLinks.every((link) => link.url.startsWith("https://")));
  assert.deepEqual(results[0].metadataSources, ["Library", "Open metadata"]);
});

test("Primo fills a missing display year and journal from provider citation fields", () => {
  const results = normalizePrimoDocs({ docs: [primoDoc({ title: "Sanctions against authoritarian regimes", date: "", addata: { date: ["2024-03-01"], jtitle: ["Journal of Politics"] } })] }, { query: "sanctions authoritarian regimes" });
  assert.equal(results[0].date, "2024-03-01");
  assert.equal(results[0].containerTitle, "Journal of Politics");
});

test("empty discovery distinguishes no provider records, rejected records, and malformed responses", async () => {
  const originalFetch = globalThis.fetch;
  const cases = [
    { data: { docs: [] }, status: "empty", count: 0, reason: "no_records" },
    { data: { docs: [primoDoc({ title: "Pottery in ancient Rome" })] }, status: "empty", count: 1, reason: "no_eligible_records" },
    { data: { unexpected: "provider schema changed" }, status: "error" },
  ];
  try {
    for (const sample of cases) {
      const outcomes = [];
      globalThis.fetch = async () => ({ ok: true, json: async () => sample.data });
      assert.deepEqual(await searchPrimo("climate biodiversity", 5, "scholarly", { onOutcome: (outcome) => outcomes.push(outcome) }), []);
      assert.equal(outcomes.length, 1);
      assert.equal(outcomes[0].status, sample.status);
      assert.equal(outcomes[0].query, "climate biodiversity");
      assert.equal(outcomes[0].retrievedCount, sample.count);
      assert.equal(outcomes[0].emptyReason, sample.reason);
      if (sample.status === "error") assert.equal(outcomes[0].errorCode, "INVALID_PROVIDER_RESPONSE");
    }
    const outcomes = [];
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ message: {} }) });
    await searchCrossref("climate biodiversity", 5, "scholarly", { onOutcome: (outcome) => outcomes.push(outcome) });
    assert.equal(outcomes[0].status, "error");
    assert.equal(outcomes[0].errorCode, "INVALID_PROVIDER_RESPONSE");
  } finally { globalThis.fetch = originalFetch; }
});

test("a malformed individual Primo row does not discard other valid source records", () => {
  const results = normalizePrimoDocs({ docs: [null, "broken row", primoDoc({ title: "Climate and biodiversity conservation" })] }, { query: "climate biodiversity", modeId: "scholarly" });
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Climate and biodiversity conservation");
});

test("completed empty searches try bounded unused equivalent variants and retain all source checks", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const queries = ["climate biodiversity", "climate biodiversity one", "climate biodiversity two", "climate biodiversity three", "climate biodiversity four"];
  const spec = { mode: "scholarly", concepts: [{ preferredTerm: "climate", required: true }, { preferredTerm: "biodiversity", required: true }], sourceRequirements: { publicationYearFrom: 2021 } };
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    if (parsed.hostname === "api.crossref.org") return { ok: true, json: async () => ({ message: { items: [] } }) };
    const query = parsed.searchParams.get("q").replace(/^any,contains,/, "");
    calls.push(query);
    const docs = query === queries[4] ? [
      primoDoc({ title: "Climate and biodiversity recent study", date: "2024" }),
      primoDoc({ title: "Climate and biodiversity old study", date: "2010" }),
      primoDoc({ title: "Biodiversity study without the required anchor", date: "2024" }),
    ] : [];
    return { ok: true, json: async () => ({ docs }) };
  };
  try {
    const results = await searchSourceCandidates(queries, 5, "scholarly", { researchSpec: spec });
    assert.deepEqual(calls, queries);
    assert.deepEqual(results.map((result) => result.title), ["Climate and biodiversity recent study"]);
    assert.equal(results[0].sourceAssessment.status, "meets");
  } finally { globalThis.fetch = originalFetch; }
});

test("keyword recovery relaxes only inferred phrases and runs after an empty search", async () => {
  const originalFetch = globalThis.fetch;
  const spec = buildResearchSpec("Microplastic capture by floating wetlands in urban stormwater ponds");
  const query = sourceKeywordFallback(spec);
  assert.match(query, /Microplastic AND capture/);
  assert.match(query, /floating AND wetlands/);
  assert.match(query, /stormwater AND ponds/);
  assert.match(query, /urban/);
  assert.equal(sourceKeywordFallback(buildResearchSpec('"floating wetlands"')), "");
  assert.equal(sourceKeywordFallback(buildResearchSpec('Find the book "Governing the Commons" by Elinor Ostrom')), "");
  const constrained = { ...spec, facets: { geography: "United States", population: "college students" }, methodRequirements: { include: ["qualitative interview"], exclude: ["systematic review"] } };
  assert.match(sourceKeywordFallback(constrained), /"United States"/);
  assert.match(sourceKeywordFallback(constrained), /"college students"/);
  assert.match(sourceKeywordFallback(constrained), /qualitative AND interview\*/);
  assert.match(sourceKeywordFallback(constrained), /NOT \("systematic review" OR "systematic reviews"\)/);
  const calls = [];
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    if (parsed.hostname === "api.crossref.org") return { ok: true, json: async () => ({ message: { items: [] } }) };
    const sent = parsed.searchParams.get("q").replace(/^any,contains,/, "");
    calls.push(sent);
    return { ok: true, json: async () => ({ docs: sent === query ? [primoDoc({ title: "Microplastic capture using floating wetlands in urban stormwater ponds" })] : [] }) };
  };
  try {
    const results = await searchSourceCandidates(sourceQueryVariants(spec), 5, "scholarly", { researchSpec: spec });
    assert.equal(calls.at(-1), query);
    assert.equal(results.length, 1);
    assert.equal(results[0].matchExplanation.missingConcepts.length, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("Primo rate limits do not trigger more equivalent-query requests", async () => {
  const originalFetch = globalThis.fetch;
  const queries = ["alpha beta", "alpha gamma", "alpha delta", "alpha epsilon", "alpha zeta"];
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: false, status: 429 };
  };
  try {
    await searchSourceCandidates(queries, 5, "scholarly");
    assert.equal(calls.filter((url) => url.includes("primaws/")).length, 3);
    assert.ok(calls.length <= 5, "a separate fallback provider is bounded too");
  } finally { globalThis.fetch = originalFetch; }
});
