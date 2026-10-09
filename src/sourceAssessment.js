import { SOURCE_KINDS, SOURCE_MODE_CONTRACTS } from "../config/resourceCapabilities.js";
import { sourceFormatDetailCheck, sourceMethodEvidence, sourcePopulationCheck, sourcePeriodCheck } from "./sourceMetadataChecks.js";

/** Metadata checks only: neither an article type nor a DOI proves peer review. */
export function sourcePublicationYear(source = {}) {
  const value = source.publicationYear ?? source.citation?.year ?? source.citationMetadata?.year
    ?? source.publicationDate ?? source.date ?? source.year;
  const match = String(value ?? "").match(/\b(1[0-9]{3}|2[01][0-9]{2})\b/);
  return match ? Number(match[1]) : null;
}

export function sourcePeerReviewStatus(source = {}) {
  const explicit = source.peerReviewed ?? source.quality?.peerReviewed ?? source.provenance?.peerReviewed;
  return explicit === true ? "meets" : explicit === false ? "mismatch" : "unverified";
}

export function sourceKindFromMetadata(source = {}) {
  if (Object.values(SOURCE_KINDS).includes(source.sourceKind)) return source.sourceKind;
  const type = String(source.type || source.citationMetadata?.type || source.citation?.type || "").toLowerCase().replace(/_/g, "-");
  if (/book[- ]chapter|book section/.test(type)) return SOURCE_KINDS.BOOK_CHAPTER;
  if (/^book$|monograph|ebook/.test(type)) return SOURCE_KINDS.BOOK;
  if (/dataset/.test(type)) return SOURCE_KINDS.DATASET;
  if (/newspaper|news article/.test(type)) return SOURCE_KINDS.NEWS;
  if (/journal[- ]article|^article$/.test(type)) return SOURCE_KINDS.SCHOLARLY_ARTICLE;
  return "";
}

export function assessSourceRequirements(source = {}, specOrRequirements = {}) {
  const requirements = specOrRequirements.sourceRequirements || specOrRequirements;
  const contract = specOrRequirements.sourceContract || SOURCE_MODE_CONTRACTS[specOrRequirements.mode || specOrRequirements.modeId];
  const checks = [];
  if (contract?.allowedKinds?.length) {
    const kind = sourceKindFromMetadata(source);
    const status = !kind ? "unverified" : contract.allowedKinds.includes(kind) ? "meets" : "mismatch";
    checks.push({ id: "source-type", label: "Source format", status, detail: !kind ? "Source format is not established by the metadata." : status === "meets" ? `Metadata format: ${kind === SOURCE_KINDS.SCHOLARLY_ARTICLE ? "article" : kind}. Format alone does not establish research method, quality, or peer review.` : `Metadata format ${kind} does not match ${contract.label || "the requested source mode"}.` });
    const roleCheck = sourceFormatDetailCheck(source, contract);
    if (roleCheck) checks.push(roleCheck);
  }
  const from = Number.isInteger(requirements.publicationYearFrom) ? requirements.publicationYearFrom : null;
  const to = Number.isInteger(requirements.publicationYearTo) ? requirements.publicationYearTo : null;
  if (from !== null || to !== null) {
    const year = sourcePublicationYear(source);
    const status = year === null ? "unverified" : (from !== null && year < from) || (to !== null && year > to) ? "mismatch" : "meets";
    checks.push({ id: "publication-date", label: "Publication date", status, detail: year === null ? "Publication year is missing; check the record." : `Published ${year}; required ${from ?? "any year"}–${to ?? "present"}.` });
  }
  if (requirements.peerReviewed === true) {
    const status = sourcePeerReviewStatus(source);
    checks.push({ id: "peer-review", label: "Peer review", status, detail: status === "meets" ? "The provider explicitly reports peer review." : status === "mismatch" ? "The provider reports this source is not peer reviewed." : "Peer review is not established by the metadata; verify it with the journal or database." });
  }
  const methods = specOrRequirements.methodRequirements || {};
  for (const [direction, requested] of [["include", methods.include], ["exclude", methods.exclude]]) {
    for (const method of Array.isArray(requested) ? requested : []) {
      const evidence = sourceMethodEvidence(source, method);
      // Missing metadata never proves absence of an excluded method. Even a
      // conflicting method can coexist in a mixed design, so only positive
      // identification of the excluded method is a hard exclusion.
      const status = direction === "exclude" ? evidence.status === "meets" ? "mismatch" : "unverified" : evidence.status;
      checks.push({ id: `method-${direction}-${method}`, label: `${direction === "exclude" ? "Exclude" : "Requested method"}: ${method}`, status,
        detail: direction === "exclude" && evidence.status !== "meets" ? `The metadata does not establish whether this uses the excluded method (${method}). Check the source's methods; absence of a keyword is not proof.` : evidence.detail });
    }
  }
  if (!specOrRequirements.knownItem) {
    const population = sourcePopulationCheck(source, specOrRequirements.facets?.population);
    const period = sourcePeriodCheck(source, specOrRequirements.facets?.timePeriod, sourcePublicationYear(source));
    if (population) checks.push(population);
    if (period) checks.push(period);
  }
  const status = checks.some((check) => check.status === "mismatch") ? "mismatch" : checks.some((check) => check.status === "unverified") ? "unverified" : "meets";
  return { status, checks, issues: checks.filter((check) => check.status !== "meets").map((check) => check.detail) };
}
