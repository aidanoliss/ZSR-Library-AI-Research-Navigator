import test from "node:test";
import assert from "node:assert/strict";

import {
  dedupeSourceLeads,
  downloadRis,
  normalizeSourceLead,
  safeRisFilename,
  serializeRis,
} from "../src/ris.js";

test("maps supported source kinds to RIS record types", () => {
  const cases = [
    ["scholarly-article", "JOUR"],
    ["journal article", "JOUR"],
    ["book", "BOOK"],
    ["book-chapter", "CHAP"],
    ["newspaper article", "NEWS"],
    ["dataset", "DATA"],
    ["archival object", "GEN"],
  ];

  for (const [sourceKind, expected] of cases) {
    assert.equal(normalizeSourceLead({ sourceKind }).TY, expected);
  }
});

test("uses a specific type when a provider source kind is only generic", () => {
  assert.equal(
    normalizeSourceLead({ sourceKind: "catalog-record", type: "book" }).TY,
    "BOOK"
  );
});

test("normalizes supplied article metadata and preserves multiple authors", () => {
  const fields = normalizeSourceLead({
    title: "A verified article",
    authors: ["Nguyen, Linh", { family: "Smith", given: "Ava" }],
    sourceKind: "scholarly-article",
    publicationYear: 2025,
    date: "2025-04-19",
    containerTitle: "Journal of Student Research",
    volume: 8,
    issue: 2,
    pages: "17–29",
    publisher: "Example Press",
    doi: "https://doi.org/10.1234/Example.5",
    pmid: "PMID: 12345678",
    isbn: ["978-1-2345-6789-0"],
    issn: "1234-5678",
    url: "https://example.org/article",
    sourceProvider: "Crossref scholarly metadata",
  });

  assert.deepEqual(fields, {
    TY: "JOUR",
    TI: "A verified article",
    AU: ["Nguyen, Linh", "Smith, Ava"],
    PY: "2025",
    DA: "2025-04-19",
    JO: "Journal of Student Research",
    VL: "8",
    IS: "2",
    SP: "17",
    EP: "29",
    PB: "Example Press",
    DO: "10.1234/Example.5",
    SN: ["978-1-2345-6789-0", "1234-5678"],
    AN: "12345678",
    UR: "https://example.org/article",
    N1: "Metadata provider: Crossref scholarly metadata",
  });
});

test("uses a book title as T2 for chapter records", () => {
  const fields = normalizeSourceLead({
    type: "book chapter",
    title: "A chapter",
    containerTitle: "The Collected Volume",
  });

  assert.equal(fields.TY, "CHAP");
  assert.equal(fields.T2, "The Collected Volume");
  assert.equal(fields.JO, undefined);
});

test("serializes UTF-8 RIS with CRLF and flattens line-breaking input", () => {
  const ris = serializeRis({
    type: "article",
    title: "Café research\r\nER  - injected",
    author: "One, Author; Two, Author",
    sourceProvider: "OpenAlex\nmetadata",
  });

  assert.match(ris, /^TY  - JOUR\r\n/);
  assert.match(ris, /TI  - Café research ER - injected\r\n/);
  assert.match(ris, /AU  - One, Author\r\nAU  - Two, Author\r\n/);
  assert.match(ris, /N1  - Metadata provider: OpenAlex metadata\r\nER  -\r\n$/);
  assert.doesNotMatch(ris, /(?<!\r)\n|\r(?!\n)/);
});

test("deduplicates identifier-equivalent selected leads and keeps first metadata", () => {
  const first = {
    title: "First title",
    doi: "https://doi.org/10.5555/ABC",
    sourceProvider: "Crossref",
  };
  const duplicate = {
    title: "Changed title",
    doi: "doi:10.5555/abc",
    sourceProvider: "OpenAlex",
  };
  const distinct = { title: "Another source", pmid: "123456" };

  assert.deepEqual(dedupeSourceLeads([first, duplicate, distinct]), [first, distinct]);
  assert.equal((serializeRis([first, duplicate, distinct]).match(/^TY  -/gm) || []).length, 2);
  assert.match(serializeRis([first, duplicate]), /First title/);
  assert.doesNotMatch(serializeRis([first, duplicate]), /Changed title/);
});

test("fallback dedupe is conservative across title, authors, date, and container", () => {
  const base = {
    title: "Shared title",
    author: "Author, A",
    date: "2024",
    containerTitle: "Journal One",
  };
  const same = { ...base, title: "SHARED TITLE" };
  const otherEdition = { ...base, date: "2025" };

  assert.deepEqual(dedupeSourceLeads([base, same, otherEdition]), [base, otherEdition]);
});

test("missing metadata stays missing rather than being invented", () => {
  assert.deepEqual(normalizeSourceLead({ title: "Only a supplied title" }), {
    TY: "GEN",
    TI: "Only a supplied title",
  });

  const ris = serializeRis({ title: "Only a supplied title" });
  for (const absent of ["AU", "PY", "DA", "DO", "SN", "AN", "UR", "N1"]) {
    assert.doesNotMatch(ris, new RegExp(`^${absent}  -`, "m"));
  }
  assert.doesNotMatch(ris, /unknown|untitled|n\.d\./i);
});

test("creates a bounded path-safe filename with one RIS extension", () => {
  assert.equal(safeRisFilename("Café research / fall 2026.ris"), "Cafe-research-fall-2026.ris");
  assert.equal(safeRisFilename("../../"), "research-sources.ris");
  assert.ok(safeRisFilename("x".repeat(150)).length <= 104);
});

test("browser download helper is safe when no DOM is available", () => {
  assert.equal(downloadRis([{ title: "A source" }]), false);
  assert.equal(downloadRis([]), false);
});
