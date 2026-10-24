import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import { PartCatalog } from "../core/catalog.ts";
import { ConfigError, loadEnv, readConfig } from "../core/config.ts";
import { detectParts, enrichProject, InvalidOutputError, suggestProjects } from "../core/generate.ts";
import { illustrateProject } from "../core/illustrate.ts";
import { parseInventory } from "../core/inventory.ts";
import { createClient } from "../core/llm.ts";
import { HttpError } from "../core/retry.ts";
import { ConstraintsSchema, type Project } from "../core/schemas.ts";
import { loadShowcase } from "../core/showcase.ts";

/** Minimal web UI: one static page + a few JSON endpoints, no framework. */

loadEnv();
const config = (() => {
  try {
    return readConfig();
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(`✗ ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
})();
const log = (msg: string) => console.log(msg);
const client = createClient(config, log);
const catalog = PartCatalog.load();
const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");

const MAX_BODY = 10 * 1024 * 1024; // photos are sent as base64

const SuggestBody = z.object({ parts: z.string().max(5000), constraints: ConstraintsSchema });
const GalleryBody = z.object({ parts: z.string().max(5000).default("") });

const withPicture = (p: Project, showStatus = true) => ({ ...p, svg: illustrateProject(p, { showStatus }) });
const DetectBody = z.object({
  image: z.string().regex(/^data:image\/(jpeg|png|webp|gif);base64,/, "image must be a JPEG, PNG, WebP or GIF data URL"),
});

class BadRequest extends Error {}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new BadRequest("Request too large (max 10 MB).");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new BadRequest("Body must be JSON.");
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new BadRequest(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return r.data;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }
    if (req.method === "GET" && req.url === "/api/info") {
      return send(res, 200, { model: client.label });
    }
    if (req.method === "POST" && req.url === "/api/suggest") {
      const body = parse(SuggestBody, await readJson(req));
      const inventory = parseInventory(body.parts, catalog);
      if (inventory.length === 0) throw new BadRequest("Add at least one part.");
      const result = await suggestProjects({ inventory, constraints: body.constraints }, { client, catalog, log });
      return send(res, 200, { inventory, ...result, projects: result.projects.map((p) => withPicture(p)), model: client.label });
    }
    if (req.method === "POST" && req.url === "/api/gallery") {
      // Curated examples, checked against whatever is in the parts box (may be empty).
      const { parts } = parse(GalleryBody, await readJson(req));
      const inventory = parseInventory(parts, catalog);
      const has = inventory.length > 0;
      const projects = loadShowcase().map((sp) => {
        const p = enrichProject(sp, inventory, {}, catalog);
        if (!has) p.checks = [];
        return { id: sp.id, tags: sp.tags, tutorial: sp.tutorial, ...withPicture(p, has) };
      });
      if (has) projects.sort((a, b) => b.coverage - a.coverage);
      return send(res, 200, { projects, checkedAgainstParts: has });
    }
    if (req.method === "POST" && req.url === "/api/detect") {
      const { image } = parse(DetectBody, await readJson(req));
      const [, mediaType, base64] = image.match(/^data:(image\/\w+);base64,(.*)$/s)!;
      const parts = await detectParts({ mediaType: mediaType as "image/jpeg", base64: base64! }, { client, log });
      return send(res, 200, { parts });
    }
    send(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    if (err instanceof BadRequest) return send(res, 400, { error: err.message });
    if (err instanceof HttpError) {
      const hint = err.status === 401 ? " (check the API key)" : "";
      return send(res, 502, { error: `Upstream LLM error: ${err.message}${hint}` });
    }
    if (err instanceof InvalidOutputError) return send(res, 502, { error: err.message });
    send(res, 500, { error: err instanceof Error ? err.message : "Internal error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`PartsBin web UI on http://localhost:${port}  (model: ${client.label})`);
});

