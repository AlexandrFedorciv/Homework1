import { existsSync } from "node:fs";

/** Load .env (if present) into process.env using Node's built-in loader — no dotenv dependency. */
export function loadEnv(path = ".env"): void {
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}

export type ProviderName = "anthropic" | "openai" | "mock";

export interface AppConfig {
  provider: ProviderName;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const provider = (env.LLM_PROVIDER ?? "anthropic").toLowerCase() as ProviderName;
  const timeoutMs = Number(env.LLM_TIMEOUT_MS ?? 60_000);
  const maxRetries = Number(env.LLM_MAX_RETRIES ?? 3);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new ConfigError("LLM_TIMEOUT_MS must be a positive number");
  if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new ConfigError("LLM_MAX_RETRIES must be an integer >= 0");

  switch (provider) {
    case "anthropic": {
      const apiKey = env.ANTHROPIC_API_KEY?.trim();
      if (!apiKey) {
        throw new ConfigError(
          "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key, or run with LLM_PROVIDER=mock.",
        );
      }
      return { provider, apiKey, model: env.LLM_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL, timeoutMs, maxRetries };
    }
    case "openai": {
      const apiKey = env.OPENAI_API_KEY?.trim();
      const baseUrl = (env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
      const model = env.LLM_MODEL?.trim();
      // Local servers like Ollama don't need a key, so only require it for the real OpenAI host.
      if (!apiKey && baseUrl.includes("api.openai.com")) {
        throw new ConfigError("OPENAI_API_KEY is not set. Add it to .env, or run with LLM_PROVIDER=mock.");
      }
      if (!model) throw new ConfigError("LLM_MODEL must be set when LLM_PROVIDER=openai (e.g. the model your account has).");
      return { provider, apiKey, baseUrl, model, timeoutMs, maxRetries };
    }
    case "mock":
      return { provider, model: "mock", timeoutMs, maxRetries };
    default:
      throw new ConfigError(`Unknown LLM_PROVIDER "${env.LLM_PROVIDER}". Use anthropic, openai or mock.`);
  }
}
