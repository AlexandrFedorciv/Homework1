/**
 * Browser build of PartsBin (used by the hosted showcase page, see scripts/build-showcase.ts).
 *
 * It runs the exact same pipeline as the CLI — parsing, part matching, the repair loop,
 * constraint checks + regeneration, illustrations — but talks to Claude through the
 * hosting page's `sample` capability instead of an HTTP API key.
 */
import catalogData from "../../data/parts-catalog.json" with { type: "json" };
import showcaseData from "../../data/showcase.json" with { type: "json" };
import photoData from "../../data/photos.json" with { type: "json" };
import { PartCatalog, type CatalogEntry } from "../core/catalog.ts";
import { detectParts, enrichProject, suggestProjects } from "../core/generate.ts";
import { illustrateProject, partIconSvg } from "../core/illustrate.ts";
import { parseInventory } from "../core/inventory.ts";
import type { JsonRequest, LlmClient } from "../core/llm.ts";
import { createMockClient } from "../core/mock.ts";
import { HttpError, withRetry } from "../core/retry.ts";
import { ConstraintsSchema, type Constraints, type Project } from "../core/schemas.ts";
import { parseShowcase } from "../core/showcase.ts";

const catalog = new PartCatalog((catalogData as { parts: CatalogEntry[] }).parts);
const showcase = parseShowcase(showcaseData as { projects: unknown[] });
const mock = createMockClient({ catalog, showcase });

/** An openly licensed photo with its credit (see data/photos.json). */
export interface Photo {
  file: string;
  title?: string;
  credit: string;
  license: string;
  licenseUrl?: string;
  source: string;
}
const photos = photoData as unknown as { parts: Record<string, Photo>; projects: Record<string, Photo> };
const idByTitle = new Map(showcase.map((p) => [p.title, p.id]));

/** Add what the interactive page needs: a picture per part, a photo of a similar finished build. */
function decorate<T extends Project>(p: T, galleryId?: string) {
  const id = galleryId ?? idByTitle.get(p.title);
  return {
    ...p,
    galleryId: id,
    photo: id ? photos.projects[id] : undefined,
    parts: p.parts.map((x) => ({ ...x, icon: partIconSvg(x.key, x.name), photo: photos.parts[x.key] })),
  };
}
/** Minimal shape of the page's `sample` capability (see the artifact runtime docs). */
type SampleFn = ((input: string, opts?: Record<string, unknown>) => Promise<{ text: string; truncated: boolean }>) & {
  limits(): Promise<{ images?: { maxCount: number; mediaTypes: string[] } }>;
};
interface SampleError {
  code: string;
  message: string;
  text?: string;
}
const isSampleError = (e: unknown): e is SampleError => !!e && typeof e === "object" && "code" in e;

/** Errors the UI should explain instead of showing a stack. */
export class FriendlyError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const FRIENDLY: Record<string, string> = {
  not_granted: "Claude access wasn't allowed for this page. Switch to the offline demo, or allow it from the page's permissions.",
  sampling_disabled: "Claude isn't available for this account here. The offline demo still works.",
  rate_limited: "Too many requests right now. Wait a minute and try again.",
  session_expired: "Your Claude session expired. Sign in again and retry.",
  refused: "Claude declined this request. Try a different parts list or goal.",
  image_rejected: "That photo couldn't be used. Try a JPG or PNG under 20 MB.",
  images_unavailable: "Photo detection isn't available in this view. Type your parts instead.",
};

/**
 * LlmClient backed by the page's `sample` capability.
 * Prompts include the JSON Schema; the pipeline's zod validation + repair loop does the rest.
 * Transient `upstream_error`s get ONE automatic retry with backoff (the same withRetry used by the CLI);
 * everything else is surfaced to the viewer, as the platform asks.
 */
export function createSampleClient(sample: SampleFn, log: (m: string) => void, signal?: AbortSignal): LlmClient {
  return {
    label: "Claude (via this page)",
    async generateJson(req: JsonRequest): Promise<string> {
      const prompt =
        `${req.system}\n\n---\n\n${req.user}\n\n---\n\n` +
        `Reply with ONLY one JSON object (no prose, no code fence) that matches this JSON Schema:\n${JSON.stringify(req.schema)}`;
      const images = req.image ? [base64ToBlob(req.image.base64, req.image.mediaType)] : undefined;

      return withRetry(
        async () => {
          try {
            const { text } = await sample(prompt, { modelTier: "default", ...(images ? { images } : {}), ...(signal ? { signal } : {}) });
            return stripFence(text);
          } catch (e) {
            if (!isSampleError(e)) throw e;
            if (e.code === "upstream_error") throw new HttpError(503, "Claude had a temporary problem");
            if (e.code === "cancelled") throw new FriendlyError("Stopped.", "cancelled");
            throw new FriendlyError(FRIENDLY[e.code] ?? `Claude error: ${e.message}`, e.code);
          }
        },
        { retries: 1, baseDelayMs: 1500, onRetry: ({ delayMs }) => log(`⚠ temporary error from Claude, retrying in ${(delayMs / 1000).toFixed(1)} s`) },
      );
    },
  };
}

function stripFence(text: string): string {
  const t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) return fence[1]!;
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  return first >= 0 && last > first ? t.slice(first, last + 1) : t;
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

// ---------------------------------------------------------------------------
// API used by the page
// ---------------------------------------------------------------------------

export type Mode = "claude" | "demo";

export async function suggest(opts: {
  parts: string;
  constraints: unknown;
  mode: Mode;
  sample?: SampleFn | null;
  log: (m: string) => void;
  signal?: AbortSignal;
}) {
  const parsed = ConstraintsSchema.safeParse(opts.constraints);
  if (!parsed.success) throw new FriendlyError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "bad_input");
  const constraints: Constraints = parsed.data;
  const inventory = parseInventory(opts.parts, catalog);
  if (inventory.length === 0) throw new FriendlyError("Add at least one part.", "bad_input");

  const client = opts.mode === "claude" && opts.sample ? createSampleClient(opts.sample, opts.log, opts.signal) : mock;
  opts.log(`🛠 asking ${client.label} for 3 projects using ${inventory.length} part type(s)…`);
  const result = await suggestProjects({ inventory, constraints }, { client, catalog, log: opts.log });
  return {
    inventory,
    ...result,
    model: client.label,
    projects: result.projects.map((p) => decorate({ ...p, svg: illustrateProject(p) })),
  };
}

export async function detect(opts: { file: Blob; mode: Mode; sample?: SampleFn | null; log: (m: string) => void }) {
  const client = opts.mode === "claude" && opts.sample ? createSampleClient(opts.sample, opts.log) : mock;
  const buf = new Uint8Array(await opts.file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const mediaType = (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(opts.file.type) ? opts.file.type : "image/jpeg") as "image/jpeg";
  return detectParts({ mediaType, base64: btoa(bin) }, { client, log: opts.log });
}

export function gallery(parts: string) {
  const inventory = parseInventory(parts, catalog);
  const has = inventory.length > 0;
  const projects = showcase.map((sp) => {
    const p: Project = enrichProject(sp, inventory, {}, catalog);
    if (!has) p.checks = [];
    return { id: sp.id, tags: sp.tags, tutorial: sp.tutorial, ...decorate({ ...p, svg: illustrateProject(p, { showStatus: has }) }, sp.id) };
  });
  if (has) projects.sort((a, b) => b.coverage - a.coverage);
  return { projects, checkedAgainstParts: has };
}

/** Shopping list from the page's current state (parts the viewer marked as owned are left out). */
export function shoppingList(projects: Project[]): string {
  const lines = ["# Shopping list", "", "Indicative prices in CZK — check your supplier.", ""];
  projects.forEach((p, i) => {
    lines.push(`## ${i + 1}. ${p.title}`, "");
    const missing = p.parts.filter((x) => x.missing > 0);
    if (!missing.length) lines.push("You already have everything.");
    for (const m of missing) lines.push(`- [ ] ${m.missing}× ${m.name} — ${m.unitPriceCzk !== undefined ? `~${m.missing * m.unitPriceCzk} CZK` : "price n/a"}`);
    lines.push("");
  });
  return lines.join("\n");
}

export const stats = { catalogParts: (catalogData as { parts: unknown[] }).parts.length, galleryProjects: showcase.length };
