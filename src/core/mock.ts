import { PartCatalog } from "./catalog.ts";
import type { JsonRequest, LlmClient } from "./llm.ts";
import { SKILL_LEVELS, skillRank, type SkillLevel } from "./schemas.ts";
import { loadShowcase, type ShowcaseProject } from "./showcase.ts";

/**
 * Offline stand-in for a real model (LLM_PROVIDER=mock).
 *
 * It answers from the curated gallery (data/showcase.json), picking the projects that use the
 * most of *your* parts and match your goal — so the whole pipeline (parsing, part matching,
 * pricing, constraint checks, output) can be tried without an API key.
 *
 * Like a real model it is not perfect: on the first request it ignores the skill/time limits,
 * so you can watch the app's self-check catch a project that breaks them and ask for a
 * replacement (the replacement request *does* respect the limits).
 */

const DETECTED = {
  parts: [
    { name: "Arduino Uno", qty: 1 },
    { name: "SG90 micro servo", qty: 4 },
    { name: "HC-SR04 ultrasonic sensor", qty: 1 },
    { name: "Breadboard", qty: 1 },
    { name: "Jumper wires", qty: 1 },
  ],
};

interface ParsedPrompt {
  owned: Map<string, number>;
  goal?: string;
  skill?: SkillLevel;
  maxHours?: number;
  avoid: Set<string>;
  isReplacement: boolean;
}

function parsePrompt(user: string, catalog: PartCatalog): ParsedPrompt {
  const owned = new Map<string, number>();
  const partsBlock = user.split("Parts I already have:")[1]?.split("\n\n")[0] ?? "";
  for (const m of partsBlock.matchAll(/^- (\d+) × (.+)$/gm)) {
    const key = catalog.resolve(m[2]!);
    owned.set(key, (owned.get(key) ?? 0) + Number(m[1]));
  }
  const skillMatch = user.match(/- Skill level: (\w+)/)?.[1];
  const avoidLine = user.match(/Do NOT repeat these already-suggested projects: (.+)/)?.[1];
  return {
    owned,
    goal: user.match(/- Goal \/ theme: (.+)/)?.[1]?.toLowerCase(),
    skill: SKILL_LEVELS.includes(skillMatch as SkillLevel) ? (skillMatch as SkillLevel) : undefined,
    maxHours: Number(user.match(/- Total build time: at most ([\d.]+) hours/)?.[1]) || undefined,
    avoid: new Set(avoidLine ? avoidLine.split("; ").map((s) => s.trim()) : []),
    isReplacement: !!avoidLine,
  };
}

function score(p: ShowcaseProject, prompt: ParsedPrompt, catalog: PartCatalog): number {
  const coverage =
    p.parts.reduce((sum, part) => sum + Math.min(1, (prompt.owned.get(catalog.resolve(part.name)) ?? 0) / part.qty), 0) /
    p.parts.length;
  let s = coverage;
  if (prompt.goal) {
    const words = prompt.goal.split(/\W+/).filter((w) => w.length > 3);
    const haystack = [p.title, p.summary, ...p.tags].join(" ").toLowerCase();
    s += words.filter((w) => haystack.includes(w.replace(/s$/, ""))).length * 0.25;
  }
  return s;
}

export function createMockClient(data: { catalog?: PartCatalog; showcase?: ShowcaseProject[] } = {}): LlmClient {
  let catalog: PartCatalog | undefined = data.catalog;
  return {
    label: "mock (offline, answers from the gallery)",
    async generateJson(req: JsonRequest): Promise<string> {
      const props = (req.schema as { properties?: Record<string, unknown> }).properties ?? {};
      if ("parts" in props) return JSON.stringify(DETECTED);

      catalog ??= PartCatalog.load();
      const wanted = Number((req.schema as any).properties?.projects?.minItems ?? 3);
      const prompt = parsePrompt(req.user, catalog);

      let candidates = (data.showcase ?? loadShowcase()).filter((p) => !prompt.avoid.has(p.title));
      if (prompt.isReplacement) {
        const fits = candidates.filter(
          (p) =>
            (!prompt.skill || skillRank(p.difficulty) <= skillRank(prompt.skill)) &&
            (prompt.maxHours === undefined || p.estimatedHours <= prompt.maxHours),
        );
        if (fits.length >= wanted) candidates = fits;
      }

      const picked = candidates
        .map((p) => ({ p, s: score(p, prompt, catalog!) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, wanted)
        .map(({ p: { id: _id, tags: _tags, tutorial: _t, ...project } }) => project);

      return JSON.stringify({ projects: picked });
    },
  };
}
