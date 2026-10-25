import { test } from "node:test";
import assert from "node:assert/strict";
import { PartCatalog } from "../src/core/catalog.ts";
import { diffParts, parseInventory, parseQuantity } from "../src/core/inventory.ts";

const catalog = PartCatalog.load();

test("quantity formats", () => {
  assert.deepEqual(parseQuantity("4x SG90"), { name: "SG90", qty: 4 });
  assert.deepEqual(parseQuantity("SG90 x4"), { name: "SG90", qty: 4 });
  assert.deepEqual(parseQuantity("servo (3)"), { name: "servo", qty: 3 });
  assert.deepEqual(parseQuantity("2 servos"), { name: "servos", qty: 2 });
});

test("numbers that are part of the name are not quantities", () => {
  assert.deepEqual(parseQuantity("18650 battery"), { name: "18650 battery", qty: 1 });
  assert.deepEqual(parseQuantity("16x2 LCD"), { name: "16x2 LCD", qty: 1 });
  assert.deepEqual(parseQuantity("LCD 16x2"), { name: "LCD 16x2", qty: 1 });
  assert.deepEqual(parseQuantity("5 mm LED"), { name: "5 mm LED", qty: 1 });
});

test("inventory merges synonyms and sums quantities", () => {
  const inv = parseInventory("2x sg90, 2 micro servos\narduino uno; hc-sr04", catalog);
  const servo = inv.find((i) => i.key === "servo-sg90");
  assert.equal(servo?.qty, 4);
  assert.equal(inv.length, 3);
});

test("diff marks owned, partially owned and missing parts", () => {
  const inv = parseInventory("arduino uno, 2x sg90", catalog);
  const parts = diffParts(
    {
      title: "t", summary: "s", difficulty: "beginner", estimatedHours: 1, requiresSoldering: false, steps: [], safetyNotes: [],
      parts: [
        { name: "Arduino Uno R3", qty: 1, purpose: "" },
        { name: "SG90 micro servo", qty: 4, purpose: "" },
        { name: "HC-SR04", qty: 1, purpose: "" },
      ],
    },
    inv,
    catalog,
  );
  const byKey = Object.fromEntries(parts.map((p) => [p.key, p]));
  assert.deepEqual([byKey["arduino-uno"]!.have, byKey["arduino-uno"]!.missing], [1, 0]);
  assert.deepEqual([byKey["servo-sg90"]!.have, byKey["servo-sg90"]!.missing], [2, 2]);
  assert.deepEqual([byKey["ultrasonic-sensor"]!.have, byKey["ultrasonic-sensor"]!.missing], [0, 1]);
});

test("packs (jumper wires) count as one set, so 10 wires never cost 9 sets", () => {
  const project = {
    title: "t", summary: "s", difficulty: "beginner" as const, estimatedHours: 1, requiresSoldering: false, steps: [], safetyNotes: [],
    parts: [{ name: "jumper wires", qty: 10, purpose: "" }],
  };
  const owned = diffParts(project, parseInventory("jumper wires", catalog), catalog)[0]!;
  assert.deepEqual([owned.qty, owned.have, owned.missing], [1, 1, 0]);
  const notOwned = diffParts(project, parseInventory("esp32", catalog), catalog)[0]!;
  assert.deepEqual([notOwned.qty, notOwned.have, notOwned.missing, notOwned.unitPriceCzk], [1, 0, 1, 70]);
});

test("duplicate lines from the model are merged", () => {
  const parts = diffParts(
    {
      title: "t", summary: "s", difficulty: "beginner", estimatedHours: 1, requiresSoldering: false, steps: [], safetyNotes: [],
      parts: [
        { name: "SG90 servo", qty: 2, purpose: "front legs" },
        { name: "micro servo", qty: 2, purpose: "back legs" },
      ],
    },
    [],
    catalog,
  );
  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.qty, 4);
});
