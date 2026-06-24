/**
 * Enforces the project's hardest rule IN CODE, not just via the prompt:
 * the app may only ever surface links that exist in the curated resources file.
 *
 * The model could, despite instructions, hallucinate a URL or a database name.
 * This pass inspects the clickable link surface (the recommended starting_points)
 * and:
 *   - keeps a link whose URL exactly matches a curated resource,
 *   - CORRECTS a link to the canonical curated URL if the model named a real
 *     resource but got the URL slightly wrong,
 *   - DROPS a link that matches no curated resource at all (an invention).
 *
 * Returns the cleaned reply plus a small report so the caller can log drops.
 */

/** Normalize a URL for forgiving comparison (trailing slash, case, protocol). */
function normalizeUrl(url) {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

export function validateReply(reply, resources) {
  const report = { dropped: [], corrected: [] };
  if (!reply || !Array.isArray(reply.starting_points)) {
    return { reply, report };
  }

  const byUrl = new Map();
  const byName = new Map();
  for (const r of resources) {
    byUrl.set(normalizeUrl(r.url), r);
    byName.set(normalizeName(r.name), r);
  }

  const cleaned = [];
  for (const sp of reply.starting_points) {
    const urlMatch = byUrl.get(normalizeUrl(sp.url));
    if (urlMatch) {
      cleaned.push(sp);
      continue;
    }

    const nameMatch = byName.get(normalizeName(sp.resource_name));
    if (nameMatch) {
      // Real resource, wrong/invented URL → snap to the canonical curated URL.
      report.corrected.push({ name: sp.resource_name, from: sp.url, to: nameMatch.url });
      cleaned.push({ ...sp, url: nameMatch.url });
      continue;
    }

    // Matches nothing curated → drop it entirely.
    report.dropped.push({ name: sp.resource_name, url: sp.url });
  }

  return { reply: { ...reply, starting_points: cleaned }, report };
}
