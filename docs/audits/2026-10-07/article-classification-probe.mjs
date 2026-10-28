// Read-only, synthetic audit probe. No provider or AI calls are made.
// Run from the repository root:
// node docs/audits/2026-10-07/article-classification-probe.mjs
// Expected: all five records explicitly typed "article" remain eligible in
// scholarly mode; abstract vocabulary does not override document type.
import { normalizePrimoDocs } from "../../../server/primo.js";

const cases = [
  ["control", "We measured loneliness and treatment outcomes in adults.", "scholarly"],
  ["statistics", "Loneliness scores were statistically significant across groups.", "data"],
  ["interviews", "We used interviews to study loneliness among participants.", "primary"],
  ["regulation", "We assessed emotion regulation in loneliness among participants.", "legal-policy"],
  ["control-2", "We compared loneliness measures at baseline and follow-up.", "scholarly"],
];

const results = cases.map(([id, abstract, diagnosticMode]) => {
  const fixture = { docs: [{
    title: "Loneliness among adults",
    type: "article",
    abstract,
    date: "2024",
    url: `https://example.org/synthetic-${id}`,
  }] };
  const scholarly = normalizePrimoDocs(fixture, { query: "loneliness", modeId: "scholarly" });
  const diagnostic = normalizePrimoDocs(fixture, { query: "loneliness", modeId: diagnosticMode });
  return {
    id,
    synthetic: true,
    declaredType: "article",
    abstract,
    expectedScholarlyCount: 1,
    actualScholarlyCount: scholarly.length,
    detectedKind: diagnostic[0]?.sourceKind || null,
    passed: scholarly.length === 1,
  };
});

console.log(JSON.stringify({
  purpose: "Demonstrate abstract vocabulary overriding explicit article type; synthetic records only, not a real-world failure-rate estimate.",
  expectedRetained: cases.length,
  actualRetained: results.filter((result) => result.passed).length,
  results,
}, null, 2));
