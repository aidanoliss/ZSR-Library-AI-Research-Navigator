/**
 * Translate guided-planner labels into research constraints. Menu labels are
 * not search concepts, and a comparison/place/population needs an actual value.
 * This normalizes bounded planner text only; it does not interpret evidence or
 * change free-form assignment/topic text.
 */
const clean = value => typeof value === "string"
  ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/[\t ]+/g, " ").trim()
  : "";
const key = value => clean(value).replace(/[?？]+$/g, "").toLowerCase();
const legacyDateQuestion = /^(?:what time period should the search prioritize|time period|timeframe)$/;
const publicationQuestion = /^(?:when should the sources have been published|what publication dates? should the search prioritize|publication dates?|publication years?|published dates?|date range)$/;
const sourceQuestion = /^(?:what source types? (?:should zsr scan first|do you need)|source types?|source format)$/;
const narrowingQuestion = /^(?:how would you like to narrow your topic|would a population, place, or comparison help focus the search|narrowing|narrowing preference)$/;
const genericDateAdvice = /^(?:historical context|historical change|recent scholarship|foundational studies)$/i;
const noNarrowing = /^(?:no extra limits|not sure yet|not sure|none|no preference|keep it broad)$/i;
const genericKinds = new Map([
  ["a particular population", "Population"],
  ["a particular place", "Geography"],
  ["compare two approaches", "Comparison"],
  ["compare two groups or approaches", "Comparison"],
  ["historical change", "Study period"],
]);

function relativePublication(value) {
  const match = clean(value).match(/^(?:published\s+(?:in\s+|within\s+)?)?(?:the\s+)?(?:last|past|previous)\s+(\d{1,3}|five|ten)\s+years?$/i);
  if (!match) return "";
  const years = { five: 5, ten: 10 }[match[1].toLowerCase()] || Number(match[1]);
  return years > 0 ? `Published in the last ${years} years` : "";
}
function anyPublication(value) {
  return /^(?:(?:any|all)\s+(?:publication\s+)?(?:dates?|years?|time periods?)|no\s+(?:publication\s+)?date\s+(?:limit|restriction)s?)$/i.test(clean(value));
}
function parts(value) { return value.split(/\s*;\s*/).map(clean).filter(Boolean); }

function dateLines(value, publication) {
  const values = parts(value);
  const historical = values.some(item => genericDateAdvice.test(item) && /^historical/i.test(item));
  return values.flatMap(item => {
    if (anyPublication(item)) return ["Any publication date"];
    if (genericDateAdvice.test(item) || noNarrowing.test(item)) return [];
    const recent = relativePublication(item);
    if (recent && !historical) return [recent];
    // Explicit subject-history choices remain subject scope. A publication
    // question's typed dates are explicitly labeled for the date parser.
    return [`${publication && !historical ? "Publication date" : "Study period"}: ${item}`];
  });
}

function narrowingLines(value) {
  const values = parts(value);
  const kinds = [...new Set(values.map(item => genericKinds.get(key(item))).filter(Boolean))];
  const detail = values.filter(item => !genericKinds.has(key(item)) && !noNarrowing.test(item));
  if (!detail.length) return [];
  const label = kinds.length === 1 ? kinds[0] : "Research scope";
  return [`${label}: ${detail.join("; ")}`];
}

/** Normalize legacy and current guided-planner answers without inventing scope. */
export function normalizePlannerContext(value) {
  if (typeof value !== "string") return "";
  const lines = value.slice(0, 6000).split(/\r?\n/).map(clean).filter(Boolean);
  const result = lines.flatMap(line => {
    const colon = line.indexOf(":");
    const label = colon < 0 ? "" : key(line.slice(0, colon));
    const answer = colon < 0 ? line : clean(line.slice(colon + 1));
    if (!answer) return [];
    if (legacyDateQuestion.test(label) || publicationQuestion.test(label)) return dateLines(answer, publicationQuestion.test(label));
    if (sourceQuestion.test(label)) return [`Source type: ${answer}`];
    if (narrowingQuestion.test(label)) return narrowingLines(answer);
    if (/^(?:population|geography|comparison|research scope|study period|historical period|period studied)$/.test(label)) {
      if (genericKinds.has(key(answer)) || noNarrowing.test(answer) || genericDateAdvice.test(answer)) return [];
      // A date written as explicit study scope is never reclassified as a
      // publication filter, including a relative period such as last 5 years.
      const canonical = { population: "Population", geography: "Geography", comparison: "Comparison", "research scope": "Research scope", "study period": "Study period", "historical period": "Study period", "period studied": "Study period" }[label];
      return [`${canonical}: ${answer}`];
    }
    if (genericDateAdvice.test(answer) || noNarrowing.test(answer) || genericKinds.has(key(answer))) return [];
    const recent = colon < 0 ? relativePublication(answer) : "";
    if (recent) return [recent];
    if (colon < 0 && anyPublication(answer)) return ["Any publication date"];
    return [line];
  });
  return [...new Set(result)].join("\n");
}
