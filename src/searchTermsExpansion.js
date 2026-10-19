import { mergeSuppliedResearchSpec } from "../config/researchSpec.js";

/** Add the suggested alternatives to the brief's own concepts for one wider search. */
export function expandedSpec(spec, data) {
  const concepts = (spec?.concepts || []).map((concept) => {
    const group = data?.concepts?.find((item) => item.conceptId === concept.id || item.term === concept.preferredTerm);
    const synonyms = [...new Set([...(concept.synonyms || []), ...(group?.synonyms || [])])].slice(0, 5);
    return { ...concept, synonyms };
  });
  return mergeSuppliedResearchSpec(spec, { ...spec, concepts, searchExpansion: "full-synonyms" });
}
