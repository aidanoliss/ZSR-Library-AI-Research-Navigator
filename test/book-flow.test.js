import test from "node:test";
import assert from "node:assert/strict";

import { searchPrimo } from "../server/primo.js";

function bookDoc({ delivery = null } = {}) {
  return {
    context: "L",
    pnx: {
      control: { recordid: ["alma-book-1"] },
      display: {
        title: ["Jazz venues and urban cultural identity"],
        type: ["book"],
        creator: ["Rivera, Alex"],
        subject: ["Jazz", "Cities and towns", "Cultural identity"],
        creationdate: ["2024"],
        publisher: ["Durham : Example University Press"],
      },
      addata: {
        au: ["Rivera, Alex", "Lee, Morgan"],
        isbn: ["9781234567890"],
        btitle: ["Jazz venues and urban cultural identity"],
        pub: ["Example University Press"],
        edition: ["Second edition"],
      },
    },
    ...(delivery ? { delivery } : {}),
  };
}

test("book mode requests delivery metadata and returns exact location guidance", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  globalThis.fetch = async (url) => {
    requestUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        docs: [bookDoc({
          delivery: {
            bestlocation: {
              availabilityStatus: "available",
              mainLocation: "Z. Smith Reynolds Library",
              subLocation: "Stacks - Reynolds wing, 6th floor",
              callNumber: "ML3508 .R58 2024",
            },
          },
        })],
      }),
    };
  };

  try {
    const [result] = await searchPrimo("jazz urban cultural identity", 5, "books");
    assert.ok(result);
    const params = new URL(requestUrl).searchParams;
    assert.equal(params.get("pcAvailability"), "true");
    assert.equal(params.get("skipDelivery"), "N");
    assert.deepEqual(result.authors, ["Rivera, Alex", "Lee, Morgan"]);
    assert.equal(result.isbn, "9781234567890");
    assert.equal(result.publisher, "Example University Press");
    assert.equal(result.fulfillment.status, "available");
    assert.equal(result.fulfillment.statusLabel, "Available when checked");
    assert.equal(result.fulfillment.location, "Z. Smith Reynolds Library · Stacks - Reynolds wing, 6th floor");
    assert.equal(result.fulfillment.callNumber, "ML3508 .R58 2024");
    assert.match(result.fulfillment.recordUrl, /alma-book-1/);
    assert.match(result.fulfillment.requestUrl, /delivers\/ill/);
    assert.equal(result.provenance.accessVerified, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("book mode gives a record and request path when no location is supplied", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ docs: [bookDoc()] }),
  });

  try {
    const [result] = await searchPrimo("jazz urban cultural identity", 5, "books");
    assert.ok(result);
    assert.equal(result.fulfillment.status, "unknown");
    assert.equal(result.fulfillment.availabilityChecked, false);
    assert.equal(result.fulfillment.actionLabel, "Check location and availability");
    assert.match(result.fulfillment.requestUrl, /delivers\/ill/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("article mode avoids delivery lookup and does not add book fulfillment", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  globalThis.fetch = async (url) => {
    requestUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        docs: [{
          ...bookDoc(),
          pnx: {
            ...bookDoc().pnx,
            display: {
              ...bookDoc().pnx.display,
              type: ["article"],
            },
          },
        }],
      }),
    };
  };

  try {
    const [result] = await searchPrimo("jazz urban cultural identity", 5, "scholarly");
    assert.ok(result);
    const params = new URL(requestUrl).searchParams;
    assert.equal(params.get("pcAvailability"), "false");
    assert.equal(params.get("skipDelivery"), "Y");
    assert.equal(result.fulfillment, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
