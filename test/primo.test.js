import test from "node:test";
import assert from "node:assert/strict";

import { searchPrimo } from "../server/primo.js";

function primoDoc({ title, type = "article", subject = [], creator = "Test Author", date = "2026" }) {
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
      },
      addata: {},
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
