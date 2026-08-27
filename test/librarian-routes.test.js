import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  WFU_LIBRARIAN_DIRECTORY,
  validateLibrarianDirectory,
  validateLibrarianRecord,
} from "../config/librarianDirectory.js";
import { recommendLibrarianRoutes } from "../config/librarianRoutes.js";

const AS_OF = new Date("2026-08-27T12:00:00.000Z");

test("the WFU public directory records are structurally valid without claiming librarian approval", () => {
  const result = validateLibrarianDirectory(WFU_LIBRARIAN_DIRECTORY, { asOf: AS_OF });
  assert.equal(result.valid, true, JSON.stringify(result, null, 2));
  assert.equal(result.fallbackCount, 1);
  assert.ok(WFU_LIBRARIAN_DIRECTORY.every((record) => record.reviewStatus === "public-source-checked"));
  assert.ok(WFU_LIBRARIAN_DIRECTORY.every((record) => record.librarianApproved === false));
});

test("a validated active subject match returns the named librarian and governed contact fields", () => {
  const routes = recommendLibrarianRoutes("psychology research on trauma and anxiety", "scholarly", [], { asOf: AS_OF });
  assert.equal(routes[0].label, "Kathy Shields");
  assert.equal(routes[0].unit, "Head of Research and Liaison Services");
  assert.equal(routes[0].email, "shielddk@wfu.edu");
  assert.equal(routes[0].href, routes[0].appointmentUrl);
  assert.match(routes[0].profileUrl, /^https:\/\/zsr\.wfu\.edu\/directory\//);
  assert.equal(routes[0].librarianApproved, false);
  assert.equal(routes.at(-1).id, "ask-zsr");
});

test("history and books mode can route to the governed history contact", () => {
  const [route] = recommendLibrarianRoutes(
    "How did 1950s American jazz venues shape city identity?",
    "books",
    [],
    { asOf: AS_OF }
  );
  assert.equal(route.personName, "Kathy Shields");
  assert.equal(route.routeId, "history-humanities");
  assert.match(route.reason, /historical context/i);
});

test("one librarian is not repeated when a topic matches more than one of their subject routes", () => {
  const routes = recommendLibrarianRoutes(
    "Books on the history of trauma in American psychology",
    "books",
    [],
    { asOf: AS_OF }
  );
  assert.equal(routes.filter((route) => route.personName === "Kathy Shields").length, 1);
  assert.equal(routes.at(-1).id, "ask-zsr");
});

test("an interdisciplinary topic ranks distinct subject librarians deterministically before Ask ZSR", () => {
  const topic = "How does social media affect adolescent mental health and anxiety?";
  const first = recommendLibrarianRoutes(topic, "scholarly", [], { asOf: AS_OF });
  const second = recommendLibrarianRoutes(topic, "scholarly", [], { asOf: AS_OF });
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((route) => route.label), [
    "Kathy Shields",
    "Meghan Webb",
    "Ask ZSR general research help",
  ]);
});

test("a stale named record is not shown and routing falls back to the existing generic service route", () => {
  const staleDirectory = WFU_LIBRARIAN_DIRECTORY.map((record) => record.id === "kathy-shields"
    ? { ...record, nextReviewDate: "2026-08-01" }
    : record);
  const routes = recommendLibrarianRoutes("psychology and trauma", "scholarly", [], {
    directory: staleDirectory,
    asOf: AS_OF,
  });
  assert.equal(validateLibrarianRecord(staleDirectory[0], { asOf: AS_OF }).active, false);
  assert.equal(routes[0].id, "psychology-social-sciences");
  assert.equal(routes[0].label, "Psychology / Social Sciences librarian");
  assert.equal(routes.some((route) => route.personName === "Kathy Shields"), false);
  assert.equal(routes.at(-1).id, "ask-zsr");
});

test("an invalid named record is never emitted and the generic service remains available", () => {
  const invalidDirectory = WFU_LIBRARIAN_DIRECTORY.map((record) => record.id === "meghan-webb"
    ? { ...record, email: "not-an-email", appointmentUrl: "javascript:alert(1)" }
    : record);
  const routes = recommendLibrarianRoutes("social media journalism", "news", [], {
    directory: invalidDirectory,
    asOf: AS_OF,
  });
  assert.equal(routes[0].id, "communication-media");
  assert.equal(routes.some((route) => route.personName === "Meghan Webb"), false);
  assert.equal(routes.at(-1).id, "ask-zsr");
});

test("unmatched topics receive only the generic Ask ZSR route", () => {
  const routes = recommendLibrarianRoutes("a topic that has not been classified", "books", [], { asOf: AS_OF });
  assert.deepEqual(routes.map((route) => route.id), ["ask-zsr"]);
});

test("librarian routing has no model, provider, fetch, or asynchronous dependency", async () => {
  const source = await readFile(new URL("../config/librarianRoutes.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /gemini|openai|anthropic|generateContent|\bfetch\s*\(/i);
  assert.doesNotMatch(source, /async\s+function|Promise\./);
});
