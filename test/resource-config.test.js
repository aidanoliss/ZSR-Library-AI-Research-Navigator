import assert from "node:assert/strict";
import test from "node:test";

import {
  RESOURCE_REVIEW_DEFAULTS,
  ZSR_RESOURCE_CONFIG,
} from "../config/researchAgent.js";
import {
  auditResourceConfig,
  checkResourceUrls,
} from "../lib/resourceAudit.js";

test("resource configuration passes structural and URL-shape checks", () => {
  const result = auditResourceConfig(ZSR_RESOURCE_CONFIG);

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.equal(result.summary.resources, ZSR_RESOURCE_CONFIG.length);
  assert.equal(result.summary.pendingLibrarianReview, ZSR_RESOURCE_CONFIG.length);
  assert.equal(result.summary.unassignedOwners, ZSR_RESOURCE_CONFIG.length);
});

test("resource metadata is explicit about pending librarian review", () => {
  assert.equal(RESOURCE_REVIEW_DEFAULTS.reviewStatus, "pending-zsr-review");
  assert.equal(RESOURCE_REVIEW_DEFAULTS.librarianReviewedOn, null);
  assert.ok(
    ZSR_RESOURCE_CONFIG.every(
      (resource) =>
        resource.metadataSource === "prototype-local-config" &&
        resource.reviewStatus === "pending-zsr-review"
    )
  );
});

test("audit rejects duplicate ids and generic A-Z links for named databases", () => {
  const sample = {
    ...ZSR_RESOURCE_CONFIG.find((resource) => resource.id === "psycinfo"),
    accessUrl: "https://guides.zsr.wfu.edu/az.php",
  };
  const result = auditResourceConfig([sample, sample]);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => /Duplicate resource id/.test(item.message)));
  assert.ok(result.errors.some((item) => /must include a database query/.test(item.message)));
});

test("live URL checker reports failures without turning them into approval", async () => {
  const [resource] = ZSR_RESOURCE_CONFIG;
  const results = await checkResourceUrls([resource], {
    fetchImpl: async () => {
      throw new Error("offline");
    },
    timeoutMs: 10,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].ok, false);
  assert.match(results[0].error, /offline/);
});
