import test from "node:test";
import assert from "node:assert/strict";
import { assessSourceRequirements } from "../src/sourceAssessment.js";
import { buildResearchSpec } from "../config/researchSpec.js";

const check = (source, spec, id) => assessSourceRequirements(source, spec).checks.find((item) => item.id === id);
const method = (include, exclude = []) => ({ methodRequirements: { include, exclude } });
const period = (timePeriod) => ({ facets: { timePeriod } });
const population = (value) => ({ facets: { population: value } });

test("method checks use fuller abstracts and distinguish this study from mentions of other studies", () => {
  const source = { type: "article", abstractExcerpt: "Published studies leave important questions unanswered.", abstractText: "Published studies leave important questions unanswered. We conducted a systematic review of 32 studies." };
  assert.equal(assessSourceRequirements(source, method(["systematic review"])).status, "meets");
  assert.equal(assessSourceRequirements(source, method([], ["systematic review"])).status, "mismatch");
  assert.match(assessSourceRequirements(source, method(["systematic review"])).checks[0].detail, /not been checked against the full text/);
  assert.match(assessSourceRequirements(source, method(["systematic review"])).checks[0].detail, /“We conducted a systematic review of 32 studies\.”/, "a quoted passage must retain provider capitalization and punctuation");
  for (const abstractText of [
    "Previous systematic reviews reported inconsistent findings.",
    "We discuss a systematic review published by Smith.",
    "We conducted no systematic review.",
    "We did not conduct a systematic review.",
    "We conducted interviews rather than a systematic review.",
    "We will conduct a systematic review.",
    "This study evaluates the quality of systematic reviews.",
    "Our study cites a systematic review and proposes a new theory.",
    "We used a prior systematic review as background.",
  ]) {
    assert.equal(assessSourceRequirements({ type: "article", abstractText }, method(["systematic review"])).status, "unverified", abstractText);
    assert.equal(assessSourceRequirements({ type: "article", abstractText }, method([], ["systematic review"])).status, "unverified", abstractText);
  }
});

test("explicit methods and review roles inform original-study requests without inventing excluded-method absence", () => {
  for (const type of ["book-review", "systematic-review", "editorial"]) {
    assert.equal(assessSourceRequirements({ type }, method(["empirical study"])).status, "mismatch", type);
  }
  assert.equal(assessSourceRequirements({ type: "article", abstractText: "In this theoretical review paper, we examine an established framework." }, method(["empirical study"])).status, "mismatch");
  assert.equal(assessSourceRequirements({ type: "article", abstractText: "We interviewed 25 university students about food access." }, method(["empirical study"])).status, "meets");
  assert.equal(assessSourceRequirements({ type: "article", abstractText: "We used qualitative interviews to explore access." }, method(["qualitative interview"])).status, "meets");
  assert.equal(assessSourceRequirements({ type: "article", abstractText: "We conducted a randomized controlled trial." }, method(["randomized controlled trial"])).status, "meets");
  assert.equal(assessSourceRequirements({ type: "article", abstractText: "We interviewed 25 participants." }, method([], ["literature review"])).status, "unverified");
  assert.equal(assessSourceRequirements({ type: "government_documents", abstractText: "We surveyed 300 households." }, method(["empirical study"])).status, "meets", "government publications can contain original research");
  assert.equal(assessSourceRequirements({ type: "book-review", abstractText: "We interviewed 25 university students." }, method(["empirical study"])).status, "mismatch", "a book review must not inherit the reviewed book's method");
  assert.equal(assessSourceRequirements({ type: "article", title: "College Belonging (Book Review)", abstractText: "We interviewed 25 university students." }, method(["empirical study"])).status, "mismatch");
  assert.equal(assessSourceRequirements({ type: "article", abstractText: "This article reviews the book College Belonging. We interviewed 25 university students." }, method(["empirical study"])).status, "mismatch");
  assert.equal(assessSourceRequirements({ type: "article", abstractText: "We conducted a systematic review and then interviewed 25 teachers." }, method(["empirical study"])).status, "unverified", "a mixed design must not be excluded just for containing a review");
});

test("school-only participants conflict with college requests while mixed, broad, and missing samples survive", () => {
  const spec = population("college students");
  assert.equal(check({ abstractText: "We recruited 80 high-school students." }, spec, "population").status, "mismatch");
  assert.equal(check({ abstractText: "The participants were secondary school pupils." }, spec, "population").status, "mismatch");
  assert.equal(check({ abstractText: "This study investigates revision among first-year university students." }, spec, "population").status, "meets");
  assert.equal(check({ abstractText: "We interviewed 20 undergraduates." }, spec, "population").status, "meets");
  assert.equal(check({ abstractText: "We recruited high-school students and college students." }, spec, "population").status, "unverified", "a mixed sample needs applicability checks");
  for (const abstractText of [
    "Previous studies surveyed high-school students.",
    "We did not recruit high-school students.",
    "We interviewed young adults about writing.",
    "We recruited teachers of high-school students.",
    "This study examines how high-school students become university graduates.",
    "We will recruit high-school students.",
    "", 
  ]) assert.equal(check({ abstractText }, spec, "population").status, "unverified", abstractText);
});

test("population checks retain arbitrary explicitly described populations without a topic synonym table", () => {
  const spec = population("nurses");
  assert.equal(check({ abstractText: "We interviewed 25 nurses about work schedules." }, spec, "population").status, "meets");
  assert.equal(check({ abstractText: "We surveyed hospital workers." }, spec, "population").status, "unverified");
});

test("study-period checks reject old data even in a recent publication and allow recent data", () => {
  const spec = period("after 2015");
  const source = { publicationYear: 2025, abstractText: "We analyzed panel data from 2000–2007 to estimate the effect of minimum wages." };
  assert.equal(check(source, spec, "study-period").status, "mismatch");
  assert.equal(check({ publicationYear: 1978 }, spec, "study-period").status, "mismatch");
  assert.equal(check({ publicationYear: 2024, abstractText: "We analyzed data from 2016 to 2020." }, spec, "study-period").status, "meets");
  assert.equal(check({ publicationYear: 2024 }, spec, "study-period").status, "unverified", "publication recency does not establish study coverage");
  assert.equal(check({ publicationYear: 2025, abstractText: "We analyzed data from 2000–2007 and 2018–2020." }, spec, "study-period").status, "meets", "a historical comparison must not be rejected on its first period alone");
});

test("study-period checks ignore dates attributed to earlier work, plans, and forecasts", () => {
  const spec = period("after 2015");
  for (const abstractText of [
    "Previous studies used data from 2000–2007.",
    "We discuss Smith's analysis of data from 2000–2007.",
    "We did not use data from 2000–2007.",
    "We will analyze data from 2000–2007.",
    "This study examines forecasts from 2000–2007 for the 2020s.",
  ]) assert.equal(check({ publicationYear: 2025, abstractText }, spec, "study-period").status, "unverified", abstractText);
  assert.equal(check({ publicationYear: 2010, title: "Projections of employment after 2015" }, spec, "study-period").status, "unverified", "a projection must not be treated as observed historical evidence");
});

test("historical subject periods remain distinct from publication-date restrictions", () => {
  const spec = buildResearchSpec("Women abolitionists in the United States before 1865");
  const source = { type: "article", publicationYear: 2024, abstractText: "This study examines abolitionist organizing from 1830–1860." };
  assert.equal(check(source, spec, "study-period").status, "meets");
  assert.equal(check(source, spec, "publication-date"), undefined);
  assert.notEqual(assessSourceRequirements(source, spec).status, "mismatch");
  assert.equal(check({ publicationYear: 2025, abstractText: "We analyzed voting data from 1920–1940." }, period("before 1865"), "study-period").status, "mismatch");
});

test("a book review or hearing is not silently accepted as a requested book", () => {
  const spec = { mode: "books" };
  assert.equal(check({ sourceKind: "catalog-record", type: "book-review", title: "Community organizing" }, spec, "document-role").status, "mismatch");
  const hearing = { sourceKind: "catalog-record", type: "government_documents", title: "Environmental justice: hearing before the Subcommittee on Chemical Safety" };
  assert.equal(check(hearing, spec, "document-role").status, "mismatch");
  assert.equal(check(hearing, { mode: "scholarly" }, "document-role").status, "mismatch");
  assert.equal(check(hearing, { mode: "primary" }, "document-role"), undefined, "a hearing can be appropriate primary evidence");
  assert.equal(assessSourceRequirements({ type: "book", title: "Environmental justice: a history" }, spec).status, "meets");
  assert.equal(check({ type: "book", title: "The history of congressional hearings" }, spec, "document-role"), undefined, "a book about hearings is not a hearing");
});

test("known-item searches do not reinterpret title words as population or subject-date requirements", () => {
  const result = assessSourceRequirements({ type: "book", title: "Students after 2000", publicationYear: 1999 }, {
    mode: "books", knownItem: { title: "Students after 2000" }, facets: { population: "college students", timePeriod: "after 2000" },
  });
  assert.equal(result.checks.some(({ id }) => id === "population" || id === "study-period"), false);
  assert.equal(result.status, "meets");
});

test("structured and passive abstract methods identify completed interviews and participants", () => {
  const structured = { abstractText: "Participants: The study recruited 21 college students at risk of food insecurity using purposive sampling." };
  assert.equal(check(structured, population("college students"), "population").status, "meets");
  assert.equal(assessSourceRequirements(structured, method(["empirical study"])).status, "meets");
  const passive = { abstractText: "In-depth qualitative interviews were conducted with college students to explore food insecurity." };
  assert.equal(assessSourceRequirements(passive, method(["qualitative interview"])).status, "meets");
  assert.equal(assessSourceRequirements(passive, method(["qualitative study"])).status, "meets");
  assert.equal(assessSourceRequirements(passive, method(["empirical study"])).status, "meets");
  assert.equal(check(passive, population("college students"), "population").status, "meets");
  const qualitative = { abstractText: "This qualitative research was conducted at a Midwestern public research university through semi-structured interviews with embedded surveys that measured food insecurity." };
  assert.equal(assessSourceRequirements(qualitative, method(["qualitative interview"])).status, "meets");
  assert.equal(assessSourceRequirements(qualitative, method(["qualitative study"])).status, "meets");
  assert.equal(assessSourceRequirements(qualitative, method(["empirical study"])).status, "meets");
  assert.equal(check(qualitative, population("college students"), "population").status, "unverified", "university setting alone does not prove that the participants were college students");
  assert.ok(assessSourceRequirements(qualitative, method(["qualitative interview"])).checks[0].detail.includes(`“${qualitative.abstractText}”`), "structured method evidence remains an exact provider quotation");
});

test("context-led study scope identifies the population without confusing teachers and participants", () => {
  assert.equal(check({ abstractText: "Based on this change, the study focuses on non English major undergraduates in Chinese universities who have passed CET-4." }, population("college students"), "population").status, "meets");
  assert.equal(check({ abstractText: "Based on these observations, the study focuses on political science major undergraduates." }, population("college students"), "population").status, "meets");
  for (const abstractText of [
    "Participants: The study recruited teachers of college students.",
    "In-depth qualitative interviews were conducted with teachers of college students.",
    "Based on this change, the study focuses on teachers of undergraduates.",
    "We interviewed teachers of college students.",
    "The study focuses on college students.",
  ]) assert.equal(check({ abstractText }, population("college students"), "population").status, "unverified", abstractText);
});

test("structured and passive forms do not confirm cited studies or planned methods", () => {
  for (const abstractText of [
    "Participants: The previous study recruited 21 college students.",
    "Participants: The study will recruit 21 college students.",
    "Participants: The study recruited 21 college students in an earlier experiment.",
    "In-depth qualitative interviews were conducted with college students in a previous study.",
    "In-depth qualitative interviews will be conducted with college students.",
    "This qualitative research will be conducted at a university through semi-structured interviews.",
    "This qualitative research was conducted at a university through semi-structured interviews, as described by Smith.",
    "Based on this change, the study plans to focus on undergraduates.",
    "Based on this change, the previous study focuses on undergraduates.",
  ]) {
    assert.equal(assessSourceRequirements({ abstractText }, method(["qualitative interview"])).status, "unverified", abstractText);
    assert.equal(check({ abstractText }, population("college students"), "population").status, "unverified", abstractText);
  }
  assert.equal(assessSourceRequirements({ title: "A qualitative interview study of college students" }, method(["qualitative interview"])).status, "unverified");
  assert.equal(check({ title: "A qualitative interview study of college students" }, population("college students"), "population").status, "unverified");
});

test("method-led period clauses identify historical data but not other authors or future plans", () => {
  const abstractText = "Leveraging a period of stability in minimum wages (2000–2007) and two distinct national geocoded databases of establishments, we explore how indexing affected employment in Oregon restaurants, one of the earliest indexing states (2003).";
  assert.equal(check({ publicationYear: 2025, abstractText }, period("after 2015"), "study-period").status, "mismatch");
  assert.equal(check({ publicationYear: 2025, abstractText: abstractText.replace("2000–2007", "2016–2020") }, period("after 2015"), "study-period").status, "meets");
  for (const text of [
    "Leveraging a period of stability (2000–2007), earlier studies explore restaurant employment.",
    "Leveraging a period of stability (2000–2007), we will explore restaurant employment.",
    "Leveraging a period of stability (2000–2007), we explore forecasts for restaurant employment.",
    "Leveraging a period of stability (2000–2007), we explore previous studies of restaurant employment.",
  ]) assert.equal(check({ publicationYear: 2025, abstractText: text }, period("after 2015"), "study-period").status, "unverified", text);
});
