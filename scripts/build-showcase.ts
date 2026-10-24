/**
 * Builds the self-contained showcase page (dist/showcase/index.html):
 * the core pipeline compiled for the browser with esbuild, injected into showcase/page.html.
 *
 * Run:  npm run build:showcase
 */
import { build, type Plugin } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The core modules import node:fs/url/path only for loading files in Node — functions the
// browser build never calls. Replace those imports with empty stubs.
const nodeStubs: Plugin = {
  name: "node-stubs",
  setup(b) {
    b.onResolve({ filter: /^node:/ }, (args) => ({ path: args.path, namespace: "node-stub" }));
    b.onLoad({ filter: /.*/, namespace: "node-stub" }, () => ({
      contents: `const unavailable = () => { throw new Error("not available in the browser"); };
        export const readFileSync = unavailable, existsSync = () => false, fileURLToPath = unavailable,
          dirname = unavailable, join = unavailable;`,
      loader: "js",
    }));
  },
};

const result = await build({
  entryPoints: ["src/browser/main.ts"],
  bundle: true,
  format: "iife",
  globalName: "PartsBin",
  platform: "browser",
  target: "es2020",
  minify: true,
  write: false,
  plugins: [nodeStubs],
  logOverride: { "empty-import-meta": "silent" },
});
const bundle = result.outputFiles[0]!.text.replace(/<\/script/gi, "<\\/script");

const testNames = readdirSync("test")
  .filter((f) => f.endsWith(".test.ts"))
  .flatMap((f) => [...readFileSync(join("test", f), "utf8").matchAll(/^test\("([^"]+)"/gm)].map((m) => m[1]!));
const catalog = JSON.parse(readFileSync("data/parts-catalog.json", "utf8")) as { parts: unknown[] };
const showcase = JSON.parse(readFileSync("data/showcase.json", "utf8")) as { projects: unknown[] };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const page = readFileSync("showcase/page.html", "utf8")
  .replace("%%TEST_COUNT%%", String(testNames.length))
  .replace("%%TEST_LIST%%", testNames.map((n) => `<li>${esc(n)}</li>`).join(""))
  .replace("%%CATALOG_PARTS%%", String(catalog.parts.length))
  .replace("%%GALLERY_PROJECTS%%", String(showcase.projects.length))
  .replace("%%BUNDLE%%", () => bundle);

const out = join("dist", "showcase");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "index.html"), page);
copyFileSync("docs/images/screenshots/cli-results.png", join(out, "cli-results.png"));
console.log(`${join(out, "index.html")}  (${(page.length / 1024).toFixed(0)} KB, ${testNames.length} tests listed)`);
