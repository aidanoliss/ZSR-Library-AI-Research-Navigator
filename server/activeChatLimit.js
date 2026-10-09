/** Bound simultaneous provider work on the single-instance prototype. */
const activeByClient = new Map();
let activeTotal = 0;

function limitFromEnv(name, fallback, maximum) {
  const parsed = Number.parseInt(String(process.env[name] ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function activeChatPolicy() {
  return {
    global: limitFromEnv("MAX_ACTIVE_CHAT_GLOBAL", 8, 100),
    perClient: limitFromEnv("MAX_ACTIVE_CHAT_PER_CLIENT", 2, 20),
  };
}

export function acquireChatSlot(client) {
  const key = String(client || "unknown");
  const policy = activeChatPolicy();
  if (activeTotal >= policy.global || (activeByClient.get(key) || 0) >= policy.perClient) return null;
  activeTotal += 1;
  activeByClient.set(key, (activeByClient.get(key) || 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeTotal -= 1;
    const remaining = (activeByClient.get(key) || 1) - 1;
    if (remaining) activeByClient.set(key, remaining);
    else activeByClient.delete(key);
  };
}

export function activeChatStatus() {
  return { activeTotal, activeClients: activeByClient.size, ...activeChatPolicy() };
}
