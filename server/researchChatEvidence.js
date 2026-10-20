import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { completeEvidenceExcerpt } from "../config/evidencePassages.js";
import { normalizeEvidenceText, sourceEvidenceId } from "./sourceEvidence.js";

const TOKEN_VERSION = 1;
export const RESEARCH_CHAT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RESEARCH_CHAT_LIMITS = Object.freeze({ sources: 6, token: 12000, excerpt: 3000, question: 2000, history: 10, historyItem: 2000, historyTotal: 12000, topic: 2000, assignment: 3000 });
const ephemeralSecret = randomBytes(32);
const clean = (value, limit) => normalizeEvidenceText(typeof value === "string" ? value : "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
const safeUrl = (value) => { try { const url = new URL(value); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.toString().slice(0, 1800) : ""; } catch { return ""; } };
const configured = (value) => typeof value === "string" && value.trim() && value !== "your_api_key_here";
const authorName = (value) => typeof value === "string" ? value : value && typeof value === "object" && !Array.isArray(value)
  ? value.name || value.display_name || [value.given, value.family].filter((part) => typeof part === "string").join(" ") : "";
function signingSecret(options = {}) {
  const supplied = options.signingKey ?? process.env.RESEARCH_CHAT_SIGNING_KEY;
  if (configured(supplied)) return createHmac("sha256", supplied).update("zsr-research-chat-evidence-v1").digest();
  if (configured(process.env.GEMINI_API_KEY)) return createHmac("sha256", process.env.GEMINI_API_KEY).update("zsr-research-chat-evidence-v1").digest();
  return ephemeralSecret;
}
const clock = (options) => typeof options.now === "function" ? options.now() : Number.isFinite(options.now) ? options.now : Date.now();
const signature = (payload, options) => createHmac("sha256", signingSecret(options)).update(payload).digest("base64url");
function tokenError(message, code = "INVALID_SOURCE_TOKEN", status = 400) { return Object.assign(new Error(message), { status, code }); }

/** Call only with records obtained by Navigator's server-side providers. Notes,
 * imported client metadata, and historical assistant prose must never be signed. */
export function signResearchChatSources(sources = [], options = {}) {
  if (!Array.isArray(sources)) return [];
  const issuedAt = clock(options);
  return sources.map((source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) return source;
    const title = clean(source.title, 500);
    if (!title) return { ...source, researchChatToken: undefined, researchChatScope: "metadata" };
    const identityWarning = [source.identityCheck?.status, source.identityCheck?.observedStatus].includes("title-difference")
      || source.is_retracted === true || source.retracted === true;
    const rawAbstract = identityWarning ? "" : clean(source.abstractText || source.abstractExcerpt || source.evidenceExcerpt, 20000);
    let abstract = completeEvidenceExcerpt(rawAbstract, RESEARCH_CHAT_LIMITS.excerpt, source.abstractTruncated === true);
    if (abstract.length < 30) abstract = "";
    const record = {
      id: sourceEvidenceId(source), title, url: safeUrl(source.url),
      authors: (Array.isArray(source.authors) && source.authors.length ? source.authors : [source.author]).map(authorName).filter(Boolean).slice(0, 8).map((value) => clean(value, 120)),
      date: clean(String(source.date || source.publicationYear || source.citation?.year || ""), 40),
      type: clean(source.type || source.citation?.type, 80), doi: clean(source.doi || source.citation?.doi, 300),
      provider: clean(source.abstractSource || source.sourceProvider || source.provenance?.provider, 160),
      scope: abstract ? "abstract" : "metadata", abstract, identityWarning,
    };
    const mint = () => {
      const payload = Buffer.from(JSON.stringify({ v: TOKEN_VERSION, issuedAt, expiresAt: issuedAt + RESEARCH_CHAT_TOKEN_TTL_MS, source: record })).toString("base64url");
      return `${payload}.${signature(payload, options)}`;
    };
    let token = mint();
    // Character limits alone do not bound UTF-8/base64 size. Remove only whole
    // abstract sentences until the token is usable by the bounded chat route.
    while (token.length > RESEARCH_CHAT_LIMITS.token && record.abstract) {
      record.abstract = completeEvidenceExcerpt(record.abstract, Math.floor(record.abstract.length * 0.75), true);
      if (record.abstract.length < 30) record.abstract = "";
      record.scope = record.abstract ? "abstract" : "metadata";
      token = mint();
    }
    if (token.length > RESEARCH_CHAT_LIMITS.token) {
      // Defensive metadata-only fallback for unusually large Unicode names.
      record.authors = record.authors.slice(0, 4).map((name) => name.slice(0, 80));
      record.provider = record.provider.slice(0, 100);
      record.title = record.title.slice(0, 300);
      token = mint();
    }
    return { ...source, evidenceId: record.id, researchChatToken: token, researchChatScope: record.scope };
  });
}

/** Authenticate the exact metadata/abstract supplied by Navigator. Client fields
 * beside the token are deliberately ignored. Expiry requires a fresh search. */
export function verifyResearchChatToken(token, options = {}) {
  if (typeof token !== "string" || token.length > RESEARCH_CHAT_LIMITS.token || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw tokenError("Select a source returned by Navigator before using Research chat.");
  const [payload, supplied] = token.split(".");
  const expected = signature(payload, options);
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw tokenError("This source could not be authenticated. Run its Navigator search again, then select the new result.");
  let packet;
  try { packet = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw tokenError("The source record could not be read. Run the Navigator search again."); }
  const now = clock(options);
  if (packet?.v !== TOKEN_VERSION || !Number.isFinite(packet.issuedAt) || !Number.isFinite(packet.expiresAt)
    || packet.expiresAt - packet.issuedAt !== RESEARCH_CHAT_TOKEN_TTL_MS || packet.issuedAt > now + 60000
    || !packet.source || typeof packet.source.id !== "string" || typeof packet.source.title !== "string" || typeof packet.source.abstract !== "string") throw tokenError("The source record is invalid. Run the Navigator search again.");
  if (packet.expiresAt <= now) throw tokenError("This source's chat evidence has expired. Run its Navigator search again to refresh the record.", "SOURCE_EXPIRED", 409);
  return packet.source;
}

export function publicChatSource(source) {
  const { abstract, ...metadata } = source;
  return metadata;
}
