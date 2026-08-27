const REQUIRED_FIELDS = [
  "id",
  "name",
  "description",
  "subjectArea",
  "bestFor",
  "notBestFor",
  "accessUrl",
  "tags",
  "notes",
  "maintenanceOwner",
  "reviewStatus",
  "metadataSource",
  "configReviewedOn",
];

const GENERIC_RESOURCE_IDS = new Set([
  "databases-az",
  "ask-a-librarian",
  "primo",
  "research-guides",
  "business-guide",
]);

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function issue(level, resource, message) {
  return {
    level,
    resourceId: resource?.id || "(unknown)",
    message,
  };
}

export function auditResourceConfig(resources = []) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const names = new Set();

  for (const resource of resources) {
    for (const field of REQUIRED_FIELDS) {
      const value = resource?.[field];
      const missing = Array.isArray(value) ? value.length === 0 : !String(value ?? "").trim();
      if (missing) errors.push(issue("error", resource, `Missing required field: ${field}`));
    }

    if (ids.has(resource.id)) errors.push(issue("error", resource, "Duplicate resource id."));
    if (names.has(resource.name)) errors.push(issue("error", resource, "Duplicate resource name."));
    ids.add(resource.id);
    names.add(resource.name);

    let parsedUrl = null;
    try {
      parsedUrl = new URL(resource.accessUrl);
      if (parsedUrl.protocol !== "https:") {
        errors.push(issue("error", resource, "Access URL must use HTTPS."));
      }
    } catch {
      errors.push(issue("error", resource, "Access URL is not a valid absolute URL."));
    }

    if (
      parsedUrl?.hostname === "guides.zsr.wfu.edu" &&
      parsedUrl.pathname.endsWith("/az.php") &&
      !GENERIC_RESOURCE_IDS.has(resource.id) &&
      !parsedUrl.searchParams.get("q")
    ) {
      errors.push(issue("error", resource, "Named database A-Z links must include a database query."));
    }

    if (!validDate(resource.configReviewedOn)) {
      errors.push(issue("error", resource, "configReviewedOn must use YYYY-MM-DD."));
    }
    if (resource.librarianReviewedOn && !validDate(resource.librarianReviewedOn)) {
      errors.push(issue("error", resource, "librarianReviewedOn must be null or YYYY-MM-DD."));
    }
    if (resource.reviewStatus === "pending-zsr-review") {
      warnings.push(issue("warning", resource, "Librarian review is still pending."));
    }
    if (/^Unassigned\b/i.test(resource.maintenanceOwner)) {
      warnings.push(issue("warning", resource, "Maintenance owner has not been assigned."));
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      resources: resources.length,
      errors: errors.length,
      warnings: warnings.length,
      pendingLibrarianReview: resources.filter(
        (resource) => resource.reviewStatus === "pending-zsr-review"
      ).length,
      unassignedOwners: resources.filter((resource) =>
        /^Unassigned\b/i.test(resource.maintenanceOwner)
      ).length,
    },
  };
}

export async function checkResourceUrls(
  resources = [],
  { fetchImpl = globalThis.fetch, timeoutMs = 8000, concurrency = 4 } = {}
) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required for live URL checks.");
  }

  const queue = [...resources];
  const results = [];

  async function worker() {
    while (queue.length) {
      const resource = queue.shift();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      let error = "";
      try {
        response = await fetchImpl(resource.accessUrl, {
          method: "HEAD",
          redirect: "follow",
          signal: controller.signal,
        });
        if (response.status === 405 || response.status === 403) {
          response = await fetchImpl(resource.accessUrl, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: { Range: "bytes=0-0" },
          });
        }
      } catch (err) {
        error = err?.name === "AbortError" ? "Timed out" : String(err?.message || err);
      } finally {
        clearTimeout(timeout);
      }
      results.push({
        id: resource.id,
        name: resource.name,
        url: resource.accessUrl,
        ok: Boolean(response?.ok),
        status: response?.status || 0,
        finalUrl: response?.url || "",
        error,
      });
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, resources.length || 1)) },
    () => worker()
  );
  await Promise.all(workers);
  return results.sort((a, b) => a.id.localeCompare(b.id));
}
