import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { PartCatalog } from "../src/core/catalog.ts";
import { suggestProjects } from "../src/core/generate.ts";
import { illustrateProject, iconFor } from "../src/core/illustrate.ts";
import { diffParts, parseInventory } from "../src/core/inventory.ts";
import { createMockClient } from "../src/core/mock.ts";
import { loadShowcase } from "../src/core/showcase.ts";

const catalog = PartCatalog.load();

test("gallery: 10 valid projects with unique ids and existing tutorials", () => {
  const projects = loadShowcase();
  assert.ok(projects.length >= 10);
  assert.equal(new Set(projects.map((p) => p.id)).size, projects.length);
  for (const p of projects) {
    if (p.tutorial) assert.ok(existsSync(p.tutorial), `${p.id}: missing tutorial ${p.tutorial}`);
  }
});

test("gallery: electronic parts all resolve to catalog entries (so they get prices and icons)", () => {
  const household = /popsicle|glue|cardboard|tape|jar|body/i;
  for (const p of loadShowcase()) {
    for (const part of p.parts) {
      if (household.test(part.name)) continue;
      assert.ok(catalog.get(catalog.resolve(part.name)), `${p.id}: "${part.name}" isn't in the catalog`);
    }
  }
});

test("illustration: valid SVG with every part, owned and missing marked", () => {
  const crab = loadShowcase().find((p) => p.id === "desk-crab")!;
  const inv = parseInventory("arduino uno, 2x sg90, hc-sr04", catalog);
  const parts = diffParts(crab, inv, catalog);
  const svg = illustrateProject({ ...crab, parts });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg, /<\/svg>$/);
  for (const name of ["Arduino Uno", "SG90 micro servo", "Popsicle sticks"]) assert.ok(svg.includes(name), name);
  assert.ok(svg.includes("need 2 more"), "partial servo count");
  assert.ok(svg.includes("BUY"), "missing parts");
  assert.ok(svg.includes("you have it"), "legend");
});

test("illustration: titles are XML-escaped and every catalog part has a drawing", () => {
  const svg = illustrateProject({ title: 'Tom & Jerry <"bot">', difficulty: "beginner", estimatedHours: 1, parts: [] });
  assert.ok(svg.includes("Tom &amp; Jerry &lt;&quot;bot&quot;&gt;"));
  const generic = iconFor("does-not-exist", "flux capacitor");
  const raw = JSON.parse(readFileSync("data/parts-catalog.json", "utf8")) as { parts: { key: string; name: string }[] };
  for (const e of raw.parts) assert.notEqual(iconFor(e.key, e.name), generic, `${e.key} has no icon`);
});

test("mock: picks gallery projects that use your parts and match your goal", async () => {
  const inventory = parseInventory("esp32, bme280, oled, soil moisture sensor, relay, water pump", catalog);
  const r = await suggestProjects({ inventory, constraints: { goal: "plants" } }, { client: createMockClient(), catalog });
  const titles = r.projects.map((p) => p.title);
  assert.ok(titles.includes("Plant Watering Buddy"), titles.join(", "));
  assert.ok(titles.includes("Desk Weather Station"), titles.join(", "));
});

test("mock: replacement requests respect skill and time", async () => {
  const inventory = parseInventory("arduino uno, 4x sg90, hc-sr04, breadboard, jumper wires", catalog);
  const r = await suggestProjects(
    { inventory, constraints: { skill: "beginner", maxHours: 3 } },
    { client: createMockClient(), catalog },
  );
  for (const p of r.projects) {
    assert.equal(p.difficulty, "beginner", p.title);
    assert.ok(p.estimatedHours <= 3, p.title);
  }
});
