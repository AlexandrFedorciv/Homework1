import type { PartCatalog } from "./catalog.ts";
import type { InventoryItem, LlmProject, ProjectPart } from "./schemas.ts";

/** Parse "4x SG90 servo" / "SG90 x4" / "4 SG90" / "SG90 (4)" into name + quantity. */
export function parseQuantity(entry: string): { name: string; qty: number } {
  const s = entry.trim();
  const patterns: RegExp[] = [
    /^(\d+)\s*[x×*]\s+(.+)$/i, // 4x servo   (but not "16x2 LCD")
    /^(.+?)\s+[x×*]\s*(\d+)$/i, // servo x4  (but not "LCD 16x2")
    /^(.+?)\s*\((\d+)\)$/, // servo (4)
    /^(\d+)\s+(?!x\b)(.+)$/i, // 4 servos  (but not "18650 battery" — handled below)
  ];
  for (const [i, re] of patterns.entries()) {
    const m = s.match(re);
    if (!m) continue;
    const [qtyStr, name] = i === 0 || i === 3 ? [m[1]!, m[2]!] : [m[2]!, m[1]!];
    const qty = Number(qtyStr);
    // "18650 battery", "5 mm LED", "9 V battery": a leading number that is really part of the name.
    if (i === 3 && (qty > 99 || /^(mm|v|a|w|ohm|k|g)\b/i.test(name))) break;
    if (qty >= 1 && qty <= 999) return { name: name.trim(), qty };
  }
  return { name: s, qty: 1 };
}

/** Parse a free-text parts list (comma / newline / semicolon separated) into a merged inventory. */
export function parseInventory(input: string | string[], catalog: PartCatalog): InventoryItem[] {
  const entries = (Array.isArray(input) ? input : [input])
    .flatMap((chunk) => chunk.split(/[,\n;]+/))
    .map((e) => e.trim())
    .filter(Boolean);

  const byKey = new Map<string, InventoryItem>();
  for (const entry of entries) {
    const { name, qty } = parseQuantity(entry);
    const key = catalog.resolve(name);
    const existing = byKey.get(key);
    if (existing) existing.qty += qty;
    else byKey.set(key, { raw: name, key, qty });
  }
  return [...byKey.values()];
}

/**
 * Compare a project's bill of materials with the inventory.
 * Done in code (not by the LLM) so "what's missing" is always exact, including quantities:
 * you have 2 servos, the project needs 4 -> 2 missing.
 */
export function diffParts(project: LlmProject, inventory: InventoryItem[], catalog: PartCatalog): ProjectPart[] {
  const owned = new Map(inventory.map((i) => [i.key, i.qty]));

  // Merge duplicate lines the model might emit for the same part.
  const merged = new Map<string, { name: string; qty: number; purpose: string }>();
  for (const p of project.parts) {
    const key = catalog.resolve(p.name);
    const prev = merged.get(key);
    if (prev) {
      prev.qty += p.qty;
      if (p.purpose && !prev.purpose.includes(p.purpose)) prev.purpose = [prev.purpose, p.purpose].filter(Boolean).join("; ");
    } else {
      merged.set(key, { name: p.name, qty: p.qty, purpose: p.purpose });
    }
  }

  return [...merged.entries()].map(([key, p]) => {
    const have = Math.min(owned.get(key) ?? 0, p.qty);
    const entry = catalog.get(key);
    return {
      name: p.name,
      key,
      qty: p.qty,
      purpose: p.purpose,
      have,
      missing: p.qty - have,
      ...(entry ? { unitPriceCzk: entry.priceCzk } : {}),
    };
  });
}
