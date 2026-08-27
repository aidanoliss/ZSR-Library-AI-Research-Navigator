export const ACCESS_SCOPES = [
  {
    id: "library",
    label: "Library resources",
    shortLabel: "Library",
    description: "Search ZSR discovery first, with bibliographic metadata fallback when appropriate.",
  },
  {
    id: "both",
    label: "Library + open access",
    shortLabel: "Library + OA",
    description: "Keep library results and add a separate OpenAlex open-access results lane.",
  },
  {
    id: "open-access",
    label: "Open access",
    shortLabel: "Open access",
    description: "Search the OpenAlex open-access lane without implying Wake Forest access.",
  },
];

export const DEFAULT_ACCESS_SCOPE_ID = "library";

export function getAccessScope(scopeId) {
  return ACCESS_SCOPES.find((scope) => scope.id === scopeId)
    || ACCESS_SCOPES.find((scope) => scope.id === DEFAULT_ACCESS_SCOPE_ID);
}

export function includesLibraryResults(scopeId) {
  return getAccessScope(scopeId).id !== "open-access";
}

export function includesOpenAccessResults(scopeId) {
  return getAccessScope(scopeId).id !== "library";
}
