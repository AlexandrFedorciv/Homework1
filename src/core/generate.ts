import { z } from "zod";
import type { PartCatalog } from "./catalog.ts";
import { diffParts } from "./inventory.ts";
import type { ImageInput, LlmClient } from "./llm.ts";
import { buildProjectPrompt, DETECT_SYSTEM_PROMPT, DETECT_USER_PROMPT, PROJECT_SYSTEM_PROMPT } from "./prompts.ts";
import {
  DETECTED_PARTS_JSON_SCHEMA,
  DetectedPartsSchema,
  LlmProjectSchema,
  PROJECTS_JSON_SCHEMA,
  skillRank,
  type ConstraintCheck,
  type Constraints,
  type InventoryItem,
  type LlmProject,
  type Project,
  type SuggestResult,
} from "./schemas.ts";

export const PROJECT_COUNT = 3;

export class InvalidOutputError extends Error {
  override name = "InvalidOutputError";
}

export interface SuggestDeps {
  client: LlmClient;
  catalog: PartCatalog;
  log?: (msg: string) => void;
  /** How many times to ask the model to fix output that fails schema validation. */
  maxRepairs?: number;
  /** How many rounds of "replace the projects that broke a constraint". */
  maxRegenerations?: number;
}

// ---------------------------------------------------------------------------
// 1. Call the model and validate its JSON, asking it to repair invalid output
// ---------------------------------------------------------------------------

function projectsSchemaFor(count: number) {
  const schema = structuredClone(PROJECTS_JSON_SCHEMA) as any;
  schema.properties.projects.minItems = count;
  schema.properties.projects.maxItems = count;
  return schema as Record<string, unknown>;
}

function formatZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 8)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

/** Generic "call → parse → validate → on failure feed the error back and try again" loop. */
async function generateValidated<T>(
  client: LlmClient,
  req: { system: string; user: string; schema: Record<string, unknown>; image?: ImageInput },
  validator: z.ZodType<T, z.ZodTypeDef, unknown>,
  maxRepairs: number,
  counter: { calls: number },
  log: (msg: string) => void,
): Promise<T> {
  let user = req.user;
  for (let attempt = 0; ; attempt++) {
    counter.calls++;
    const raw = await client.generateJson({ ...req, user });
    let problem: string;
    try {
      const result = validator.safeParse(JSON.parse(raw));
      if (result.success) return result.data;
      problem = formatZodError(result.error);
    } catch (e) {
      problem = `not valid JSON (${(e as Error).message})`;
    }
    if (attempt >= maxRepairs) {
      throw new InvalidOutputError(`The model's answer didn't match the expected format after ${attempt + 1} attempts: ${problem}`);
    }
    log(`⚠ model output failed validation (${problem}) — asking it to fix it`);
    user =
      `${req.user}\n\nYour previous answer was rejected by the validator: ${problem}\n` +
      `Previous answer (truncated):\n${raw.slice(0, 4000)}\n\nReturn a corrected, complete JSON object.`;
  }
}

// ---------------------------------------------------------------------------
// 2. Enrich model output with facts computed in code
// ---------------------------------------------------------------------------

const MAINS_PATTERN = /\b(230|220|240|110|120)\s?v(ac)?\b|\bmains\b|\bwall (outlet|socket)\b|\bac power\b/i;

export function enrichProject(p: LlmProject, inventory: InventoryItem[], constraints: Constraints, catalog: PartCatalog): Project {
  const parts = diffParts(p, inventory, catalog);

  // Average per part type, so "8 popsicle sticks" doesn't outweigh the microcontroller you already own.
  const coverage = parts.length === 0 ? 0 : parts.reduce((s, x) => s + x.have / x.qty, 0) / parts.length;

  let missingCostCzk = 0;
  const unpricedMissing: string[] = [];
  for (const part of parts) {
    if (part.missing === 0) continue;
    if (part.unitPriceCzk !== undefined) missingCostCzk += part.missing * part.unitPriceCzk;
    else unpricedMissing.push(part.name);
  }

  const project: Project = {
    title: p.title,
    summary: p.summary,
    difficulty: p.difficulty,
    estimatedHours: p.estimatedHours,
    requiresSoldering: p.requiresSoldering,
    parts,
    steps: p.steps,
    safetyNotes: p.safetyNotes,
    coverage,
    missingCostCzk,
    unpricedMissing,
    checks: [],
  };
  project.checks = checkConstraints(project, constraints);
  return project;
}

/**
 * Verify the model actually respected the constraints. We don't trust the model's own claims:
 * every check here is computed from the structured output.
 */
export function checkConstraints(p: Project, c: Constraints): ConstraintCheck[] {
  const checks: ConstraintCheck[] = [];

  if (c.skill) {
    checks.push({
      name: "skill",
      ok: skillRank(p.difficulty) <= skillRank(c.skill),
      detail: `difficulty ${p.difficulty} (yours: ${c.skill})`,
    });
  }
  if (c.maxHours !== undefined) {
    checks.push({ name: "time", ok: p.estimatedHours <= c.maxHours, detail: `${p.estimatedHours} h (limit ${c.maxHours} h)` });
  }
  if (c.budget !== undefined) {
    const extra = p.unpricedMissing.length ? ` + ${p.unpricedMissing.length} unpriced item(s)` : "";
    checks.push({
      name: "budget",
      ok: p.missingCostCzk <= c.budget,
      detail: `~${p.missingCostCzk} CZK to buy${extra} (limit ${c.budget} CZK)`,
    });
  }
  if (c.canSolder === false) {
    checks.push({ name: "no-solder", ok: !p.requiresSoldering, detail: p.requiresSoldering ? "needs soldering" : "solderless" });
  }

  const ownedTypes = p.parts.filter((x) => x.have > 0).length;
  checks.push({
    name: "uses-your-parts",
    ok: p.coverage >= 0.4 || ownedTypes >= 3,
    detail: `${Math.round(p.coverage * 100)}% of parts already owned (${ownedTypes} part type${ownedTypes === 1 ? "" : "s"})`,
  });

  const text = [p.title, p.summary, ...p.steps.map((s) => `${s.title} ${s.detail}`), ...p.parts.map((x) => x.name)].join(" ");
  if (MAINS_PATTERN.test(text) && c.skill !== "advanced") {
    checks.push({ name: "safety", ok: false, detail: "involves mains voltage — only allowed at skill=advanced" });
  }

  return checks;
}

const failed = (p: Project) => p.checks.filter((c) => !c.ok);

// ---------------------------------------------------------------------------
// 3. The full pipeline
// ---------------------------------------------------------------------------

export async function suggestProjects(
  input: { inventory: InventoryItem[]; constraints: Constraints },
  deps: SuggestDeps,
): Promise<SuggestResult> {
  const { client, catalog, log = () => {}, maxRepairs = 2, maxRegenerations = 1 } = deps;
  const { inventory, constraints } = input;
  if (inventory.length === 0) throw new Error("The parts list is empty — add at least one part.");

  const counter = { calls: 0 };
  const notes: string[] = [];
  const catalogNames = catalog.promptList();

  const request = async (count: number, avoidTitles: string[] = [], feedback: string[] = []) => {
    const validator = z.object({ projects: z.array(LlmProjectSchema).length(count) });
    const out = await generateValidated(
      client,
      {
        system: PROJECT_SYSTEM_PROMPT,
        user: buildProjectPrompt({ inventory, constraints, catalogNames, count, avoidTitles, feedback }),
        schema: projectsSchemaFor(count),
      },
      validator,
      maxRepairs,
      counter,
      log,
    );
    return out.projects.map((p) => enrichProject(p, inventory, constraints, catalog));
  };

  let projects = await request(PROJECT_COUNT);

  // Self-check loop: replace only the projects that broke a constraint.
  for (let round = 0; round < maxRegenerations; round++) {
    const badIdx = projects.map((p, i) => (failed(p).length ? i : -1)).filter((i) => i >= 0);
    if (badIdx.length === 0) break;

    const feedback = badIdx.map((i) => {
      const p = projects[i]!;
      return `"${p.title}": ${failed(p).map((c) => `${c.name} — ${c.detail}`).join(", ")}`;
    });
    log(`↻ ${badIdx.length} project(s) broke a constraint — regenerating: ${feedback.join(" | ")}`);

    const replacements = await request(
      badIdx.length,
      projects.map((p) => p.title),
      feedback,
    );
    badIdx.forEach((projIdx, k) => {
      const old = projects[projIdx]!;
      const neu = replacements[k]!;
      // Keep whichever version breaks fewer constraints.
      if (failed(neu).length < failed(old).length) {
        notes.push(`Replaced "${old.title}" (${failed(old).map((c) => c.name).join(", ")}) with "${neu.title}".`);
        projects[projIdx] = neu;
      } else {
        notes.push(`Kept "${old.title}" — the replacement wasn't better.`);
      }
    });
  }

  // Best first: fewest broken constraints, then most parts already owned, then cheapest.
  projects = [...projects].sort(
    (a, b) => failed(a).length - failed(b).length || b.coverage - a.coverage || a.missingCostCzk - b.missingCostCzk,
  );

  return { projects, llmCalls: counter.calls, notes };
}

/** Vision step: photo of a parts bin → parts list for the user to confirm. */
export async function detectParts(
  image: ImageInput,
  deps: { client: LlmClient; log?: (msg: string) => void; maxRepairs?: number },
): Promise<{ name: string; qty: number }[]> {
  const counter = { calls: 0 };
  const out = await generateValidated(
    deps.client,
    { system: DETECT_SYSTEM_PROMPT, user: DETECT_USER_PROMPT, schema: DETECTED_PARTS_JSON_SCHEMA as Record<string, unknown>, image },
    DetectedPartsSchema,
    deps.maxRepairs ?? 2,
    counter,
    deps.log ?? (() => {}),
  );
  return out.parts;
}
