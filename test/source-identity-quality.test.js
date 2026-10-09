import test from "node:test";
import assert from "node:assert/strict";
import { assessKnownItemIdentity, assessSourceRelevance, rankSourceResults } from "../server/sourceRelevance.js";
import { searchCrossref, searchSourceCandidates } from "../server/primo.js";
import { searchLibrarySourceCandidates } from "../server/primoApi.js";
import { sourceDiscoveryStatus } from "../server/sourceDiscovery.js";
import { uniqueSourceResults } from "../src/sourceDedup.js";

const knownSpec = {
  mode: "scholarly",
  knownItem: { kind: "article", title: "The Tragedy of the Commons", author: "Garrett Hardin" },
  concepts: [{ id: "known-item-title", preferredTerm: "The Tragedy of the Commons", required: true }, { id: "known-item-author", preferredTerm: "Garrett Hardin", required: true }],
  sourceRequirements: {},
};
const knownQuery = '"The Tragedy of the Commons" AND "Garrett Hardin"';
const originalDoi = "10.1126/science.162.3859.1243";
function relatedDoc(index) {
  return {
    pnx: {
      control: { recordid: [`related-${index}`] },
      display: { title: [`Garrett Hardin and The Tragedy of the Commons: commentary ${index}`], creator: [`Commentator ${index}`], type: ["article"], creationdate: ["2024"] },
      addata: { abstract: ["This commentary discusses Garrett Hardin's The Tragedy of the Commons."] },
    },
  };
}
function originalCrossref() {
  return { DOI: originalDoi, title: ["The Tragedy of the Commons"], author: [{ given: "Garrett", family: "Hardin" }], published: { "date-parts": [[1968, 12, 13]] }, type: "journal-article", "container-title": ["Science"], volume: "162", issue: "3859", page: "1243-1248" };
}

test("a title or abstract mentioning the requested author cannot establish author identity", () => {
  const related = { title: "Cold War Pastures: Garrett Hardin and the Tragedy of the Commons", authors: ["Fabien Locher"], abstractExcerpt: "Garrett Hardin wrote The Tragedy of the Commons.", type: "article" };
  const match = assessSourceRelevance(related, knownSpec);
  assert.equal(match.identity.status, "related");
  assert.equal(match.identity.authorMatch, false);
  assert.equal(match.status, "partial");
  assert.equal(match.category, "related-work");
  assert.match(match.label, /Related work/);
  assert.equal(match.evidence.some((item) => item.field === "authors"), false);
  assert.match(match.explanation, /not a matched copy/);
});

test("exact identity uses normalized title and one actual author, never unordered title overlap", () => {
  assert.equal(assessKnownItemIdentity({ title: "THE TRAGEDY OF THE COMMONS.", authors: ["Hardin, Garrett"], type: "article" }, knownSpec).status, "exact");
  assert.notEqual(assessKnownItemIdentity({ title: "The Commons and Their Tragedy", authors: ["Garrett Hardin"], type: "article" }, knownSpec).status, "exact");
  assert.notEqual(assessKnownItemIdentity({ title: "The Tragedy of the Commons", authors: ["Garrett Smith", "John Hardin"], type: "article" }, knownSpec).status, "exact");
  assert.notEqual(assessKnownItemIdentity({ title: "The Tragedy of the Commons", authors: ["G. Hardin"], type: "article" }, knownSpec).status, "exact");
  assert.equal(assessKnownItemIdentity({ title: "The Tragedy of the Commons", type: "article" }, knownSpec).status, "unverified");
  assert.notEqual(assessKnownItemIdentity({ title: "The Tragedy of the Commons", authors: ["Garrett Hardin"], type: "book chapter" }, knownSpec).status, "exact");
});

test("structured author metadata preserves identity and readable evidence", () => {
  for (const authors of [[{ given: "Garrett", family: "Hardin" }], [{ name: "Garrett Hardin" }], [{ displayName: "Hardin, Garrett" }]]) {
    const match = assessSourceRelevance({ title: knownSpec.knownItem.title, authors, type: "article" }, knownSpec);
    assert.equal(match.identity.status, "exact");
    assert.match(match.evidence.find((item) => item.field === "authors").excerpt, /Hardin/);
    assert.doesNotMatch(JSON.stringify(match.evidence), /\[object Object\]/);
  }
  assert.equal(assessKnownItemIdentity({ title: knownSpec.knownItem.title, author: { given: "Garrett", family: "Hardin" }, type: "article" }, knownSpec).status, "exact");
});

test("Crossref resolves title and author fields when a full Primo result set contains only related works", async () => {
  const previousFetch = globalThis.fetch;
  let crossrefRequests = 0;
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    if (parsed.hostname === "api.crossref.org") {
      crossrefRequests += 1;
      assert.equal(parsed.searchParams.get("query.title"), knownSpec.knownItem.title);
      assert.equal(parsed.searchParams.get("query.author"), knownSpec.knownItem.author);
      return { ok: true, json: async () => ({ message: { items: [originalCrossref()] } }) };
    }
    return { ok: true, json: async () => ({ docs: Array.from({ length: 12 }, (_, index) => relatedDoc(index)) }) };
  };
  try {
    const results = await searchSourceCandidates([knownQuery], 10, "scholarly", { researchSpec: knownSpec });
    assert.equal(crossrefRequests, 1, "ten related works must not suppress identity resolution");
    assert.equal(results.length, 10);
    assert.equal(results[0].doi, originalDoi);
    assert.equal(results[0].matchExplanation.identity.status, "exact");
    assert.ok(results.slice(1).every((result) => result.matchExplanation.identity.status === "related"));
    assert.equal(new Set(results.map((result) => result.doi || result.title)).size, results.length);
  } finally { globalThis.fetch = previousFetch; }
});

test("institutional Primo also falls back for unresolved known-item identity", async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, json: async () => String(url).includes("api.crossref.org") ? { message: { items: [originalCrossref()] } } : { docs: Array.from({ length: 12 }, (_, index) => relatedDoc(index)) } };
  };
  const env = {
    PRIMO_API_PROFILE: "institutional", PRIMO_API_ENDPOINT: "https://api-na.hosted.exlibrisgroup.com/primo/v1/search", PRIMO_API_KEY: "test-only", PRIMO_API_VID: "01WAKE_INST:ZSR", PRIMO_API_INST: "01WAKE_INST", PRIMO_API_RECORD_HOST: "https://wfu.primo.exlibrisgroup.com", PRIMO_API_CATALOG_TAB: "LibraryCatalog", PRIMO_API_CATALOG_SCOPE: "ZSR", PRIMO_API_ARTICLES_TAB: "Articles", PRIMO_API_ARTICLES_SCOPE: "CentralIndex", PRIMO_API_USE_FOR_DISCOVERY: "on",
  };
  try {
    const results = await searchLibrarySourceCandidates([knownQuery], 5, "scholarly", env, { researchSpec: knownSpec });
    assert.equal(results[0].doi, originalDoi);
    assert.equal(results[0].matchExplanation.identity.status, "exact");
    assert.equal(calls.filter((url) => url.includes("api.crossref.org")).length, 1);
  } finally { globalThis.fetch = previousFetch; }
});

test("an explicitly supplied identifier uses a generic record lookup and checks conflicts", async () => {
  const previousFetch = globalThis.fetch;
  const doi = "10.5555/arbitrary-work";
  const spec = { ...knownSpec, knownItem: { kind: "article", title: "An arbitrary work", author: "A Person", doi } };
  globalThis.fetch = async (url) => {
    assert.equal(new URL(url).pathname, `/works/${encodeURIComponent(doi)}`);
    return { ok: true, json: async () => ({ message: { DOI: doi, title: ["An arbitrary work"], author: [{ given: "A", family: "Person" }], type: "journal-article" } }) };
  };
  try {
    const results = await searchCrossref("An arbitrary work", 5, "scholarly", { researchSpec: spec });
    assert.equal(results[0].matchExplanation.identity.identifierMatch, true);
    assert.equal(results[0].matchExplanation.identity.status, "exact");
    assert.equal(assessKnownItemIdentity({ title: "An arbitrary work", author: "A Person", type: "article", doi: "10.5555/different" }, spec).status, "related");
  } finally { globalThis.fetch = previousFetch; }
});

test("identity ranking cannot bypass publication requirements", () => {
  const results = rankSourceResults([{ title: knownSpec.knownItem.title, authors: ["Garrett Hardin"], type: "article", date: "1968" }], { ...knownSpec, sourceRequirements: { publicationYearFrom: 2020 } });
  assert.deepEqual(results, []);
});

const comparisonSpec = {
  mode: "scholarly",
  concepts: [
    { id: "cbt", preferredTerm: "cognitive behavioral therapy", synonyms: ["CBT"] },
    { id: "mindfulness", preferredTerm: "mindfulness", synonyms: ["MBSR"] },
    { id: "anxiety", preferredTerm: "anxiety" },
  ],
  comparison: { conceptIds: ["cbt", "mindfulness"], terms: ["cognitive behavioral therapy", "mindfulness"] },
};

test("a combined CBT and mindfulness intervention versus wait-list is not a direct comparison of the approaches", () => {
  const source = { title: "Cognitive behavioral therapy and mindfulness for anxiety", abstractExcerpt: "This study explored the combined effects of CBT and MBSR. The combined intervention was compared with a wait-list control group.", type: "article" };
  const match = assessSourceRelevance(source, comparisonSpec);
  assert.equal(match.category, "supporting");
  assert.equal(match.relationship.status, "combined-approach");
  assert.match(match.label, /comparison not established/);
  assert.match(match.explanation, /used separately/);
});

test("comparison evidence must connect both sides in the same title or abstract statement", () => {
  const direct = { title: "Cognitive behavioral therapy versus mindfulness for anxiety", abstractExcerpt: "Students were assigned to separate CBT and MBSR groups.", type: "article" };
  const generic = { title: "Cognitive behavioral therapy and mindfulness for anxiety", abstractExcerpt: "Both approaches are discussed. We compared participants with a control group.", type: "article" };
  const absent = { title: "Cognitive behavioral therapy and mindfulness for anxiety", abstractExcerpt: "No direct comparison of CBT and mindfulness was conducted.", type: "article" };
  assert.equal(assessSourceRelevance(direct, comparisonSpec).category, "direct-comparison");
  assert.equal(assessSourceRelevance(generic, comparisonSpec).relationship.status, "not-established");
  assert.equal(assessSourceRelevance(absent, comparisonSpec).relationship.status, "not-established");
  assert.equal(rankSourceResults([generic, direct], comparisonSpec)[0].title, direct.title);
});

test("combined datasets do not imply a combined clinical intervention", () => {
  const source = { title: "Cognitive behavioral therapy versus mindfulness for anxiety", abstractExcerpt: "We combined datasets from separate CBT and mindfulness treatment arms.", type: "article" };
  assert.equal(assessSourceRelevance(source, comparisonSpec).relationship.status, "comparison-indicated");
});

test("discovery reports an unresolved original distinctly from returned related sources", () => {
  const related = { title: "Garrett Hardin and The Tragedy of the Commons: commentary", author: "A Commentator", type: "article", accessScope: "library" };
  const status = sourceDiscoveryStatus("library", [related], { library: [{ status: "success" }] }, knownSpec);
  assert.equal(status.identity.status, "not-found");
  assert.equal(status.identity.exactCount, 0);
  assert.equal(status.identity.relatedCount, 1);
  assert.match(status.identity.explanation, /different sources/);
  const incomplete = sourceDiscoveryStatus("library", [related], { library: [{ status: "timeout" }] }, knownSpec);
  assert.equal(incomplete.identity.status, "search-incomplete");
});

// Provider metadata captured on 2026-10-05. Publisher review corroborated these as
// one Vogel chapter represented with a short title and a title including its subtitle.
const vogelChapter = {
  title: "The Tragedy of the Commons",
  author: "Vogel, Joseph Henry; Vogel, Joseph",
  authors: ["Vogel, Joseph Henry", "Vogel, Joseph"],
  date: "2012", type: "book_chapter", doi: "10.7135/UPO9781843318637.006", pages: "13-26", edition: "",
  isbn: "9781843318781", containerTitle: "The Economics of the Yasuní Initiative",
  abstractExcerpt: '"The Tragedy of the Commons" opens with a salvo from two nuclear scientists who had thought long and deeply about the arms race between the superpowers: "It is our considered professional judgment that this dilemma has no technical solution" (italics in original). Garrett Hardin expands upon that judgment and perceives that a whole class of problems...',
  abstractSource: "ZSR record metadata", sourceProvider: "ZSR discovery",
  url: "https://library.example/proquest-chapter",
};
const vogelExpandedChapter = {
  title: "THE TRAGEDY OF THE COMMONS: A Class of Problems that has no Technical Solution",
  author: "Joseph Henry Vogel", authors: ["Joseph Henry Vogel"],
  date: "2010-01-01", type: "book_chapter", doi: "", isbn: "9781843318781", pages: "13-", edition: "",
  containerTitle: "The Economics of the Yasuní Initiative",
  abstractExcerpt: '“The Tragedy of the Commons” opens with a salvo from two nuclear scientists who had thought long and deeply about the arms race between the superpowers:“It is our considered professional judgment that this dilemma has no technical solution”(italics in original).[ 1]Garrett Hardin expands upon that judgment and perceives that a wholeclassof problems...',
  abstractSource: "ZSR record metadata", sourceProvider: "ZSR discovery",
  url: "https://library.example/jstor-chapter",
};

test("corroborated chapter title/date variants merge without losing their provider access routes", () => {
  for (const records of [[vogelChapter, vogelExpandedChapter], [vogelExpandedChapter, vogelChapter]]) {
    const [result, extra] = uniqueSourceResults(records);
    assert.equal(extra, undefined);
    assert.equal(result.doi, vogelChapter.doi);
    assert.equal(result.pages, "13-26", "retain the supplied end page when another record reports only the start");
    assert.equal(result.accessLinks.length, 2);
    assert.deepEqual(new Set(result.accessLinks.map((link) => link.url)), new Set(records.map((record) => record.url)));
    assert.deepEqual(result.metadataSources, ["ZSR discovery"]);
  }
  assert.equal(uniqueSourceResults([vogelExpandedChapter, vogelChapter, { ...vogelExpandedChapter, url: "https://library.example/third-chapter-record" }]).length, 1,
    "merging author aliases must not prevent a later duplicate from joining the same work");
});

test("chapter variants require converging evidence, not merely a shared book ISBN or title prefix", () => {
  const distinct = [
    { ...vogelExpandedChapter, title: "A different chapter of the same book" },
    { ...vogelExpandedChapter, abstractExcerpt: "Another chapter has different findings and argumentation." },
    { ...vogelExpandedChapter, abstractExcerpt: "", abstractText: "" },
    { ...vogelExpandedChapter, author: "Another Author", authors: ["Another Author"] },
    { ...vogelExpandedChapter, containerTitle: "A different edited collection" },
    { ...vogelExpandedChapter, isbn: "9781843318798" },
    { ...vogelExpandedChapter, type: "book" },
    { ...vogelExpandedChapter, doi: "10.5555/different-chapter" },
  ];
  for (const record of distinct) {
    assert.equal(uniqueSourceResults([vogelChapter, record]).length, 2, JSON.stringify(record));
  }
  assert.equal(uniqueSourceResults([{ ...vogelChapter, pages: "23–35" }, { ...vogelExpandedChapter, pages: "36–45" }]).length, 2);
});

test("chapter first-page-only metadata is incomplete while conflicting known page ranges remain distinct", () => {
  for (const pages of ["13", "13-", "p. 13", "pp. 13–26"]) {
    assert.equal(uniqueSourceResults([vogelChapter, { ...vogelExpandedChapter, pages }]).length, 1, pages);
  }
  for (const pages of ["14-26", "13-25", "14-", "13-26, 29-32", "Appendix A"]) {
    assert.equal(uniqueSourceResults([vogelChapter, { ...vogelExpandedChapter, pages }]).length, 2, pages);
  }
});

test("conflicting work identifiers and book editions stay separate even with identical titles and authors", () => {
  const original = { title: "A detailed introduction to researching the commons", author: "A Scholar", type: "book", date: "2020" };
  assert.equal(uniqueSourceResults([{ ...original, doi: "10.5555/first" }, { ...original, doi: "10.5555/second" }]).length, 2);
  assert.equal(uniqueSourceResults([{ ...original, edition: "First edition" }, { ...original, edition: "Second edition" }]).length, 2);
  assert.equal(uniqueSourceResults([{ ...original, isbn: "9781843318781" }, { ...original, isbn: "9781843318798" }]).length, 2);
  assert.equal(uniqueSourceResults([original, { ...original, date: "2030" }]).length, 2);
  assert.equal(uniqueSourceResults([original, { ...original, type: "book_chapter" }]).length, 2);
});

test("deduplication keeps full abstract, display excerpt, and attribution as one provider bundle", () => {
  const full = {
    title: "An article with provider abstracts", doi: "10.5555/abstract", sourceProvider: "Library",
    abstractText: "Brief introduction. Methods and findings are described later in this full provider abstract.",
    abstractExcerpt: "Brief introduction.", abstractSource: "Library abstract metadata", abstractTruncated: true,
  };
  const previewOnly = {
    ...full, sourceProvider: "Crossref", abstractText: "",
    abstractExcerpt: "A longer UI preview from a different metadata provider.", abstractSource: "Crossref abstract metadata", abstractTruncated: false,
  };
  for (const records of [[full, previewOnly], [previewOnly, full]]) {
    const [merged] = uniqueSourceResults(records);
    assert.equal(merged.abstractText, full.abstractText);
    assert.equal(merged.abstractExcerpt, full.abstractExcerpt);
    assert.equal(merged.abstractSource, full.abstractSource);
    assert.equal(merged.abstractTruncated, true);
    assert.deepEqual(new Set(merged.metadataSources), new Set(["Library", "Crossref"]));
  }
  const richer = { ...previewOnly, abstractText: `${full.abstractText} Additional results are provided by this provider.` };
  const [merged] = uniqueSourceResults([full, richer]);
  assert.equal(merged.abstractText, richer.abstractText);
  assert.equal(merged.abstractExcerpt, richer.abstractExcerpt);
  assert.equal(merged.abstractSource, richer.abstractSource);
  assert.equal(merged.abstractTruncated, false);
});

test("an abstract without its own preview never retains another provider's preview", () => {
  const full = { title: "Abstract evidence without a display excerpt", doi: "10.5555/preview", abstractText: "Provider full abstract. More source evidence.", sourceProvider: "Full provider" };
  const other = { ...full, abstractText: "", abstractExcerpt: "Other provider preview.", abstractSource: "Other provider" };
  const [merged] = uniqueSourceResults([other, full]);
  assert.equal(merged.abstractExcerpt, full.abstractText);
  assert.equal(merged.abstractSource, "Full provider");
});
