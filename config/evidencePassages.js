// Shared by the server and saved-result UI: provenance is necessary, but does
// not establish that a selected passage answers a research question.
export function evidenceSentences(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)]
    .map(({ segment, index }) => ({ text: segment.trim(), start: index, end: index + segment.trimEnd().length }))
    .filter((sentence) => sentence.text);
}

export function completeEvidenceExcerpt(value, limit, truncated = false) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit && !truncated) return text;
  const sentences = evidenceSentences(text).filter((sentence) => sentence.end <= limit && /[.!?]["'”’)]*$/.test(sentence.text));
  return sentences.length ? text.slice(0, sentences.at(-1).end) : "";
}

export function evidencePassageContext(value, quote) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const selected = String(quote || "").replace(/\s+/g, " ").trim();
  if (!selected) return null;
  const sentences = evidenceSentences(text);
  // Consider every occurrence; only accept complete consecutive sentences.
  for (let first = 0; first < sentences.length; first += 1) {
    const start = sentences[first].start;
    if (!text.startsWith(selected, start)) continue;
    const last = sentences.findIndex((sentence, index) => index >= first && sentence.end === start + selected.length);
    if (last < first) continue;
    return text.slice(sentences[Math.max(0, first - 1)].start, sentences[Math.min(sentences.length - 1, last + 1)].end);
  }
  return null;
}
