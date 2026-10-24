import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createClient, toStrictSchema } from "../src/core/llm.ts";
import { PROJECTS_JSON_SCHEMA } from "../src/core/schemas.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("strict schema: adds additionalProperties:false, strips unsupported keywords", () => {
  const s = toStrictSchema(PROJECTS_JSON_SCHEMA) as any;
  assert.equal(s.additionalProperties, false);
  assert.equal(s.properties.projects.maxItems, undefined);
  assert.equal(s.properties.projects.minItems, 1);
  assert.equal(s.properties.projects.items.additionalProperties, false);
  assert.equal(s.properties.projects.items.properties.parts.items.properties.qty.minimum, undefined);
});

test("Anthropic client retries a 529 and sends a structured-output request", async () => {
  const bodies: any[] = [];
  let calls = 0;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    calls++;
    bodies.push(JSON.parse(init.body as string));
    if (calls === 1) return new Response(JSON.stringify({ error: { message: "Overloaded" } }), { status: 529 });
    return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: '{"ok":true}' }] }), { status: 200 });
  }) as typeof fetch;

  const logs: string[] = [];
  const client = createClient(
    { provider: "anthropic", apiKey: "test", model: "claude-sonnet-5-5", timeoutMs: 1000, maxRetries: 2 },
    (m) => logs.push(m),
  );
  const out = await client.generateJson({ system: "sys", user: "hi", schema: { type: "object", properties: {} } });

  assert.equal(out, '{"ok":true}');
  assert.equal(calls, 2);
  assert.match(logs[0]!, /HTTP 529.*retry 1\/2/);
  assert.equal(bodies[0].output_config.format.type, "json_schema");
  assert.equal(bodies[0].output_config.format.schema.additionalProperties, false);
});

test("Anthropic client fails fast on 401", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: "invalid x-api-key" } }), { status: 401 });
  }) as typeof fetch;
  const client = createClient({ provider: "anthropic", apiKey: "bad", model: "m", timeoutMs: 1000, maxRetries: 3 });
  await assert.rejects(client.generateJson({ system: "", user: "", schema: {} }), /HTTP 401: invalid x-api-key/);
  assert.equal(calls, 1);
});
