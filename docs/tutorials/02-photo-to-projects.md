# 2 · From a photo to projects

**Time:** 5 minutes · **You need:** an API key with a vision-capable model (all current Claude models are), and a photo of your parts.

Typing out a parts drawer is boring. PartsBin can look at a photo instead.

---

## Take a good photo

- **Spread the parts out** on a plain, light surface (a sheet of paper is perfect). Parts piled in a box are hard to count.
- **Light from above or a window**, without strong reflections on chips and screens.
- **Labels up**: model numbers like `SG90` or `HC-SR04` help a lot.
- One photo of up to ~25 parts works best. For a bigger collection, take several photos and run the detection once per photo.
- JPG, PNG, WebP and GIF all work. In the web UI, big phone photos are resized to 1600 px automatically before upload.

## In the terminal

```bash
npm start -- --photo my-parts.jpg --goal "something for my desk"
```

PartsBin shows what it found and asks before using it:

```
🔍 detecting parts in my-parts.jpg with anthropic/claude-sonnet-5-5…

Detected in photo: 1x Arduino Uno, 4x SG90 micro servo, 1x HC-SR04 ultrasonic sensor, 1x Breadboard, 1x Jumper wires
Use these parts? [Y]es / [e]dit / [n]o:
```

- **Y** (or Enter): use the list as is.
- **e**: type a corrected list, e.g. when it counted 3 servos and you have 4.
- **n**: ignore the photo.

You can combine a photo with typed parts. Both are merged and quantities are added up:

```bash
npm start -- "2x 18650 battery, tp4056" --photo my-parts.jpg
```

Add `--yes` to skip the question, which is handy in scripts.

## In the web UI

1. Click the dashed **📷 Drop a photo** box, or drag a photo onto it.
2. The detected parts are **added to the parts box**, so you can fix the list before generating.
3. Click **Suggest 3 projects**.

## Why it asks you to confirm

Vision models are good but not perfect: a blue sensor module might be a BME280 or an MPU6050, and two overlapping servos can be counted as one. Since "what you own" decides everything else (missing parts, prices, which projects fit), PartsBin always lets you check the list first.

## Under the hood

The photo is sent once to the model with a short system prompt ([`src/core/prompts.ts`](../../src/core/prompts.ts), `DETECT_SYSTEM_PROMPT`) and a JSON schema `{ parts: [{ name, qty }] }`. The answer is validated with zod like every other model answer. If it doesn't match the schema, the validation error goes back to the model for a fix (see `generateValidated` in [`src/core/generate.ts`](../../src/core/generate.ts)).

---

**Next:** [3 · Constraints, checks and the shopping list →](03-constraints-and-shopping-list.md)
