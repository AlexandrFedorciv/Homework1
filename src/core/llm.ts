import type { AppConfig } from "./config.ts";
import { createMockClient } from "./mock.ts";
import { HttpError, withRetry } from "./retry.ts";

/**
 * Minimal, dependency-free LLM clients built on fetch().
 * Writing the HTTP layer by hand (instead of using an SDK) keeps error classification and
 * retry behaviour explicit — which is part of what this assignment is about.
 */

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
}

export interface JsonRequest {
  system: string;
  user: string;
  image?: ImageInput;
  /** JSON Schema describing the expected output. */
  schema: Record<string, unknown>;
  maxTokens?: number;
}

export interface LlmClient {
  readonly label: string;
  /** Returns the model's raw JSON text (parsed and validated by the caller). */
  generateJson(req: JsonRequest): Promise<string>;
}

export type RetryLogger = (msg: string) => void;

export function createClient(config: AppConfig, log: RetryLogger = () => {}): LlmClient {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicClient(config, log);
    case "openai":
      return new OpenAiCompatibleClient(config, log);
    case "mock":
      return createMockClient();
  }
}

/** Shared HTTP helper: timeout per attempt, error classification, retries. */
async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  config: AppConfig,
  log: RetryLogger,
): Promise<any> {
  return withRetry(
    async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      const text = await res.text();
      if (!res.ok) {
        let message = text.slice(0, 500);
        try {
          const parsed = JSON.parse(text);
          message = parsed?.error?.message ?? message;
        } catch {
          /* non-JSON error body */
        }
        const retryAfter = Number(res.headers.get("retry-after"));
        throw new HttpError(res.status, `HTTP ${res.status}: ${message}`, Number.isFinite(retryAfter) ? retryAfter : undefined);
      }
      return JSON.parse(text);
    },
    {
      retries: config.maxRetries,
      onRetry: ({ attempt, delayMs, error }) =>
        log(`⚠ transient error (${describe(error)}), retry ${attempt}/${config.maxRetries} in ${(delayMs / 1000).toFixed(1)} s`),
    },
  );
}

function describe(err: unknown): string {
  if (err instanceof HttpError) return `HTTP ${err.status}`;
  if (err instanceof Error) return err.name === "TimeoutError" ? "timeout" : err.message;
  return String(err);
}

/**
 * Anthropic structured outputs accept a subset of JSON Schema: every object needs
 * additionalProperties:false and numeric/array-size constraints aren't allowed.
 * We strip those here and enforce them afterwards with zod instead.
 */
export function toStrictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toStrictSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (["maxItems", "minimum", "maximum", "minLength", "maxLength", "exclusiveMinimum", "exclusiveMaximum"].includes(k)) continue;
    if (k === "minItems" && typeof v === "number" && v > 1) {
      out[k] = 1;
      continue;
    }
    out[k] = toStrictSchema(v);
  }
  if (out.type === "object") out.additionalProperties = false;
  return out;
}

class AnthropicClient implements LlmClient {
  readonly label: string;
  constructor(
    private readonly config: AppConfig,
    private readonly log: RetryLogger,
  ) {
    this.label = `anthropic/${config.model}`;
  }

  async generateJson(req: JsonRequest): Promise<string> {
    const content: unknown[] = [];
    if (req.image) {
      content.push({ type: "image", source: { type: "base64", media_type: req.image.mediaType, data: req.image.base64 } });
    }
    content.push({ type: "text", text: req.user });

    const data = await postJson(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": this.config.apiKey!, "anthropic-version": "2023-06-01" },
      {
        model: this.config.model,
        max_tokens: req.maxTokens ?? 8000,
        system: req.system,
        messages: [{ role: "user", content }],
        output_config: { format: { type: "json_schema", schema: toStrictSchema(req.schema) } },
      },
      this.config,
      this.log,
    );

    if (data.stop_reason === "max_tokens") throw new Error("The model ran out of output tokens before finishing the JSON.");
    if (data.stop_reason === "refusal") throw new Error("The model declined this request.");
    const text = (data.content as { type: string; text?: string }[]).find((b) => b.type === "text")?.text;
    if (!text) throw new Error("The model returned no text content.");
    return text;
  }
}

class OpenAiCompatibleClient implements LlmClient {
  readonly label: string;
  constructor(
    private readonly config: AppConfig,
    private readonly log: RetryLogger,
  ) {
    this.label = `openai-compatible/${config.model}`;
  }

  async generateJson(req: JsonRequest): Promise<string> {
    // json_object mode is the most widely supported option across OpenAI-compatible servers;
    // the schema goes in the prompt and zod validates the result.
    const system = `${req.system}\n\nRespond with a single JSON object matching this JSON Schema:\n${JSON.stringify(req.schema)}`;
    const userContent = req.image
      ? [
          { type: "text", text: req.user },
          { type: "image_url", image_url: { url: `data:${req.image.mediaType};base64,${req.image.base64}` } },
        ]
      : req.user;

    const headers: Record<string, string> = {};
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;

    const data = await postJson(
      `${this.config.baseUrl}/chat/completions`,
      headers,
      {
        model: this.config.model,
        max_tokens: req.maxTokens ?? 8000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      },
      this.config,
      this.log,
    );

    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error("The model ran out of output tokens before finishing the JSON.");
    const text = choice?.message?.content;
    if (!text) throw new Error("The model returned no content.");
    return text;
  }
}
