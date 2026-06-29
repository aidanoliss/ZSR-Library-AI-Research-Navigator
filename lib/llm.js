export const PROVIDERS = {
  openai: {
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4.1-mini",
  },
  anthropic: {
    name: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-3-5-sonnet-latest",
  },
  gemini: {
    name: "Gemini",
    envKey: "GEMINI_API_KEY",
    defaultModel: "gemini-1.5-pro",
  },
};

export function configuredProvider(env = process.env) {
  const requested = env.VENTURE_RADAR_LLM_PROVIDER || "openai";
  const provider = PROVIDERS[requested] || PROVIDERS.openai;
  return {
    id: requested,
    ...provider,
    hasKey: Boolean(env[provider.envKey]),
    model: env.VENTURE_RADAR_LLM_MODEL || provider.defaultModel,
  };
}

export async function runLLMTask({ provider = configuredProvider(), prompt, input }) {
  if (!provider.hasKey) {
    return {
      ok: false,
      provider: provider.name,
      error: `Missing ${provider.envKey}. Venture Radar will use deterministic sample analysis until a provider key is configured.`,
    };
  }

  return {
    ok: false,
    provider: provider.name,
    error:
      "Provider calls are intentionally not executed in the MVP without a reviewed server-side adapter. Add the adapter behind this abstraction before enabling live model calls.",
    prompt,
    input,
  };
}
