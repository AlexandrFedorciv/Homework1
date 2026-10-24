import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import { LlmProjectSchema } from "./schemas.ts";

/** Curated example projects (data/showcase.json): the gallery, and the offline mock's answers. */

export const ShowcaseProjectSchema = LlmProjectSchema.extend({
  id: z.string().regex(/^[a-z0-9-]+$/),
  tags: z.array(z.string()).default([]),
  /** Repo-relative path to a step-by-step tutorial, if there is one. */
  tutorial: z.string().optional(),
});
export type ShowcaseProject = z.infer<typeof ShowcaseProjectSchema>;

let cache: ShowcaseProject[] | undefined;

export function loadShowcase(path = defaultPath()): ShowcaseProject[] {
  if (cache && path === defaultPath()) return cache;
  const raw = JSON.parse(readFileSync(path, "utf8")) as { projects: unknown[] };
  const projects = z.array(ShowcaseProjectSchema).parse(raw.projects);
  const ids = new Set<string>();
  for (const p of projects) {
    if (ids.has(p.id)) throw new Error(`Duplicate showcase id "${p.id}"`);
    ids.add(p.id);
  }
  if (path === defaultPath()) cache = projects;
  return projects;
}

export function findShowcase(id: string): ShowcaseProject | undefined {
  return loadShowcase().find((p) => p.id === id);
}

function defaultPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "showcase.json");
}
