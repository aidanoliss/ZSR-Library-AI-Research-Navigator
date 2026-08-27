import assert from "node:assert/strict";
import test from "node:test";

import {
  DUKE_ILLUSTRATIVE_PROFILE,
  INSTITUTION_PROFILE_SCHEMA_VERSION,
  WFU_INSTITUTION_PROFILE,
  getInstitutionProfile,
  validateInstitutionProfile,
} from "../config/institutionProfile.js";

test("WFU prototype profile is structurally valid and privacy-conservative", () => {
  const result = validateInstitutionProfile(WFU_INSTITUTION_PROFILE);
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.equal(WFU_INSTITUTION_PROFILE.schemaVersion, INSTITUTION_PROFILE_SCHEMA_VERSION);
  assert.equal(WFU_INSTITUTION_PROFILE.approval.approvedForInstitutionalUse, false);
  assert.equal(WFU_INSTITUTION_PROFILE.privacy.authentication, "none");
  assert.equal(WFU_INSTITUTION_PROFILE.privacy.workspaceStorage, "browser-localStorage");
  assert.equal(WFU_INSTITUTION_PROFILE.privacy.queryLoggingDefault, false);
  assert.equal(WFU_INSTITUTION_PROFILE.privacy.queryTextStorageDefault, false);
  assert.equal(WFU_INSTITUTION_PROFILE.privacy.feedbackTextStorageDefault, false);
  assert.equal(WFU_INSTITUTION_PROFILE.privacy.handoffDetailStorageDefault, false);
  assert.equal(WFU_INSTITUTION_PROFILE.privacy.handoffContactRetentionDefault, false);
  assert.equal(WFU_INSTITUTION_PROFILE.privacy.handoffContactRetentionEnv, "HANDOFF_STORE_CONTACT");
  assert.equal(WFU_INSTITUTION_PROFILE.discovery.officialApi.configured, false);
  assert.match(WFU_INSTITUTION_PROFILE.resourceRegistry.pointer, /ZSR_RESOURCE_CONFIG/);
  assert.equal(Object.isFrozen(WFU_INSTITUTION_PROFILE.discovery), true);
  assert.equal(Object.isFrozen(WFU_INSTITUTION_PROFILE.privacy), true);
});

test("Duke profile remains an explicit unapproved blank integration template", () => {
  const result = validateInstitutionProfile(DUKE_ILLUSTRATIVE_PROFILE);
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.equal(DUKE_ILLUSTRATIVE_PROFILE.approval.status, "unapproved-template");
  assert.equal(DUKE_ILLUSTRATIVE_PROFILE.approval.approvedForInstitutionalUse, false);
  assert.equal(DUKE_ILLUSTRATIVE_PROFILE.discovery.host, null);
  assert.equal(DUKE_ILLUSTRATIVE_PROFILE.discovery.institutionCode, null);
  assert.equal(DUKE_ILLUSTRATIVE_PROFILE.discovery.officialApi.endpointEnv, null);
  assert.equal(DUKE_ILLUSTRATIVE_PROFILE.discovery.officialApi.keyEnv, null);
  assert.equal(DUKE_ILLUSTRATIVE_PROFILE.resourceRegistry.pointer, null);
  assert.equal(DUKE_ILLUSTRATIVE_PROFILE.helpRoutes.generalEmail, null);
  assert.equal(DUKE_ILLUSTRATIVE_PROFILE.branding.logoUrl, null);
  assert.ok(result.warnings.some((warning) => /not approved/i.test(warning)));

  const serialized = JSON.stringify(DUKE_ILLUSTRATIVE_PROFILE);
  assert.doesNotMatch(serialized, /https?:\/\//i);
  assert.doesNotMatch(serialized, /@duke\.edu/i);
  assert.doesNotMatch(serialized, /(?:api[_-]?key|token|secret)["']?\s*:\s*["'][^"']{8,}/i);
});

test("approval gate rejects both prototype profiles until an institution approves one", () => {
  assert.equal(
    validateInstitutionProfile(WFU_INSTITUTION_PROFILE, { requireApproved: true }).valid,
    false
  );
  assert.equal(
    validateInstitutionProfile(DUKE_ILLUSTRATIVE_PROFILE, { requireApproved: true }).valid,
    false
  );
  assert.equal(getInstitutionProfile("wfu-zsr-prototype"), WFU_INSTITUTION_PROFILE);
  assert.equal(getInstitutionProfile("unknown"), null);
});
