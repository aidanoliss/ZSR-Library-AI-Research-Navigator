function defaultEnv() {
  if (typeof import.meta !== "undefined" && import.meta.env) return import.meta.env;
  if (typeof process !== "undefined" && process.env) return process.env;
  return {};
}

function cleanBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

export function getSupabaseConfig(env = defaultEnv()) {
  return {
    url: env.VITE_SUPABASE_URL || env.SUPABASE_URL || "",
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "",
    configured: Boolean(env.VITE_SUPABASE_URL || env.SUPABASE_URL),
  };
}

export function getSupabaseServerConfig(env = typeof process !== "undefined" ? process.env : {}) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || "";
  return {
    url,
    serviceRoleKey,
    anonKey,
    apiKey: serviceRoleKey || anonKey,
    configured: Boolean(url && (serviceRoleKey || anonKey)),
    usesServiceRole: Boolean(url && serviceRoleKey),
  };
}

export function hasSupabaseServerConfig(env = typeof process !== "undefined" ? process.env : {}) {
  return getSupabaseServerConfig(env).configured;
}

export function requireServerSecret(env = typeof process !== "undefined" ? process.env : {}) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required only for trusted server-side jobs. Never expose it in the browser.");
  }
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

export function createSupabaseRestClient(env = typeof process !== "undefined" ? process.env : {}) {
  const config = getSupabaseServerConfig(env);
  if (!config.configured) return null;

  async function request(path, options = {}) {
    const {
      method = "GET",
      query = "",
      body,
      headers = {},
      prefer,
    } = options;
    const suffix = query ? `?${query}` : "";
    const response = await fetch(`${cleanBaseUrl(config.url)}/rest/v1/${path}${suffix}`, {
      method,
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(prefer ? { Prefer: prefer } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      const detail = text ? ` ${text.slice(0, 500)}` : "";
      throw new Error(`Supabase REST ${method} ${path} failed with ${response.status}.${detail}`);
    }
    if (!text) return null;
    return JSON.parse(text);
  }

  return {
    config,
    request,
    select(table, query = "select=*") {
      return request(table, { query });
    },
    insert(table, rows, options = {}) {
      return request(table, {
        method: "POST",
        body: Array.isArray(rows) ? rows : [rows],
        query: options.query || "",
        prefer: options.prefer || "return=representation",
      });
    },
    upsert(table, rows, options = {}) {
      const query = options.onConflict ? `on_conflict=${encodeURIComponent(options.onConflict)}` : "";
      return request(table, {
        method: "POST",
        body: Array.isArray(rows) ? rows : [rows],
        query,
        prefer: options.prefer || "resolution=merge-duplicates,return=representation",
      });
    },
    update(table, filters, patch, options = {}) {
      const query = new URLSearchParams(filters).toString();
      return request(table, {
        method: "PATCH",
        query,
        body: patch,
        prefer: options.prefer || "return=representation",
      });
    },
  };
}
