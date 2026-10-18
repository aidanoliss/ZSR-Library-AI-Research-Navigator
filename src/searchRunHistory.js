/** Record observed execution, never turn a suggested query into an executed query. */
export function searchRunSnapshot({ id, originalRequest, startedAt, payload = {}, researchSpec, searchConfig, status, completedAt = Date.now() }) {
  const providers = [];
  const queries = [];
  for (const [lane, value] of Object.entries(payload.sourceDiscovery?.lanes || {})) {
    if (!value?.requested) continue;
    const attempts = value.attempts?.length ? value.attempts : [{ provider: value.provider || lane, status: value.outcome || value.status, resultCount: value.resultCount }];
    for (const attempt of attempts) {
      providers.push({ id: attempt.provider || lane, lane, status: attempt.status || "unknown", count: attempt.resultCount ?? null, query: attempt.query || "" });
      if (attempt.query) queries.push({ query: attempt.query, provider: attempt.provider || lane, dialect: attempt.dialect || "" });
    }
  }
  const spec = payload.researchSpec || payload.researchPlan?.researchSpec || researchSpec || {};
  return {
    id, originalRequest, query: originalRequest, researchSpec: spec, searchConfig, providers, queries,
    resultCount: (payload.liveResults || []).length,
    releaseId: payload.releaseId || "", configVersion: payload.researchPlan?.configVersion || spec.configVersion || "",
    startedAt: typeof startedAt === "string" ? Date.parse(startedAt) : startedAt,
    completedAt, runStatus: status || "unknown", resultNote: `Run outcome: ${status || "unknown"}. Counts describe returned records, not verified relevant studies.${queries.length ? "" : " Executed query text was not supplied by the service."}`,
  };
}
