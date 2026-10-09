export class ChatRequestError extends Error {
  constructor(message, { status = 0, retryable = false, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "ChatRequestError";
    this.status = status;
    this.retryable = retryable;
  }
}

function requestOptions(payload, signal) {
  return {
    signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

async function responseError(response) {
  const data = await response.json().catch(() => ({}));
  const message = data?.error || `The AI service returned an HTTP ${response.status} error.`;
  return new ChatRequestError(message, {
    status: response.status,
    retryable: response.status === 408 || response.status >= 500,
  });
}

function interruptedError(message, cause) {
  return new ChatRequestError(message, { retryable: true, cause });
}

function parseEvent(line) {
  try {
    const event = JSON.parse(line);
    if (!event || typeof event !== "object") throw new Error("Event is not an object.");
    return event;
  } catch (err) {
    throw interruptedError("The AI stream returned an unreadable response.", err);
  }
}

async function requestStream(payload, fetchImpl, onDelta, signal, onSources) {
  let response;
  try {
    response = await fetchImpl("/api/chat/stream", requestOptions(payload, signal));
  } catch (err) {
    throw interruptedError("The AI stream could not be reached.", err);
  }

  if (!response.ok) throw await responseError(response);
  if (!response.body) throw interruptedError("The AI stream opened without a response body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload = null;
  let sourcePayload = null;
  const sourceOnlyResult = () => ({ ...sourcePayload, type: "done", guidancePending: false, guidanceUnavailable: true,
    reply: { ...sourcePayload.reply, generation_unavailable: true } });

  const consumeLine = (line) => {
    if (!line.trim()) return;
    const event = parseEvent(line);
    if (event.type === "delta") onDelta?.(event.message || "");
    if (event.type === "done") finalPayload = event;
    if (event.type === "sources" && event.reply && Array.isArray(event.liveResults)) {
      sourcePayload = event;
      onSources?.(event);
    }
    if (event.type === "error") {
      throw interruptedError(event.error || "The AI stream stopped before completing.");
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(consumeLine);
    }
    buffer += decoder.decode();
    consumeLine(buffer);
  } catch (err) {
    if (sourcePayload && !signal?.aborted) return sourceOnlyResult();
    if (err instanceof ChatRequestError) throw err;
    throw interruptedError("The AI stream was interrupted.", err);
  }

  if (!finalPayload?.reply) {
    if (sourcePayload && !signal?.aborted) return sourceOnlyResult();
    throw interruptedError("The AI stream ended before the reply was complete.");
  }
  return finalPayload;
}

async function requestBuffered(payload, fetchImpl, signal) {
  let response;
  try {
    response = await fetchImpl("/api/chat", requestOptions(payload, signal));
  } catch (err) {
    throw interruptedError("The AI service could not be reached after an automatic retry.", err);
  }

  if (!response.ok) throw await responseError(response);
  const data = await response.json().catch((err) => {
    throw interruptedError("The AI service returned an unreadable response after retrying.", err);
  });
  if (!data?.reply) {
    throw interruptedError("The AI service returned an incomplete response after retrying.");
  }

  return { type: "done", ...data, recoveredFromStream: true };
}

export async function requestChatReply(payload, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new ChatRequestError("This browser cannot connect to the AI service.");
  }

  try {
    return await requestStream(payload, fetchImpl, options.onDelta, options.signal, options.onSources);
  } catch (err) {
    if (options.signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
    if (!(err instanceof ChatRequestError) || !err.retryable) throw err;
    options.onDelta?.("");
    return requestBuffered(payload, fetchImpl, options.signal);
  }
}

export function chatFailureMessage(error) {
  const status = Number(error?.status || 0);
  if ((status >= 400 && status < 500) || status === 503) {
    return String(error?.message || "The AI request could not be completed.");
  }
  return "The AI request was interrupted and did not recover after one automatic retry. The ZSR search terms below were generated locally.";
}
