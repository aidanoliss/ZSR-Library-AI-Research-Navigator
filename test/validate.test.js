import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReply } from "../server/validate.js";

const RESOURCES = [
  { id: "jstor", name: "JSTOR (Humanities & Social Sciences Archive)", url: "https://zsr.wfu.edu/databases/jstor" },
  { id: "ask", name: "Ask a Librarian / Research Consultations", url: "https://zsr.wfu.edu/services/ask" },
];

test("keeps a starting point whose URL is in the curated set", () => {
  const reply = {
    message: "ok",
    starting_points: [
      { resource_name: "JSTOR", url: "https://zsr.wfu.edu/databases/jstor", why: "history" },
    ],
  };
  const { reply: out, report } = validateReply(reply, RESOURCES);
  assert.equal(out.starting_points.length, 1);
  assert.equal(report.dropped.length, 0);
  assert.equal(report.corrected.length, 0);
});

test("matches curated URLs forgivingly (trailing slash / case / protocol)", () => {
  const reply = {
    starting_points: [
      { resource_name: "JSTOR", url: "HTTP://ZSR.WFU.EDU/databases/jstor/", why: "x" },
    ],
  };
  const { reply: out, report } = validateReply(reply, RESOURCES);
  assert.equal(out.starting_points.length, 1);
  assert.equal(report.corrected.length, 0, "exact normalized match should not count as a correction");
});

test("drops a fully invented link that matches no curated resource", () => {
  const reply = {
    starting_points: [
      { resource_name: "Made-Up Mega Database", url: "https://example.com/fake", why: "nope" },
    ],
  };
  const { reply: out, report } = validateReply(reply, RESOURCES);
  assert.equal(out.starting_points.length, 0);
  assert.equal(report.dropped.length, 1);
  assert.equal(report.dropped[0].url, "https://example.com/fake");
});

test("corrects the URL when the model names a real resource but invents the link", () => {
  const reply = {
    starting_points: [
      { resource_name: "JSTOR (Humanities & Social Sciences Archive)", url: "https://jstor.org", why: "x" },
    ],
  };
  const { reply: out, report } = validateReply(reply, RESOURCES);
  assert.equal(out.starting_points.length, 1);
  assert.equal(out.starting_points[0].url, "https://zsr.wfu.edu/databases/jstor");
  assert.equal(report.corrected.length, 1);
});

test("handles replies with no starting_points", () => {
  const { reply: out, report } = validateReply({ message: "just chatting" }, RESOURCES);
  assert.equal(out.message, "just chatting");
  assert.equal(report.dropped.length, 0);
});

test("mixed batch: keeps valid, corrects named, drops invented", () => {
  const reply = {
    starting_points: [
      { resource_name: "Ask a Librarian / Research Consultations", url: "https://zsr.wfu.edu/services/ask", why: "a" },
      { resource_name: "JSTOR (Humanities & Social Sciences Archive)", url: "https://wrong.example", why: "b" },
      { resource_name: "Ghost DB", url: "https://ghost.example", why: "c" },
    ],
  };
  const { reply: out, report } = validateReply(reply, RESOURCES);
  assert.equal(out.starting_points.length, 2);
  assert.equal(report.corrected.length, 1);
  assert.equal(report.dropped.length, 1);
});

test("routed database guard replaces generic and copied model strategies", () => {
  const routed = [
    {
      id: "psycinfo",
      name: "PsycINFO",
      type: "database",
      url: "https://guides.zsr.wfu.edu/az.php?q=PsycINFO",
      description: "Psychology index.",
      recommended_query: '"cognitive offloading" AND artificial intelligence',
      recommended_filters: ["APA Thesaurus subject", "Population", "Peer reviewed"],
    },
    {
      id: "web-of-science",
      name: "Web of Science",
      type: "database",
      url: "https://guides.zsr.wfu.edu/az.php?q=Web%20of%20Science",
      description: "Citation index.",
      recommended_query: '"cognitive offloading" AND generative AI',
      recommended_filters: ["Research area", "Document type", "Cited by"],
    },
  ];
  const reply = {
    database_strategy: [
      { database: "A-Z Databases", search_inside: ["AI and cognition"] },
      { database: "PsycINFO", why: "Psychology fit", search_inside: ["AI and cognition"] },
      { database: "Web of Science", why: "Citation fit", search_inside: ["AI and cognition"] },
    ],
    search_terms: [
      'artificial intelligence AND "cognitive offloading"',
      '"student learning" AND generative AI',
      'generative AI AND "student learning"',
    ],
  };

  const { reply: out } = validateReply(reply, routed);
  assert.deepEqual(out.database_strategy.map((entry) => entry.database), ["PsycINFO", "Web of Science"]);
  assert.deepEqual(
    out.database_strategy.map((entry) => entry.search_inside[0]),
    routed.map((resource) => resource.recommended_query)
  );
  assert.deepEqual(out.search_terms, ['"student learning" AND generative AI']);
});
