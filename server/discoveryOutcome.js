export function reportDiscoveryOutcome(options, provider, status, details = {}) {
  options?.onOutcome?.({ provider, status, ...(options?.discoveryQuery ? { query: options.discoveryQuery } : {}), ...details });
}

/** Counts describe this response page, not all records in the provider's index. */
export function discoveryResponseDetails(retrievedCount, resultCount) {
  return {
    retrievedCount,
    resultCount,
    ...(resultCount === 0 ? { emptyReason: retrievedCount > 0 ? "no_eligible_records" : "no_records" } : {}),
  };
}

export function reportDiscoveryHttpError(options, provider, status) {
  reportDiscoveryOutcome(options, provider, status === 429 ? "rate_limited" : "error", { errorCode: `HTTP_${status}` });
}

export function reportDiscoveryError(options, provider, error, timedOut = false) {
  const status = options?.signal?.aborted ? "cancelled" : timedOut || error?.name === "TimeoutError" ? "timeout" : "error";
  reportDiscoveryOutcome(options, provider, status, { errorCode: status === "error" ? "PROVIDER_ERROR" : status.toUpperCase() });
}

export function discoveryAbort(options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  return {
    signal: controller.signal,
    get timedOut() { return timedOut; },
    cleanup() { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); },
  };
}
