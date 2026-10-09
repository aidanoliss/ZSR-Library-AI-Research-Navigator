const unreadableKeys = new Set();

function storageFor(storage) {
  return storage || globalThis.localStorage;
}

export function readStoredText(key, fallback = "", storage) {
  try {
    return storageFor(storage)?.getItem(key) ?? fallback;
  } catch {
    unreadableKeys.add(key);
    return fallback;
  }
}

export function readStoredJSON(key, fallback, storage, validate = () => true) {
  try {
    const raw = storageFor(storage)?.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    if (!validate(parsed)) throw new Error("Stored research has an unexpected format");
    return parsed;
  } catch {
    unreadableKeys.add(key);
    return fallback;
  }
}

export function storageReadFailed() {
  return unreadableKeys.size > 0;
}

// A failed read must not immediately overwrite potentially recoverable data.
export function writeStoredText(key, value, storage) {
  if (unreadableKeys.has(key)) return false;
  try {
    storageFor(storage).setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStoredValue(key, storage) {
  try {
    storageFor(storage).removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function allowStorageRetry() {
  unreadableKeys.clear();
}
