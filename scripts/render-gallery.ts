/**
 * Writes the pictures used by the README and tutorials:
 *   docs/images/gallery/<id>.svg            one parts picture per gallery project
 *   docs/images/examples/rfid-lock-vs-starter-kit.svg   owned/missing example
 *
 * Run:  npm run gallery:images
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PartCatalog } from "../src/core/catalog.ts";
import { enrichProject } from "../src/core/generate.ts";
import { illustrateProject } from "../src/core/illustrate.ts";
import { parseInventory } from "../src/core/inventory.ts";
import { loadShowcase } from "../src/core/showcase.ts";

const catalog = PartCatalog.load();
const galleryDir = join("docs", "images", "gallery");
const examplesDir = join("docs", "images", "examples");
mkdirSync(galleryDir, { recursive: true });
mkdirSync(examplesDir, { recursive: true });

for (const sp of loadShowcase()) {
  const project = enrichProject(sp, [], {}, catalog);
  const file = join(galleryDir, `${sp.id}.svg`);
  writeFileSync(file, illustrateProject(project, { showStatus: false }));
  console.log(file);
}

const starterKit = parseInventory("arduino uno, sg90 servo, 1x led, resistor, breadboard, jumper wires", catalog);
const lock = loadShowcase().find((p) => p.id === "rfid-lock")!;
const example = join(examplesDir, "rfid-lock-vs-starter-kit.svg");
writeFileSync(example, illustrateProject(enrichProject(lock, starterKit, {}, catalog)));
console.log(example);
