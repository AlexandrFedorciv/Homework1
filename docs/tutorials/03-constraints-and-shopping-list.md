# 3 · Constraints, checks and the shopping list

**Time:** 10 minutes

Constraints are how you tell PartsBin what "a good project for me" means. This tutorial shows each one, how the app checks them, and what happens when a project breaks one.

---

## The constraints

All of them are optional. Use any combination.

| Flag (CLI) | Web field | What it means | How it's checked |
|---|---|---|---|
| `--goal "…"` | Goal | theme or idea, e.g. `"walking robot"`, `"plants"` | guides the model (not checked: it's a wish, not a rule) |
| `--skill beginner` | Skill | the hardest difficulty you want | project difficulty ≤ your level |
| `--hours 4` | Max h | total build time | `estimatedHours` ≤ limit |
| `--budget 300` | Budget CZK | money for parts you'd have to buy | sum of missing parts × catalog price ≤ budget |
| `--no-solder` | I can't solder | breadboard / jumper wires only | project must not require soldering |

Two checks always run:

- **uses-your-parts**: at least 40 % of the parts list is yours, or at least 3 different parts of yours are used. A project that needs you to buy everything isn't a "use what you have" project.
- **safety**: anything involving mains voltage (230 V / 110 V) fails unless your skill is `advanced`.

## Try it: watch a project get replaced

The mock provider makes this easy to see, because it ignores the limits on the first try:

```bash
LLM_PROVIDER=mock npm start -- "arduino uno, 2x sg90 servo, hc-sr04, breadboard, jumper wires, 10k potentiometer" \
  --skill beginner --hours 4 --budget 300
```

```
↻ 1 project(s) broke a constraint — regenerating: "Desk Crab — a 4-servo walking robot": skill — difficulty intermediate (yours: beginner), time — 6 h (limit 4 h)
…
• Replaced "Desk Crab — a 4-servo walking robot" (skill, time) with "Light-Seeking Sunflower".
Model: mock (offline, answers from the gallery) · 2 LLM calls
```

What happened:

1. The model proposed 3 projects. One of them (Desk Crab) was too hard and too long.
2. The app **computed** that from the structured answer. It doesn't ask the model "did you follow the rules?"
3. Only the bad project was sent back, with the exact reasons and a "don't repeat these titles" list.
4. The replacement passed, so it took the old project's place. If a replacement is *not* better, the original is kept and you'll see `Kept "…" — the replacement wasn't better.`
5. Finally the three projects are sorted: fewest failed checks first, then most parts owned, then cheapest.

With a real model you'll usually see **1 LLM call**, because good models mostly follow the rules. The check is the safety net for when they don't.

## Reading the parts list

```
Parts
  ✓ 1× Arduino Uno — reads distance, generates tones
  ◐ 4× SG90 micro servo have 2, MISSING 2 (~120 CZK) — one per leg
  ✗ 1× Piezo buzzer MISSING (~15 CZK) — sound output
```

The matching is done in code ([`src/core/catalog.ts`](../../src/core/catalog.ts)), not by the model. It understands that `SG90`, `9g micro servo` and `servos` are the same part, but `MG996R servo` is a different one. It also counts: you said `2x sg90`, the project needs 4, so 2 are missing.

The **parts picture** shows the same thing visually. Solid cards with a green check are yours, dashed red cards are to buy:

![Desk Crab vs. a starter kit](../images/examples/desk-crab-vs-starter-kit.svg)

## The shopping list

```bash
npm start -- "arduino uno, 2x sg90, hc-sr04" --shopping-list shopping.md
```

```markdown
## 1. Ultrasonic Radar Sweep

- [ ] 1× Breadboard — ~70 CZK
- [ ] 1× Jumper wire set — ~70 CZK
- [ ] 1× USB cable — ~60 CZK

**Total:** ~200 CZK
```

In the web UI, use **⬇ Shopping list** above the results. The checkboxes render as a real checklist on GitHub, in Obsidian and in most note apps.

> Prices are indicative hobby-shop prices in CZK. To use your own shop's prices, see [tutorial 4](04-customize-the-catalog.md).

## Machine-readable output

`--json` prints everything: inventory, constraints, projects with `have`/`missing` per part, `coverage`, `missingCostCzk` and every check with its details. Use it to build your own tools on top:

```bash
npm start -- "esp32, bme280, oled" --json > result.json
```

---

**Next:** [4 · Customize the parts catalog →](04-customize-the-catalog.md)
