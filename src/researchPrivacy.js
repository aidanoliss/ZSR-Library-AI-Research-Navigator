import { createContext } from "react";

// Only the mode flag survives reload. Research content never goes in this key.
export const PRIVATE_MODE_KEY = "zsr-private-mode";
export const ResearchPrivacyContext = createContext(false);
export function readPrivateMode(storage) {
  try { return (storage ?? globalThis.sessionStorage)?.getItem(PRIVATE_MODE_KEY) === "true"; }
  catch { return false; }
}
export function setPrivateModePreference(enabled, storage) {
  try {
    const target = storage ?? globalThis.sessionStorage;
    if (enabled) target?.setItem(PRIVATE_MODE_KEY, "true");
    else target?.removeItem(PRIVATE_MODE_KEY);
  } catch { /* In-memory privacy still works when browser storage is blocked. */ }
}
