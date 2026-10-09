export const ACCESS_SCOPES = [
  {
    id: "library",
    label: "Library resources",
    shortLabel: "Library",
    description: "Find library records and scholarly leads, then check access through ZSR.",
  },
  {
    id: "both",
    label: "Library + open access",
    shortLabel: "Library + OA",
    description: "Include library records and openly available source leads.",
  },
  {
    id: "open-access",
    label: "Open access",
    shortLabel: "Open access",
    description: "Find sources with a reported open-access location.",
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
