import test from "node:test";
import assert from "node:assert/strict";
import { filterSourceResults, paginateSourceLanes, shortSourceExcerpt, sourceAuthors, sourceResultLanes } from "../src/sourceResultView.js";

test("local date filters exclude unknown years without changing the source collection", () => {
  const results = [{ title: "Recent", year: 2023 }, { title: "Undated" }, { title: "Older", year: 1990 }];
  assert.deepEqual(filterSourceResults(results, { from: "2020" }).map((result) => result.title), ["Recent"]);
  assert.equal(results.length, 3);
  assert.deepEqual(filterSourceResults(results, { sort: "newest" }).map((result) => result.title), ["Recent", "Older", "Undated"]);
});

test("type filtering and relevance sorting preserve the provider order", () => {
  const results = [{ title: "First", type: "article", date: "2014" }, { title: "Book", type: "book", date: "2025" }, { title: "Second", type: "article", date: "2024" }];
  assert.deepEqual(filterSourceResults(results, { type: "scholarly-article" }).map((result) => result.title), ["First", "Second"]);
});

test("metadata formatting truncates provider text without inventing a summary or author", () => {
  assert.equal(shortSourceExcerpt("One two three four", 12), "One two…");
  assert.equal(shortSourceExcerpt(""), "");
  assert.equal(sourceAuthors({ authors: [{ given: "Jane", family: "Doe" }, "Smith, John", "Person, Third"] }, true), "Jane Doe; Smith, John et al.");
  assert.equal(sourceAuthors({}), "");
});

test("a work retrieved through both lanes is counted once and preserves its open-access link", () => {
  const library = { title: "A shared article from two metadata providers", doi: "10.1234/shared", url: "https://library.example/record", accessScope: "library", sourceProvider: "ZSR Discovery" };
  const open = { ...library, url: "https://open.example/article", accessScope: "open-access", sourceProvider: "OpenAlex", openAccess: { landingPageUrl: "https://open.example/article", license: "cc-by" } };
  // Even old stored sessions with OA first should retain the library row plus an access route.
  const lanes = sourceResultLanes([open, library]);
  assert.equal(lanes.flatMap((lane) => lane.results).length, 1);
  assert.equal(lanes[0].results.length, 1);
  assert.equal(lanes[1].results.length, 0);
  assert.equal(lanes[1].mergedResultCount, 1);
  assert.equal(lanes[0].results[0].accessLinks.some((link) => link.accessScope === "open-access" && link.url === open.url), true);
});

test("backend merged-only status is kept without inflating separate source counts", () => {
  const lanes = sourceResultLanes([{ title: "Library source", url: "https://library.example/record" }], { lanes: { openAccess: { requested: true, status: "success", mergedResultCount: 1, separateResultCount: 0 } } });
  assert.equal(lanes[1].mergedResultCount, 1);
  assert.equal(lanes.flatMap((lane) => lane.results).length, 1);
});

test("seven library and four OA works share one five-result initial budget after deduplication", () => {
  const library = Array.from({ length: 7 }, (_, index) => ({ title: `Library research work number ${index}`, doi: `10.1234/library${index}`, accessScope: "library", metadataRank: { score: 10 - index } }));
  const open = Array.from({ length: 4 }, (_, index) => ({ title: `Open-access research work number ${index}`, doi: `10.1234/open${index}`, accessScope: "open-access", metadataRank: { score: 11 - index * 2 } }));
  const pages = paginateSourceLanes(sourceResultLanes([...library, ...open, library[0], open[0]]));
  const initial = pages.flatMap((lane) => lane.initialResults);
  const hidden = pages.flatMap((lane) => lane.moreResults);
  assert.equal(initial.length, 5);
  assert.equal(hidden.length, 6);
  assert.equal(new Set([...initial, ...hidden].map((result) => result.doi)).size, 11);
  assert.equal(initial.some((result) => result.doi === "10.1234/open0"), true);
  assert.equal(initial.every((result) => result.metadataRank.score >= 8), true);
});

test("a lane with no initially featured work retains nonempty disclosure results", () => {
  const library = Array.from({ length: 7 }, (_, index) => ({ title: `Library research work number ${index}`, doi: `10.1234/library${index}`, accessScope: "library", metadataRank: { score: 20 - index } }));
  const open = [{ title: "Open-access supporting research work", doi: "10.1234/open", accessScope: "open-access", metadataRank: { score: 1 } }];
  const pages = paginateSourceLanes(sourceResultLanes([...library, ...open]));
  assert.equal(pages[1].initialResults.length, 0);
  assert.equal(pages[1].filteredResults.length, 1);
  assert.equal(pages[1].moreResults.length, 1);
});
