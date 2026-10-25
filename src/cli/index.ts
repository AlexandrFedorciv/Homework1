#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { PartCatalog } from "../core/catalog.ts";
import { ConfigError, loadEnv, readConfig } from "../core/config.ts";
import { detectParts, enrichProject, InvalidOutputError, suggestProjects } from "../core/generate.ts";
import { illustrateProject } from "../core/illustrate.ts";
import { parseInventory } from "../core/inventory.ts";
import { createClient, type ImageInput } from "../core/llm.ts";
import { HttpError } from "../core/retry.ts";
import { ConstraintsSchema, SKILL_LEVELS, type Constraints, type InventoryItem, type Project } from "../core/schemas.ts";
import { findShowcase, loadShowcase } from "../core/showcase.ts";
import { c, formatProject, formatResult, shoppingListMarkdown } from "./format.ts";

const HELP = `
${c.bold("partsbin")} — turn the parts in your drawer into three buildable projects

${c.bold("Usage")}
  partsbin [parts...] [options]

${c.bold("Parts")} (combine any of these)
  "arduino uno, 4x sg90 servo, hc-sr04"   comma/newline separated, quantities like 4x / x4 / (4)
  --parts-file <file>                      a text file with one part per line
  --photo <image>                          detect parts from a photo of your parts bin (vision)
  --yes                                    accept detected parts without asking

${c.bold("Constraints")} (all optional)
  --goal <text>         theme, e.g. "something that walks"
  --skill <level>       ${SKILL_LEVELS.join(" | ")}
  --hours <n>           max build time in hours
  --budget <czk>        max money to spend on missing parts (CZK)
  --no-solder           solderless builds only

${c.bold("Gallery")} (curated example projects — no API key needed)
  --gallery             list the example projects (ranked by your parts, if you give any)
  --project <id>        show one example project in full, checked against your parts

${c.bold("Output")}
  --json                print raw JSON instead of formatted text
  --shopping-list <f>   also write a Markdown shopping list
  --svg-dir <dir>       also save a parts illustration (SVG) for every project
  --provider <name>     override LLM_PROVIDER (anthropic | openai | mock)
  -h, --help

${c.bold("Examples")}
  partsbin "raspberry pi zero 2 w, microsd card, esp32, oled, push button" --goal "protect my home network" --skill beginner --hours 2
  partsbin --gallery "raspberry pi zero 2 w, esp32, oled"
  partsbin --project rfid-lock "arduino uno, sg90" --svg-dir pictures
`;

const MEDIA_TYPES: Record<string, ImageInput["mediaType"]> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

class UsageError extends Error {}

function num(flag: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new UsageError(`${flag} must be a positive number, got "${value}"`);
  return n;
}

const log = (msg: string) => process.stderr.write(c.dim(msg) + "\n");

// Exit quietly when piped into `head` & co.
process.stdout.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EPIPE") process.exit(0);
  throw e;
});

const OPTIONS = {
  "parts-file": { type: "string" },
  photo: { type: "string" },
  yes: { type: "boolean", short: "y" },
  goal: { type: "string" },
  skill: { type: "string" },
  hours: { type: "string" },
  budget: { type: "string" },
  "no-solder": { type: "boolean" },
  json: { type: "boolean" },
  "shopping-list": { type: "string" },
  "svg-dir": { type: "string" },
  gallery: { type: "boolean" },
  project: { type: "string" },
  provider: { type: "string" },
  help: { type: "boolean", short: "h" },
} as const;

function parseCliArgs() {
  try {
    return parseArgs({ allowPositionals: true, options: OPTIONS });
  } catch (e) {
    throw new UsageError(`${(e as Error).message.split(". ")[0]}. Run with --help to see the options.`);
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseCliArgs();

  if (values.help) {
    console.log(HELP);
    return;
  }

  loadEnv();
  if (values.provider) process.env.LLM_PROVIDER = values.provider;
  const catalog = PartCatalog.load();

  // --- constraints -------------------------------------------------------
  const parsed = ConstraintsSchema.safeParse({
    goal: values.goal,
    skill: values.skill?.toLowerCase(),
    maxHours: num("--hours", values.hours),
    budget: num("--budget", values.budget),
    canSolder: values["no-solder"] ? false : undefined,
  });
  if (!parsed.success) {
    throw new UsageError(parsed.error.issues.map((i) => `--${i.path.join(".")}: ${i.message}`).join("\n"));
  }
  const constraints: Constraints = parsed.data;

  // --- parts -------------------------------------------------------------
  const sources: string[] = [...positionals];
  if (values["parts-file"]) sources.push(readFileSync(values["parts-file"], "utf8"));

  // The LLM client is only created when it's actually needed (photo or generation),
  // so the gallery works without an API key.
  let client: ReturnType<typeof createClient> | undefined;
  const getClient = () => (client ??= createClient(readConfig(), log));

  if (values.photo) {
    const mediaType = MEDIA_TYPES[extname(values.photo).toLowerCase()];
    if (!mediaType) throw new UsageError(`--photo must be one of: ${Object.keys(MEDIA_TYPES).join(", ")}`);
    log(`🔍 detecting parts in ${values.photo} with ${getClient().label}…`);
    const detected = await detectParts({ mediaType, base64: readFileSync(values.photo).toString("base64") }, { client: getClient(), log });
    let list = detected.map((p) => `${p.qty}x ${p.name}`).join(", ");
    console.error(`\n${c.bold("Detected in photo:")} ${list || "(nothing)"}`);
    if (!values.yes && process.stdin.isTTY) {
      const rl = createInterface({ input: process.stdin, output: process.stderr });
      const answer = (await rl.question("Use these parts? [Y]es / [e]dit / [n]o: ")).trim().toLowerCase();
      if (answer.startsWith("e")) list = await rl.question("Corrected parts list: ");
      else if (answer.startsWith("n")) list = "";
      rl.close();
    }
    if (list) sources.push(list);
  }

  const inventory = parseInventory(sources, catalog);

  // --- gallery modes -------------------------------------------------------
  if (values.gallery) return showGallery(inventory, constraints, catalog, values.json);
  if (values.project) {
    const sp = findShowcase(values.project);
    if (!sp) throw new UsageError(`No example project "${values.project}". Run --gallery to see the ids.`);
    const project = enrichProject(sp, inventory, constraints, catalog);
    // Without an inventory "uses your parts" is meaningless — don't show it as a failure.
    if (inventory.length === 0) project.checks = project.checks.filter((ch) => ch.name !== "uses-your-parts");
    if (values.json) console.log(JSON.stringify({ id: sp.id, tags: sp.tags, tutorial: sp.tutorial, ...project }, null, 2));
    else {
      console.log("\n" + formatProject(project, 0, { numbered: false }));
      if (sp.tutorial) console.log(`\n${c.bold("Full build tutorial:")} ${sp.tutorial}`);
      if (inventory.length === 0) console.log(c.dim("\nTip: add your parts (e.g. \"arduino uno, hc-sr04\") to see what you already have."));
    }
    writeOutputs([project], values, inventory.length > 0);
    return;
  }

  // --- generate ----------------------------------------------------------
  if (inventory.length === 0) throw new UsageError("No parts given. Pass a parts list, --parts-file or --photo (see --help).");
  log(`🛠  asking ${getClient().label} for 3 projects using ${inventory.length} part type(s)…`);
  const result = await suggestProjects({ inventory, constraints }, { client: getClient(), catalog, log });

  if (values.json) {
    console.log(JSON.stringify({ inventory, constraints, ...result }, null, 2));
  } else {
    console.log("\n" + formatResult(result, getClient().label));
  }
  writeOutputs(result.projects, values, true);
  if (values["shopping-list"]) {
    writeFileSync(values["shopping-list"], shoppingListMarkdown(result));
    log(`📝 shopping list written to ${values["shopping-list"]}`);
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);

function writeOutputs(projects: Project[], values: { "svg-dir"?: string }, showStatus: boolean): void {
  const dir = values["svg-dir"];
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  projects.forEach((p, i) => {
    const file = join(dir, `${i + 1}-${slug(p.title)}.svg`);
    writeFileSync(file, illustrateProject(p, { showStatus }));
    log(`🖼  ${file}`);
  });
}

function showGallery(inventory: InventoryItem[], constraints: Constraints, catalog: PartCatalog, json?: boolean): void {
  const rows = loadShowcase().map((sp) => ({ sp, p: enrichProject(sp, inventory, constraints, catalog) }));
  if (inventory.length) rows.sort((a, b) => b.p.coverage - a.p.coverage || a.p.missingCostCzk - b.p.missingCostCzk);

  if (json) {
    console.log(JSON.stringify(rows.map(({ sp, p }) => ({ id: sp.id, title: p.title, difficulty: p.difficulty, estimatedHours: p.estimatedHours, tags: sp.tags, coverage: p.coverage, missingCostCzk: p.missingCostCzk })), null, 2));
    return;
  }
  console.log(`\n${c.bold(`Gallery — ${rows.length} example projects`)}${inventory.length ? c.dim("  (ranked by how many of your parts they use)") : ""}\n`);
  for (const { sp, p } of rows) {
    const own = inventory.length ? `  ${c.green(`${String(Math.round(p.coverage * 100)).padStart(3)}% owned`)}  ${c.dim(`~${p.missingCostCzk} CZK to buy`)}` : "";
    const tut = sp.tutorial ? c.yellow(" 📘 tutorial") : "";
    console.log(`  ${c.cyan(sp.id.padEnd(16))} ${c.bold(p.title)}${tut}`);
    console.log(`  ${" ".repeat(16)} ${c.dim(`${p.difficulty} · ~${p.estimatedHours} h · ${sp.tags.join(", ")}`)}${own}\n`);
  }
  console.log(c.dim(`Show one in full:  partsbin --project <id> "your parts"`));
}

main().catch((err: unknown) => {
  let message: string;
  if (err instanceof UsageError || err instanceof ConfigError) {
    message = err.message;
  } else if (err instanceof HttpError) {
    const hint =
      err.status === 401
        ? " — check your API key in .env"
        : err.status === 404
          ? " — check LLM_MODEL"
          : err.status === 429 || err.status >= 500
            ? " — the service is busy; retries were exhausted, try again in a minute"
            : "";
    message = `${err.message}${hint}`;
  } else if (err instanceof InvalidOutputError) {
    message = err.message;
  } else if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
    message = `File not found: ${(err as NodeJS.ErrnoException).path}`;
  } else {
    message = err instanceof Error ? err.message : String(err);
  }
  console.error(c.red(`✗ ${message}`));
  if (process.env.DEBUG && err instanceof Error) console.error(err.stack);
  process.exit(err instanceof UsageError ? 2 : 1);
});
