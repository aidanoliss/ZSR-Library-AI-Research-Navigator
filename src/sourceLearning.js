import { sourceMetadataText, sourceMethodEvidence } from "./sourceMetadataChecks.js";
import { evidencePassageContext } from "../config/evidencePassages.js";

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

/** Describe format and research role separately. Inferences are never peer-review evidence. */
export function describeSourceRole(source = {}) {
  const type = clean(source.type || source.citationMetadata?.type || source.citation?.type || source.sourceKind).toLowerCase().replace(/[_-]+/g, " ");
  const title = clean(source.title);
  const abstract = sourceMetadataText(source);
  const role = (id, label, basis, inferred = false) => ({ id, label, basis, inferred });
  if (/book review/.test(type)) return role("book-review", "Book review", `Provider type: ${type}. A review discusses a book; it is not the book itself.`);
  if (/book chapter|book section/.test(type)) return role("chapter", "Book chapter", `Provider type: ${type}. Check the chapter's own argument and author.`);
  if (/^(?:book|monograph|ebook)$/.test(type)) return role("book", "Book", `Provider type: ${type}. A book may synthesize research or present an original argument.`);
  if (/editorial|commentary|opinion|perspective/.test(type)) return role("commentary", "Commentary / opinion", `Provider type: ${type}. An argument or perspective does not itself establish an empirical result.`);
  if (/preprint|working paper|posted content/.test(type)) return role("preprint", "Preprint / working paper", `Provider type: ${type}. Publication and peer-review status need checking.`);
  if (/dataset/.test(type)) return role("data", "Dataset", `Provider type: ${type}. Inspect how the data were collected and what each variable measures.`);
  if (/newspaper|news article|^news$/.test(type)) return role("news", "News reporting", `Provider type: ${type}. Identify reporting, analysis, and opinion in the original publication.`);
  if (/primary source|archival|legal primary|manuscript/.test(type)) return role("primary", "Primary document", `Provider type: ${type}. Whether it is primary evidence depends on your research question and its original context.`);
  if (/systematic review|meta analysis/.test(type)) return role("synthesis", "Research synthesis", `Provider type: ${type}. Inspect the search, inclusion criteria, and included studies.`);
  if (/review/.test(type)) return role("review", "Review article", `Provider type: ${type}. Check whether it reviews studies, a book, or another work.`);
  if (/clinical trial|randomized controlled trial|observational study|empirical study/.test(type)) return role("study", "Empirical study", `Provider type: ${type}. Check design, sample, comparison group, and limitations.`);
  const venue = clean(source.containerTitle || source.journalTitle || source.publicationTitle || source.citation?.venue);
  if (/\bworking papers?\b|\bpreprints?\b/i.test(venue)) return role("preprint", "Likely working paper / preprint", `The reported venue is “${venue}”. Check the record's version and peer-review status; it may differ from a later journal article.`, true);
  // Title cues can identify a likely role, but are explicitly marked as inferred.
  if (/\bbook review\b/i.test(title) || /\b(?:this|we) (?:book )?review(?:s)? (?:the )?book\b/i.test(abstract)) return role("book-review", "Likely book review", "The title or abstract describes a book review. Confirm the publication type in the record.", true);
  if (/\b(?:systematic|scoping|integrative|literature|umbrella) review\b|\bmeta[- ]analysis\b/i.test(title)) return role("synthesis", "Likely research synthesis", "The title names a review or meta-analysis. This does not establish that its review methods are sound.", true);
  if (/\b(?:in this|this|our) theoretical review(?: paper)?\b/i.test(abstract)) return role("review", "Likely theoretical review", "The provider abstract describes this work as a theoretical review. Check how its framework draws on prior evidence; it is not automatically an original empirical study.", true);
  if (["systematic review", "scoping review", "meta-analysis", "umbrella review"].some((method) => sourceMethodEvidence(source, method).status === "meets")) return role("synthesis", "Likely research synthesis", "The provider abstract says the authors conducted a review. Verify its search and inclusion methods in the source.", true);
  if (/\b(?:editorial|commentary|opinion|perspective)\s*[:—-]/i.test(title)) return role("commentary", "Likely commentary", "The title signals commentary or opinion. Confirm in the publication.", true);
  if (/\breview\s*$/i.test(title)) return role("review", "Review · check type", "The title ends in “review”; the metadata does not establish what is being reviewed.", true);
  if (sourceMethodEvidence(source, "empirical study").status === "meets") return role("study", "Likely empirical study", "The provider abstract describes a study method. Read the methods and results to confirm the design and findings.", true);
  if (/article|journal/.test(type)) return role("article", "Article · study type unknown", `Provider type: ${type}. This label alone does not establish original research or peer review.`);
  return role("unknown", "Source type needs checking", type ? `Provider type: ${type}. Its role is not established by the available metadata.` : "The provider did not supply enough information to establish its role.");
}

export function readingSteps(source = {}) {
  const role = describeSourceRole(source).id;
  const first = {
    synthesis: "Check the review question, databases searched, search dates, and inclusion criteria. Which studies or perspectives could be missing?",
    review: "Establish what this reviews: research studies, a book, or another work. Do not treat a reviewer's account as the original work.",
    "book-review": "Identify the book and the reviewer's perspective. Follow up with the book before attributing its arguments to its author.",
    book: "Scan the contents and introduction, then choose the chapter relevant to your question. Check the author's scope and evidence.",
    chapter: "Read the chapter's opening and conclusion, then trace its evidence. Distinguish the chapter author's claims from the book editor's framing.",
    commentary: "Identify the author's position and purpose. Separate argument from evidence, then follow its citations to original research.",
    primary: "Identify the creator, date, audience, and purpose. What does this document reveal in its historical context, and whose perspective is missing?",
    news: "Check the publication, date, reporter, and original sources. Distinguish reporting from opinion and follow links to underlying evidence.",
    data: "Read the documentation: population, collection method, dates, missing values, and variable definitions. Check that it measures what you need.",
    preprint: "Check the version and publication status, then read the methods and limitations. Look for a later published version and corrections.",
  }[role] || "Read the abstract for fit, then inspect the methods, results, and limitations. Identify the sample and comparison; association alone does not establish causation.";
  return [first, "Choose one claim you might use. Locate the exact passage, figure, or table in the full text and record its page or section. Does the evidence support the claim's scope and wording?", "Compare it with an independent source. Follow references backward and use “Cited by” in Google Scholar to look forward; check for disagreement and gaps."];
}

/** Defensive display check, in addition to server validation; legacy sessions may lack IDs. */
export function evidenceNotesForSource(source = {}, notes = []) {
  if (!source.evidenceId || !source.evidenceExcerpt) return [];
  return (Array.isArray(notes) ? notes : []).filter((note) => note?.source_id === source.evidenceId && note.evidence_scope === "abstract" && typeof note.quote === "string" && clean(note.quote).length >= 30 && evidencePassageContext(source.evidenceExcerpt, note.quote)).slice(0, 3).map(({source_id, quote, evidence_scope}) => ({source_id, quote, evidence_scope}));
}
