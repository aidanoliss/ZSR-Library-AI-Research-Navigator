import { createHash, timingSafeEqual } from "node:crypto";

const DEFAULT_JSON_LIMIT = 128 * 1024;
const MAX_TRUSTED_PROXY_HOPS = 5;

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

export const JSON_BODY_LIMIT_BYTES = positiveInteger(
  process.env.JSON_BODY_LIMIT_BYTES,
  DEFAULT_JSON_LIMIT,
  1024 * 1024
);

export class RequestBodyError extends Error {
  constructor(message, status = 400, code = "INVALID_BODY") {
    super(message);
    this.name = "RequestBodyError";
    this.status = status;
    this.code = code;
  }
}

export function trustProxyHops(value = process.env.TRUST_PROXY) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || ["off", "false", "no", "0"].includes(normalized)) return 0;
  // `true` deliberately means one known edge proxy, not "trust every address".
  if (["on", "true", "yes"].includes(normalized)) return 1;
  return Math.min(Math.max(Number.parseInt(normalized, 10) || 0, 0), MAX_TRUSTED_PROXY_HOPS);
}

function normalizeAddress(value) {
  const address = String(value || "unknown").trim();
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

/**
 * Resolve a rate-limit key without trusting caller-controlled forwarding headers
 * unless a bounded number of proxy hops has been explicitly configured.
 */
export function clientKey(req, configuredTrust = process.env.TRUST_PROXY) {
  const socketAddress = normalizeAddress(req?.socket?.remoteAddress);
  const hops = trustProxyHops(configuredTrust);
  if (!hops) return socketAddress;

  const forwarded = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")
    .map(normalizeAddress)
    .filter(Boolean);
  if (!forwarded.length) return socketAddress;
  const index = Math.max(0, forwarded.length - hops);
  return forwarded[index] || socketAddress;
}

function forwardedValue(req, name) {
  return String(req?.headers?.[name] || "").split(",").at(-1)?.trim() || "";
}

function effectiveRequestOrigin(req) {
  const proxyTrusted = trustProxyHops() > 0;
  const protocol = proxyTrusted
    ? forwardedValue(req, "x-forwarded-proto") || (req?.socket?.encrypted ? "https" : "http")
    : req?.socket?.encrypted ? "https" : "http";
  const host = proxyTrusted
    ? forwardedValue(req, "x-forwarded-host") || req?.headers?.host
    : req?.headers?.host;
  if (!host) return "";
  return `${protocol}://${String(host).toLowerCase()}`;
}

function normalizeOrigin(value) {
  try {
    const parsed = new URL(String(value || ""));
    if (!/^https?:$/.test(parsed.protocol)) return "";
    return parsed.origin.toLowerCase();
  } catch {
    return "";
  }
}

export function allowedCorsOrigin(req, configured = process.env.CORS_ALLOWED_ORIGINS) {
  const origin = normalizeOrigin(req?.headers?.origin);
  if (!origin) return "";

  const sameOrigin = normalizeOrigin(effectiveRequestOrigin(req));
  if (sameOrigin && origin === sameOrigin) return String(req.headers.origin);

  const allowlist = String(configured || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
  return allowlist.includes(origin) ? String(req.headers.origin) : "";
}

export function isCorsRequestAllowed(req, configured = process.env.CORS_ALLOWED_ORIGINS) {
  return !req?.headers?.origin || Boolean(allowedCorsOrigin(req, configured));
}

export function corsHeaders(req) {
  const allowedOrigin = allowedCorsOrigin(req);
  return allowedOrigin
    ? {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
      }
    : {};
}

export function securityHeaders() {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self' mailto:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
    ].join("; "),
  };
  if (process.env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}

export function applySecurityHeaders(res) {
  for (const [name, value] of Object.entries(securityHeaders())) res.setHeader(name, value);
}

function bearerToken(req) {
  const authorization = String(req?.headers?.authorization || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function safeTokenEqual(received, expected) {
  const left = createHash("sha256").update(String(received || "")).digest();
  const right = createHash("sha256").update(String(expected || "")).digest();
  return Boolean(String(received || "")) && timingSafeEqual(left, right);
}

export function isAdminAuthorized(req, configuredToken = process.env.ADMIN_TOKEN) {
  const expected = String(configuredToken || "").trim();
  return Boolean(expected) && safeTokenEqual(bearerToken(req), expected);
}

export async function readJsonBody(req, maxBytes = JSON_BODY_LIMIT_BYTES) {
  const contentLength = Number(req?.headers?.["content-length"] || 0);
  if (contentLength > maxBytes) {
    req.resume?.();
    throw new RequestBodyError("Request body is too large.", 413, "BODY_TOO_LARGE");
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      req.resume?.();
      throw new RequestBodyError("Request body is too large.", 413, "BODY_TOO_LARGE");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestBodyError("Request body must be valid JSON.", 400, "INVALID_JSON");
  }
}

export function releaseMetadata() {
  const releaseId = String(
    process.env.RELEASE_ID || process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || "local"
  ).trim();
  return {
    releaseId: releaseId === "local" ? releaseId : releaseId.slice(0, 12),
    version: String(process.env.APP_VERSION || "1.0.0").slice(0, 40),
  };
}
