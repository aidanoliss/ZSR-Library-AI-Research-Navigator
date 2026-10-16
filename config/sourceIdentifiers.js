/** Extract an identifier without stripping punctuation that belongs to its suffix. */
export function extractDoiIdentifier(value) {
  let text = String(value || "");
  // DOI resolver links commonly percent-encode parentheses and slashes.
  try { text = decodeURIComponent(text); } catch { /* Keep malformed escapes literal. */ }
  let doi = text.match(/10\.\d{4,9}\/[-+._;()/:a-z0-9]+/i)?.[0] || "";
  doi = doi.replace(/[.,;:]+$/, "");
  while (doi.endsWith(")") && (doi.match(/\)/g)?.length || 0) > (doi.match(/\(/g)?.length || 0)) {
    doi = doi.slice(0, -1).replace(/[.,;:]+$/, "");
  }
  // Never guess a missing closing character; only remove excess outer punctuation.
  return doi;
}
