export const EVIDENCE_ENTRY_LIMIT = 12;
export const EVIDENCE_FIELD_LIMITS = Object.freeze({ claim: 2000, passage: 4000, location: 300, limitations: 2000 });

function text(value, limit) {
  return typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, limit) : "";
}

export function canConfirmEvidence(entry) {
  return [entry?.claim, entry?.passage, entry?.location].every((value) => typeof value === "string" && value.trim());
}

/** Student attestation only. No entry is independently validated by Navigator. */
export function normalizeEvidenceEntries(value, { imported = false } = {}) {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set();
  return value.slice(0, EVIDENCE_ENTRY_LIMIT).filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)).map((entry, index) => {
    const normalized = Object.fromEntries(Object.entries(EVIDENCE_FIELD_LIMITS).map(([key, limit]) => [key, text(entry[key], limit)]));
    const baseId = text(entry.id, 160) || `evidence-${index}`;
    let id = baseId;
    let suffix = 0;
    while (usedIds.has(id)) id = `${baseId.slice(0, 140)}-${index}-${++suffix}`;
    usedIds.add(id);
    const checkedAt = Number(entry.checkedAt);
    const checkedByStudent = !imported && entry.checkedByStudent === true && canConfirmEvidence(normalized)
      && Number.isFinite(checkedAt) && checkedAt > 0 && checkedAt <= 8640000000000000;
    return { id, ...normalized, checkedByStudent, checkedAt: checkedByStudent ? checkedAt : null,
      imported: imported || entry.imported === true };
  });
}

export function addEvidenceEntry(entries, now = Date.now()) {
  const current = normalizeEvidenceEntries(entries);
  if (current.length >= EVIDENCE_ENTRY_LIMIT) return current;
  return normalizeEvidenceEntries([...current, { id: `evidence-${now}-${current.length}` }]);
}

/** Editing any evidence field invalidates its previous student confirmation. */
export function updateEvidenceEntry(entries, id, patch, now = Date.now()) {
  return normalizeEvidenceEntries(entries).map((entry) => {
    if (entry.id !== id) return entry;
    const next = { ...entry };
    let changed = false;
    for (const [key, limit] of Object.entries(EVIDENCE_FIELD_LIMITS)) {
      if (patch[key] === undefined) continue;
      next[key] = text(patch[key], limit);
      changed ||= next[key] !== entry[key];
    }
    if (changed) { next.checkedByStudent = false; next.checkedAt = null; }
    // Do not accept simultaneous content edits and a confirmation claim.
    if (!changed && typeof patch.checkedByStudent === "boolean") {
      next.checkedByStudent = patch.checkedByStudent && canConfirmEvidence(next);
      next.checkedAt = next.checkedByStudent ? now : null;
    }
    return normalizeEvidenceEntries([next])[0];
  });
}

export function evidenceEntryNotes(value) {
  return normalizeEvidenceEntries(value).flatMap((entry, index) => {
    const lines = [`Evidence note ${index + 1}: student-authored; Navigator has not verified the claim or quotation.`];
    for (const [key, label] of [["claim", "Claim"], ["passage", "Recorded passage"], ["location", "Page / section"], ["limitations", "Limitations / conflicting evidence"]]) {
      if (entry[key]) lines.push(`${label}: ${entry[key]}`);
    }
    lines.push(entry.checkedByStudent ? `Student marked the passage and its context checked on ${new Date(entry.checkedAt).toISOString()}; this is not independent verification.`
      : "Needs student check against the original source.");
    if (entry.imported && !entry.checkedByStudent) lines.push("Imported evidence note: any previous confirmation was cleared. Recheck the original source.");
    return lines;
  });
}
