import test from "node:test";
import assert from "node:assert/strict";

import { searchPrimo, searchSourceCandidates } from "../server/primo.js";

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
          subject: ["Biodiversity", "Ecological restoration"],
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
