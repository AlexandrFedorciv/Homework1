import { z } from "zod";

/** Skill levels, ordered from easiest to hardest. */
export const SKILL_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const skillRank = (s: SkillLevel): number => SKILL_LEVELS.indexOf(s);

/** Optional constraints the user can set. Any subset may be given. */
export const ConstraintsSchema = z.object({
  /** Free-text goal or theme, e.g. "something that walks" or "plant monitoring". */
  goal: z.string().trim().min(1).optional(),
  /** Highest difficulty the user is comfortable with. */
  skill: z.enum(SKILL_LEVELS).optional(),
  /** Max total build time in hours. */
  maxHours: z.number().positive().optional(),
  /** Max money (CZK) the user wants to spend on missing parts. */
  budget: z.number().nonnegative().optional(),
  /** False if the user has no soldering iron. */
  canSolder: z.boolean().optional(),
});
export type Constraints = z.infer<typeof ConstraintsSchema>;

/** One item in the user's parts bin. */
export interface InventoryItem {
  /** Name as the user typed it. */
  raw: string;
  /** Canonical key used for matching. */
  key: string;
  qty: number;
}

// ---------------------------------------------------------------------------
// What we ask the LLM to return
// ---------------------------------------------------------------------------

export const LlmPartSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().positive().default(1),
  purpose: z.string().default(""),
});

export const LlmStepSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
});

export const LlmProjectSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  difficulty: z.enum(SKILL_LEVELS),
  estimatedHours: z.number().positive(),
  requiresSoldering: z.boolean(),
  parts: z.array(LlmPartSchema).min(1),
  steps: z.array(LlmStepSchema).min(3),
  safetyNotes: z.array(z.string()).default([]),
});
export type LlmProject = z.infer<typeof LlmProjectSchema>;

/** JSON Schema handed to the model (tool input / response format). Kept in sync with the zod schemas above. */
export const PROJECTS_JSON_SCHEMA = {
  type: "object",
  properties: {
    projects: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string", description: "1-2 sentences: what it does and why it's fun" },
          difficulty: { type: "string", enum: [...SKILL_LEVELS] },
          estimatedHours: { type: "number", description: "Realistic total build time in hours" },
          requiresSoldering: { type: "boolean" },
          parts: {
            type: "array",
            description: "EVERY part needed, including ones the user already has",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                qty: { type: "integer", minimum: 1 },
                purpose: { type: "string" },
              },
              required: ["name", "qty", "purpose"],
            },
          },
          steps: {
            type: "array",
            minItems: 3,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                detail: { type: "string" },
              },
              required: ["title", "detail"],
            },
          },
          safetyNotes: { type: "array", items: { type: "string" } },
        },
        required: [
          "title",
          "summary",
          "difficulty",
          "estimatedHours",
          "requiresSoldering",
          "parts",
          "steps",
          "safetyNotes",
        ],
      },
    },
  },
  required: ["projects"],
} as const;

export const DetectedPartsSchema = z.object({
  parts: z.array(z.object({ name: z.string().min(1), qty: z.number().int().positive().default(1) })),
});

export const DETECTED_PARTS_JSON_SCHEMA = {
  type: "object",
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          qty: { type: "integer", minimum: 1 },
        },
        required: ["name", "qty"],
      },
    },
  },
  required: ["parts"],
} as const;

// ---------------------------------------------------------------------------
// What the app returns (LLM output enriched by our own code)
// ---------------------------------------------------------------------------

export interface ProjectPart {
  name: string;
  key: string;
  qty: number;
  purpose: string;
  /** How many the user already has (capped at qty). */
  have: number;
  /** How many are missing (qty - have). */
  missing: number;
  /** Indicative unit price in CZK, if the part is in our catalog. */
  unitPriceCzk?: number;
}

export interface ConstraintCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface Project {
  title: string;
  summary: string;
  difficulty: SkillLevel;
  estimatedHours: number;
  requiresSoldering: boolean;
  parts: ProjectPart[];
  steps: { title: string; detail: string }[];
  safetyNotes: string[];
  /** Share of the bill of materials the user already owns (averaged per part type), 0..1. */
  coverage: number;
  /** Estimated cost of missing parts in CZK (catalog-priced parts only). */
  missingCostCzk: number;
  /** Missing parts we have no price for. */
  unpricedMissing: string[];
  checks: ConstraintCheck[];
}

export interface SuggestResult {
  projects: Project[];
  /** How many LLM calls the whole run took (initial + repairs + regenerations). */
  llmCalls: number;
  /** Notes about repairs / regenerations that happened. */
  notes: string[];
}
