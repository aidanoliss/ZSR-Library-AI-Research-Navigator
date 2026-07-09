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
