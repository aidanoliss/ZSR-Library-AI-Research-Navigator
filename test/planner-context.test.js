import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlannerContext } from "../config/plannerContext.js";
import { extractSourceRequirements } from "../config/sourceRequirements.js";

const legacyDate = "What time period should the search prioritize?";
const newDate = "When should the sources have been published?";
const narrowing = "Would a population, place, or comparison help focus the search?";

test("reported planner choices become publication guidance without an invented comparison", () => {
  const actual = normalizePlannerContext(`${legacyDate}: Last 5 years\nWhat source types should ZSR scan first?: Peer-reviewed articles\nHow would you like to narrow your topic?: Compare two approaches`);
  assert.equal(actual, "Published in the last 5 years\nSource type: Peer-reviewed articles");
  assert.deepEqual(extractSourceRequirements(actual.split("\n")[0], { currentYear: 2026 }), { publicationYearFrom: 2022, publicationYearTo: 2026, peerReviewed: false, requestedSourceCount: null });
});

test("legacy and new date controls retain their publication meaning", () => {
  for (const question of [legacyDate, newDate, "Time period", "Publication date"]) {
    assert.equal(normalizePlannerContext(`${question}: Last 10 years`), "Published in the last 10 years");
    assert.equal(normalizePlannerContext(`${question}: Published in the last 5 years`), "Published in the last 5 years");
    assert.equal(normalizePlannerContext(`${question}: Any time period`), "Any publication date");
    assert.equal(normalizePlannerContext(`${question}: Any publication date`), "Any publication date");
  }
  assert.equal(normalizePlannerContext("Last five years"), "Published in the last 5 years");
});

test("generic date-advice labels do not become literal search requirements", () => {
  for (const preference of ["Historical context", "Recent scholarship", "Foundational studies"]) {
    assert.equal(normalizePlannerContext(`${legacyDate}: ${preference}`), "");
    assert.equal(normalizePlannerContext(preference), "");
  }
  assert.equal(normalizePlannerContext(`${legacyDate}: Historical context; 1850–1900`), "Study period: 1850–1900");
});

test("explicit historical scope stays distinct from typed publication dates", () => {
  assert.equal(normalizePlannerContext("Study period: Last 5 years"), "Study period: Last 5 years");
  assert.equal(normalizePlannerContext("Historical period: after 2014"), "Study period: after 2014");
  assert.equal(normalizePlannerContext(`${newDate}: Since 2020`), "Publication date: Since 2020");
  assert.equal(normalizePlannerContext(`${legacyDate}: 1930–1950`), "Study period: 1930–1950");
});

test("scope labels require a real student-supplied population, place, or comparison", () => {
  for (const [choice, detail, label] of [["A particular population", "children", "Population"], ["A particular place", "United States", "Geography"], ["Compare two approaches", "vaccinated versus unvaccinated children", "Comparison"], ["Compare two groups or approaches", "online versus in-person teaching", "Comparison"]]) {
    assert.equal(normalizePlannerContext(`${narrowing}: ${choice}`), "");
    assert.equal(normalizePlannerContext(`${narrowing}: ${choice}; ${detail}`), `${label}: ${detail}`);
  }
  assert.equal(normalizePlannerContext(`${narrowing}: No extra limits`), "");
  assert.equal(normalizePlannerContext(`${narrowing}: Not sure yet`), "");
  assert.equal(normalizePlannerContext(`${narrowing}: nurses in Kenya`), "Research scope: nurses in Kenya");
});

test("normalization keeps concrete labels and unfamiliar guidance without inferring entities", () => {
  const raw = "Population: college students\nGeography: Bangladesh\nComparison: A versus B\nStudy period: 1950s\nInstructor preference: Include varied perspectives";
  assert.equal(normalizePlannerContext(raw), raw);
  assert.equal(normalizePlannerContext(`${narrowing}: A particular place; A particular population; Kenya; nurses`), "Research scope: Kenya; nurses");
  assert.equal(normalizePlannerContext("What source type do you need?: Data/statistics"), "Source type: Data/statistics");
});

test("normalization is idempotent, bounded, and does not reinterpret free-form dates", () => {
  const value = normalizePlannerContext(`${newDate}: Published in the last 5 years\n${narrowing}: A particular place; India\nStudy period: last 10 years`);
  assert.equal(normalizePlannerContext(value), value);
  assert.equal(normalizePlannerContext("Background: changes in the last 5 years"), "Background: changes in the last 5 years");
  assert.equal(normalizePlannerContext(null), "");
  assert.ok(normalizePlannerContext("a".repeat(7000)).length <= 6000);
});
