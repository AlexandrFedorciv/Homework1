#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { PartCatalog } from "../core/catalog.ts";
import { ConfigError, loadEnv, readConfig } from "../core/config.ts";
import { detectParts, InvalidOutputError, suggestProjects } from "../core/generate.ts";
import { parseInventory } from "../core/inventory.ts";
import { createClient, type ImageInput } from "../core/llm.ts";
import { HttpError } from "../core/retry.ts";
import { ConstraintsSchema, SKILL_LEVELS, type Constraints } from "../core/schemas.ts";
import { c, formatResult, shoppingListMarkdown } from "./format.ts";

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

${c.bold("Output")}
  --json                print raw JSON instead of formatted text
  --shopping-list <f>   also write a Markdown shopping list
  --provider <name>     override LLM_PROVIDER (anthropic | openai | mock)
  -h, --help

${c.bold("Example")}
  partsbin "arduino uno, 4x sg90, hc-sr04, breadboard, jumper wires" --goal "something that moves" --skill beginner --hours 4 --budget 300
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
  const config = readConfig();
  const client = createClient(config, log);
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

  if (values.photo) {
    const mediaType = MEDIA_TYPES[extname(values.photo).toLowerCase()];
    if (!mediaType) throw new UsageError(`--photo must be one of: ${Object.keys(MEDIA_TYPES).join(", ")}`);
    log(`🔍 detecting parts in ${values.photo} with ${client.label}…`);
    const detected = await detectParts({ mediaType, base64: readFileSync(values.photo).toString("base64") }, { client, log });
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
  if (inventory.length === 0) throw new UsageError("No parts given. Pass a parts list, --parts-file or --photo (see --help).");

  // --- generate ----------------------------------------------------------
  log(`🛠  asking ${client.label} for 3 projects using ${inventory.length} part type(s)…`);
  const result = await suggestProjects({ inventory, constraints }, { client, catalog, log });

  if (values.json) {
    console.log(JSON.stringify({ inventory, constraints, ...result }, null, 2));
  } else {
    console.log("\n" + formatResult(result, client.label));
  }

  if (values["shopping-list"]) {
    writeFileSync(values["shopping-list"], shoppingListMarkdown(result));
    log(`📝 shopping list written to ${values["shopping-list"]}`);
  }
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
