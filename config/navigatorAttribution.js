export const NAVIGATOR_ATTRIBUTION = "Navigator research guidance · verify sources · follow your course’s AI policy";
export const NAVIGATOR_PROTOTYPE_NOTICE = "Research prototype. Guidance is not authoritative ZSR policy or a substitute for your own analysis.";

/** Visible provenance only. Never insert marks into source quotations,
 * bibliographic fields, or text copied with the browser's normal controls. */
export function withNavigatorAttribution(value) {
  const content = String(value || "").trimEnd();
  return `${content}\n\n---\n\n${NAVIGATOR_ATTRIBUTION}\n${NAVIGATOR_PROTOTYPE_NOTICE}\n`;
}
