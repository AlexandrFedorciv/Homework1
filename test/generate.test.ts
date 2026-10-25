import { test } from "node:test";
import assert from "node:assert/strict";
import { PartCatalog } from "../src/core/catalog.ts";
import { detectParts, InvalidOutputError, suggestProjects } from "../src/core/generate.ts";
import { parseInventory } from "../src/core/inventory.ts";
import type { JsonRequest, LlmClient } from "../src/core/llm.ts";
import { createMockClient } from "../src/core/mock.ts";

const catalog = PartCatalog.load();
const inventory = parseInventory("arduino uno, 4x sg90, hc-sr04, breadboard, jumper wires", catalog);

const project = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  summary: "s",
  difficulty: "beginner",
  estimatedHours: 2,
  requiresSoldering: false,
  parts: [
    { name: "Arduino Uno", qty: 1, purpose: "" },
    { name: "SG90 servo", qty: 1, purpose: "" },
    { name: "HC-SR04", qty: 1, purpose: "" },
  ],
  steps: [
    { title: "a", detail: "a" },
    { title: "b", detail: "b" },
    { title: "c", detail: "c" },
  ],
  safetyNotes: [],
  ...extra,
});

/** A fake LLM that returns scripted answers in order and records the prompts it got. */
function scripted(...answers: string[]): LlmClient & { prompts: JsonRequest[] } {
  const prompts: JsonRequest[] = [];
  return {
    label: "scripted",
    prompts,
    async generateJson(req) {
      prompts.push(req);
      const next = answers.shift();
      if (next === undefined) throw new Error("no more scripted answers");
      return next;
    },
  };
}

test("mock pipeline returns 3 enriched projects", async () => {
  const r = await suggestProjects({ inventory, constraints: {} }, { client: createMockClient(), catalog });
  assert.equal(r.projects.length, 3);
  for (const p of r.projects) {
    assert.ok(p.coverage > 0 && p.coverage <= 1);
    assert.ok(p.parts.every((x) => x.have + x.missing === x.qty));
  }
});

test("invalid model output is fed back and repaired", async () => {
  const good = JSON.stringify({ projects: [project("A"), project("B"), project("C")] });
  const client = scripted("not json at all", JSON.stringify({ projects: [project("A")] }), good);
  const r = await suggestProjects({ inventory, constraints: {} }, { client, catalog });
  assert.equal(r.llmCalls, 3);
  assert.match(client.prompts[1]!.user, /rejected by the validator: not valid JSON/);
  assert.match(client.prompts[2]!.user, /projects: .*exactly 3/);
});

test("gives up with a clear error when the model never produces valid output", async () => {
  const client = scripted("{}", "{}", "{}");
  await assert.rejects(suggestProjects({ inventory, constraints: {} }, { client, catalog }), InvalidOutputError);
});

test("projects that break a constraint are regenerated with feedback", async () => {
  const first = JSON.stringify({ projects: [project("Quick"), project("Too long", { estimatedHours: 12 }), project("Fine")] });
  const replacement = JSON.stringify({ projects: [project("Short instead", { estimatedHours: 1 })] });
  const client = scripted(first, replacement);

  const r = await suggestProjects({ inventory, constraints: { maxHours: 4 } }, { client, catalog });

  assert.equal(r.llmCalls, 2);
  assert.match(client.prompts[1]!.user, /"Too long": time — 12 h \(limit 4 h\)/);
  assert.match(client.prompts[1]!.user, /Do NOT repeat these already-suggested projects: Quick; Too long; Fine/);
  assert.deepEqual(r.projects.map((p) => p.title).sort(), ["Fine", "Quick", "Short instead"]);
  assert.ok(r.projects.every((p) => p.checks.every((c) => c.ok)));
});

test("budget, soldering and mains-safety checks are computed from the output", async () => {
  const pricey = project("Pricey", {
    requiresSoldering: true,
    parts: [{ name: "Raspberry Pi 5", qty: 1, purpose: "" }, { name: "Arduino Uno", qty: 1, purpose: "" }],
    steps: [
      { title: "Wire the relay", detail: "Connect the lamp to 230V mains through the relay" },
      { title: "b", detail: "b" },
      { title: "c", detail: "c" },
    ],
  });
  const answer = JSON.stringify({ projects: [pricey, project("B"), project("C")] });
  const client = scripted(answer, JSON.stringify({ projects: [pricey] }));
  const r = await suggestProjects(
    { inventory, constraints: { budget: 500, canSolder: false, skill: "beginner" } },
    { client, catalog },
  );
  const p = r.projects.find((x) => x.title === "Pricey")!;
  const failed = p.checks.filter((c) => !c.ok).map((c) => c.name).sort();
  assert.deepEqual(failed, ["budget", "no-solder", "safety"]);
  assert.equal(p.missingCostCzk, 1800);
  // the bad project sorts last
  assert.equal(r.projects.at(-1)!.title, "Pricey");
});

test("photo detection returns a validated parts list", async () => {
  const parts = await detectParts({ mediaType: "image/jpeg", base64: "AAAA" }, { client: createMockClient() });
  assert.ok(parts.length > 0);
  assert.ok(parts.every((p) => p.name && p.qty >= 1));
});
