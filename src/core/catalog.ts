import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Part-name normalization and matching.
 *
 * The LLM and the user rarely use the same words for a part ("SG90", "9g micro servo",
 * "servo motor"). Deciding what's missing is too important to leave to the model, so we do it
 * deterministically: every name is mapped to a canonical key through an alias catalog.
 */

export interface CatalogEntry {
  key: string;
  name: string;
  priceCzk: number;
  aliases: string[];
}

interface Alias {
  key: string;
  tokens: string[];
  hasModelNumber: boolean;
}

const STOPWORDS = new Set(["a", "an", "the", "of", "and", "with", "for", "pcs", "pc", "piece", "kit", "module", "board"]);

function singularize(token: string): string {
  // Leave model numbers ("gps", "hc-sr04", "18650") and short tokens alone.
  if (/\d/.test(token) || token.length <= 3) return token;
  if (token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (/(ss|x|ch|sh)es$/.test(token)) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/** Lowercase, strip punctuation, drop filler words, singularize. Returns tokens. */
export function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[“”"'()[\]{},;:!?/\\|*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .map(singularize);
}

export class PartCatalog {
  private readonly entries = new Map<string, CatalogEntry>();
  private readonly aliases: Alias[] = [];

  constructor(entries: CatalogEntry[]) {
    for (const e of entries) {
      this.entries.set(e.key, e);
      for (const a of [e.name, ...e.aliases]) {
        const tokens = tokenize(a);
        if (tokens.length === 0) continue;
        this.aliases.push({ key: e.key, tokens, hasModelNumber: tokens.some((t) => /\d/.test(t)) });
      }
    }
  }

  static load(path = defaultCatalogPath()): PartCatalog {
    const raw = JSON.parse(readFileSync(path, "utf8")) as { parts: CatalogEntry[] };
    return new PartCatalog(raw.parts);
  }

  get(key: string): CatalogEntry | undefined {
    return this.entries.get(key);
  }

  /** Canonical names with prices, handed to the LLM so it uses names we can match and knows rough costs. */
  promptList(): string[] {
    return [...this.entries.values()].map((e) => `${e.name} (~${e.priceCzk} CZK)`);
  }

  /**
   * Map any part name to a canonical key.
   * Picks the catalog alias whose tokens are all present in the name, preferring
   * (1) more tokens, (2) model numbers like "sg90" over generic words like "servo",
   * (3) aliases ending in the same head noun ("motor driver" beats "dc motor" for "dc motor driver").
   * Unknown parts fall back to their normalized text, so two unknown names still match each other.
   */
  resolve(name: string): string {
    const tokens = tokenize(name);
    if (tokens.length === 0) return name.trim().toLowerCase();
    const tokenSet = new Set(tokens);
    const head = tokens[tokens.length - 1];

    let best: { key: string; score: number; len: number } | undefined;
    for (const alias of this.aliases) {
      if (!alias.tokens.every((t) => tokenSet.has(t))) continue;
      const score =
        alias.tokens.length * 10 + (alias.hasModelNumber ? 30 : 0) + (alias.tokens[alias.tokens.length - 1] === head ? 5 : 0);
      const len = alias.tokens.join(" ").length;
      if (!best || score > best.score || (score === best.score && len > best.len)) {
        best = { key: alias.key, score, len };
      }
    }
    return best ? best.key : tokens.join(" ");
  }
}

function defaultCatalogPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "data", "parts-catalog.json");
}
