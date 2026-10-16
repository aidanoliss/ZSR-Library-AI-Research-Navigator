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

/** Bound headers AND body consumption, even if a transport ignores AbortSignal.
 * Retry once inside the same budget; cancellation and permanent HTTP errors never retry.
 */
export async function fetchDiscoveryJson(url, init = {}, options = {}) {
  const budget = Math.max(1, options.timeoutMs || 6000);
  const deadline = Date.now() + budget;
  const retries = options.retries === 0 ? 0 : 1;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const remaining = deadline - Date.now();
    if (options.signal?.aborted) throw options.signal.reason || new DOMException("Cancelled", "AbortError");
    if (remaining <= 0) throw new DOMException("Discovery deadline exceeded", "TimeoutError");
    const duration = attempt < retries ? Math.max(1, Math.floor(remaining * 0.58)) : remaining;
    const operation = discoveryAbort(options, duration);
    let onAbort;
    try {
      const aborted = new Promise((_, reject) => {
        onAbort = () => reject(options.signal?.aborted
          ? options.signal.reason || new DOMException("Cancelled", "AbortError")
          : new DOMException("Discovery deadline exceeded", "TimeoutError"));
        if (operation.signal.aborted) onAbort();
        else operation.signal.addEventListener("abort", onAbort, { once: true });
      });
      const pending = (async () => {
        const response = await (options.fetchImpl || fetch)(url, { ...init, signal: operation.signal });
        return { response, data: response.ok ? await response.json() : null };
      })();
      const result = await Promise.race([pending, aborted]);
      const retryableHttp = result.response.status === 429 || result.response.status >= 500 && result.response.status <= 599;
      if (!retryableHttp || attempt === retries) return result;
      if (result.response.status === 429 && !result.response.headers?.get?.("retry-after")) return result;
      // Respect Retry-After; do not retry early if it exceeds our remaining budget.
      const retryAfter = result.response.headers?.get?.("retry-after");
      const delay = retryAfter ? /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now()) : 100;
      if (!Number.isFinite(delay) || delay + 50 >= deadline - Date.now()) return result;
      options.onRetry?.({ attempt: attempt + 1, reason: `HTTP_${result.response.status}` });
      await discoveryDelay(delay, options.signal);
    } catch (error) {
      if (options.signal?.aborted || attempt === retries || error instanceof SyntaxError) throw error;
      if (deadline - Date.now() < 50) throw error;
      options.onRetry?.({ attempt: attempt + 1, reason: error?.name === "TimeoutError" ? "TIMEOUT" : "NETWORK_ERROR" });
      await discoveryDelay(Math.min(100, Math.floor((deadline - Date.now()) / 4)), options.signal);
    } finally {
      operation.signal.removeEventListener("abort", onAbort);
      operation.cleanup();
    }
  }
}

function discoveryDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); reject(signal.reason || new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
  });
}
