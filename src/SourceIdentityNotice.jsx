import { normalizeIdentityCheck } from "./researchWorkspace.js";

/** Keep a known discrepancy visible when a student moves from discovery to citation. */
export default function SourceIdentityNotice({ source, imported = false }) {
  const check = normalizeIdentityCheck(source?.identityCheck, { imported });
  if (!check) return null;
  const status = check.observedStatus || check.status;
  if (status === "title-matched" && !check.historical) return null;
  return <div className="source-identity-notice">
    <strong>{status === "title-difference" ? "Citation details need checking" : "Citation identity not verified"}</strong>
    <p>{status === "title-difference" ? "The provider title differs from the DOI registry title. Check the original before citing." : "The DOI registry check did not establish a current title match."}</p>
    {check.historical && <p><strong>Imported historical check.</strong> Recheck the original record; this is not current verification.</p>}
    {check.registryTitle && <p>Registry title: {check.registryTitle}</p>}
    {(check.provider || check.checkedAt) && <p>{[check.provider, check.checkedAt && `Checked ${check.checkedAt}`].filter(Boolean).join(" · ")}</p>}
    {check.url && <a href={check.url} target="_blank" rel="noopener noreferrer">Open registry record</a>}
  </div>;
}
