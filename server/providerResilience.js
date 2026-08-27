function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

export class ProviderError extends Error {
  constructor(message, { code = "PROVIDER_ERROR", status = 0, retryable = false, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function isRetryableProviderStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

export function createCircuitBreaker({
  failureThreshold = boundedInteger(process.env.GEMINI_CIRCUIT_FAILURES, 4, 1, 20),
  cooldownMs = boundedInteger(process.env.GEMINI_CIRCUIT_COOLDOWN_MS, 30_000, 1_000, 10 * 60_000),
  now = () => Date.now(),
} = {}) {
  let failures = 0;
  let openedAt = 0;
  let probeActive = false;

  return {
    acquire() {
      if (!openedAt) return;
      if (now() - openedAt < cooldownMs || probeActive) {
        throw new ProviderError("AI generation is temporarily unavailable. Please try again shortly.", {
          code: "PROVIDER_CIRCUIT_OPEN",
          status: 503,
          retryable: true,
        });
      }
      probeActive = true;
    },
    success() {
      failures = 0;
      openedAt = 0;
      probeActive = false;
    },
    failure() {
      probeActive = false;
      failures += 1;
      if (failures >= failureThreshold) openedAt = now();
    },
    cancelProbe() {
      probeActive = false;
    },
    snapshot() {
      const coolingDown = Boolean(openedAt) && now() - openedAt < cooldownMs;
      return {
        state: openedAt ? (coolingDown || probeActive ? "open" : "half-open") : "closed",
        failures,
        retryAfterMs: coolingDown ? Math.max(0, cooldownMs - (now() - openedAt)) : 0,
      };
    },
  };
}

function abortError(signal) {
  return new ProviderError("AI request was cancelled.", {
    code: "PROVIDER_ABORTED",
    retryable: false,
    cause: signal?.reason instanceof Error ? signal.reason : undefined,
  });
}

function normalizeProviderError(error, timedOut, externallyAborted) {
  if (externallyAborted) {
    return new ProviderError("AI request was cancelled.", {
      code: "PROVIDER_ABORTED",
      retryable: false,
      cause: error,
    });
  }
  if (error instanceof ProviderError) return error;
  if (timedOut || error?.name === "TimeoutError") {
    return new ProviderError("AI generation timed out. Please try again.", {
      code: "PROVIDER_TIMEOUT",
      status: 504,
      retryable: true,
      cause: error,
    });
  }
  if (error?.name === "AbortError") {
    return new ProviderError("AI request was cancelled.", {
      code: "PROVIDER_ABORTED",
      retryable: false,
      cause: error,
    });
  }
  if (error?.retryable === false) {
    return new ProviderError("AI provider stream was interrupted.", {
      code: error.code || "PROVIDER_STREAM_INTERRUPTED",
      status: error.status || 502,
      retryable: false,
      cause: error,
    });
  }
  return new ProviderError("AI provider could not be reached. Please try again.", {
    code: "PROVIDER_NETWORK_ERROR",
    status: 502,
    retryable: true,
    cause: error,
  });
}

function wait(ms, signal, sleep) {
  if (sleep) return sleep(ms, signal);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal));
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Execute one complete provider operation (including body consumption) with a
 * bounded timeout, retry policy, jitter, and process-local circuit breaker.
 */
export async function runProviderOperation(operation, {
  signal,
  timeoutMs = boundedInteger(process.env.GEMINI_TIMEOUT_MS, 20_000, 1_000, 120_000),
  retries = boundedInteger(process.env.GEMINI_MAX_RETRIES, 2, 0, 3),
  baseDelayMs = boundedInteger(process.env.GEMINI_RETRY_BASE_MS, 250, 10, 5_000),
  random = Math.random,
  sleep,
  circuit,
} = {}) {
  circuit?.acquire();
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal?.aborted) {
      circuit?.cancelProbe();
      throw abortError(signal);
    }

    const controller = new AbortController();
    let timedOut = false;
    const onExternalAbort = () => controller.abort(signal.reason);
    signal?.addEventListener("abort", onExternalAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException("Provider timeout", "TimeoutError"));
    }, timeoutMs);

    try {
      const result = await operation({ signal: controller.signal, attempt });
      clearTimeout(timer);
      signal?.removeEventListener("abort", onExternalAbort);
      circuit?.success();
      return result;
    } catch (error) {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onExternalAbort);
      lastError = normalizeProviderError(error, timedOut, Boolean(signal?.aborted));
      if (signal?.aborted || !lastError.retryable || attempt >= retries) break;

      const exponential = baseDelayMs * (2 ** attempt);
      const jitter = Math.floor(exponential * 0.25 * Math.max(0, Math.min(1, random())));
      try {
        await wait(exponential + jitter, signal, sleep);
      } catch (error) {
        circuit?.cancelProbe();
        throw normalizeProviderError(error, false, Boolean(signal?.aborted));
      }
    }
  }

  if (lastError?.retryable) circuit?.failure();
  else circuit?.cancelProbe();
  throw lastError;
}

export function providerHttpError(status) {
  const retryable = isRetryableProviderStatus(status);
  return new ProviderError(
    retryable
      ? "AI generation is temporarily unavailable. Please try again."
      : "AI provider rejected the request.",
    {
      code: "GEMINI_ERROR",
      status,
      retryable,
    }
  );
}
