# 4 · Customize the parts catalog and the gallery

**Time:** 15 minutes

Two JSON files decide a lot of PartsBin's behaviour, and you can edit both without touching any code:

| File | What it controls |
|---|---|
| [`data/parts-catalog.json`](../../data/parts-catalog.json) | which names mean the same part, prices of missing parts, the part names suggested to the model, the icon in the parts picture |
| [`data/showcase.json`](../../data/showcase.json) | the example projects in the gallery and the answers of the offline mock |

---

## Change a price

Every catalog entry looks like this:

```json
{ "key": "servo-sg90", "name": "SG90 micro servo", "priceCzk": 60,
  "aliases": ["sg90", "sg90 servo", "micro servo", "9g servo", "servo", "servo motor"] }
```

Change `priceCzk` to whatever your shop charges. The next run uses it for every "MISSING (~… CZK)" and for the budget check.

## Teach it a new name for a part

Say people at your school call jumper wires "dupont kabely". Add the alias:

```json
"aliases": ["jumper wire", "jumper", "dupont wire", "dupont cable", "jumper cable", "dupont kabely"]
```

How matching works (`resolve()` in [`src/core/catalog.ts`](../../src/core/catalog.ts)):

1. Names are lower-cased, punctuation and filler words (`module`, `board`, `kit`, …) are removed, plurals become singular: `"SG90 Servos (blue)"` → `sg90 servo blue`.
2. An alias matches when **all** its words appear in the name.
3. If several aliases match, the most specific wins: more words, then aliases containing a model number (`sg90` beats `servo`), then aliases ending in the same noun (`motor driver` beats `dc motor` for "DC motor driver").

Check your change with the tests (`npm test`), or quickly:

```bash
npx tsx -e "import { PartCatalog } from './src/core/catalog.ts'; console.log(PartCatalog.load().resolve('dupont kabely'))"
# → jumper-wires
```

## Add a new part

Append a new entry with a unique `key`:

```json
{ "key": "hx711", "name": "HX711 load cell amplifier + 5 kg load cell", "priceCzk": 120,
  "aliases": ["hx711", "load cell", "weight sensor", "scale sensor"] }
```

Now `hx711` in a parts list is recognized, priced, and offered to the model as a part it can suggest. In the parts picture, a part without its own drawing gets a generic module icon if its name contains "sensor" or "module", and a dashed "?" box otherwise. To draw a specific one, add the key to `BY_KEY` in [`src/core/illustrate.ts`](../../src/core/illustrate.ts).

## Add a project to the gallery

Add an object to `projects` in [`data/showcase.json`](../../data/showcase.json):

```json
{
  "id": "smart-scale",
  "tags": ["kitchen", "sensor"],
  "title": "Kitchen Smart Scale",
  "summary": "Weighs ingredients and shows grams on an OLED, with a tare button.",
  "difficulty": "beginner",
  "estimatedHours": 2,
  "requiresSoldering": true,
  "parts": [
    { "name": "Arduino Nano", "qty": 1, "purpose": "reads the amplifier" },
    { "name": "HX711 load cell amplifier + 5 kg load cell", "qty": 1, "purpose": "measures weight" }
  ],
  "steps": [
    { "title": "…", "detail": "…" },
    { "title": "…", "detail": "…" },
    { "title": "…", "detail": "…" }
  ],
  "safetyNotes": []
}
```

Rules (checked by `npm test`):

- `id`: lowercase letters, numbers and dashes, unique.
- At least 1 part and at least 3 steps; `difficulty` is `beginner`, `intermediate` or `advanced`.
- `tutorial` (optional): a path to a Markdown file in the repo that exists.

The new project appears in `--gallery`, in the web **Gallery** tab, and can be picked by the mock provider.

## Regenerate the gallery pictures

The README shows a picture of every gallery project. After adding or editing projects, run:

```bash
npm run gallery:images
```

This writes `docs/images/gallery/<id>.svg` for every project.

---

**Next:** [5 · Build the Pi-hole Ad Blocker →](05-build-pi-hole.md)
