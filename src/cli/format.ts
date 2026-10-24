import type { Project, SuggestResult } from "../core/schemas.ts";

const useColor = !process.env.NO_COLOR && (process.stdout.isTTY || !!process.env.FORCE_COLOR);
const paint = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
export const c = {
  bold: paint("1"),
  dim: paint("2"),
  red: paint("31"),
  green: paint("32"),
  yellow: paint("33"),
  cyan: paint("36"),
};

function wrap(text: string, width: number, indent: string): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > width) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i === 0 ? l : indent + l)).join("\n");
}

const czk = (n: number) => `${Math.round(n).toLocaleString("cs-CZ")} CZK`;

export function formatProject(p: Project, index: number, opts: { numbered?: boolean } = {}): string {
  const out: string[] = [];
  const width = Math.min(process.stdout.columns || 100, 100);

  const header = opts.numbered === false ? ` ${p.title} ` : ` ${index + 1}. ${p.title} `;
  out.push(c.bold(c.cyan(`━━━${header}${"━".repeat(Math.max(3, width - header.length - 3))}`)));
  out.push(wrap(p.summary, width, ""));

  const toBuy = p.missingCostCzk > 0 ? `~${czk(p.missingCostCzk)} to buy` : "nothing priced to buy";
  const unpriced = p.unpricedMissing.length ? ` (+ ${p.unpricedMissing.length} household item${p.unpricedMissing.length > 1 ? "s" : ""})` : "";
  out.push(
    c.dim(
      `${p.difficulty} · ~${p.estimatedHours} h · ${p.requiresSoldering ? "needs soldering" : "solderless"} · ` +
        `you own ${Math.round(p.coverage * 100)}% of the parts · ${toBuy}${unpriced}`,
    ),
  );

  out.push("", c.bold("Parts"));
  for (const part of p.parts) {
    const label = `${part.qty}× ${part.name}`;
    const purpose = part.purpose ? c.dim(` — ${part.purpose}`) : "";
    const price = part.unitPriceCzk !== undefined ? ` (~${czk(part.missing * part.unitPriceCzk)})` : "";
    if (part.missing === 0) out.push(`  ${c.green("✓")} ${label}${purpose}`);
    else if (part.have === 0) out.push(`  ${c.red("✗")} ${label} ${c.red("MISSING")}${price}${purpose}`);
    else out.push(`  ${c.yellow("◐")} ${label} ${c.yellow(`have ${part.have}, MISSING ${part.missing}`)}${price}${purpose}`);
  }

  out.push("", c.bold("Steps"));
  p.steps.forEach((s, i) => {
    const prefix = `  ${String(i + 1).padStart(2)}. `;
    out.push(prefix + wrap(`${c.bold(s.title)} — ${s.detail}`, width - prefix.length, " ".repeat(prefix.length)));
  });

  if (p.safetyNotes.length) {
    out.push("", c.bold("Safety"));
    for (const n of p.safetyNotes) out.push(`  ${c.yellow("!")} ${wrap(n, width - 4, "    ")}`);
  }

  if (p.checks.length) {
    out.push(
      "",
      `${c.bold("Checks")}  ` + p.checks.map((ch) => (ch.ok ? c.green(`✓ ${ch.name}`) : c.red(`✗ ${ch.name} (${ch.detail})`))).join("  "),
    );
  }
  return out.join("\n");
}

export function formatResult(result: SuggestResult, model: string): string {
  const parts = result.projects.map((p, i) => formatProject(p, i));
  const footer: string[] = [];
  for (const n of result.notes) footer.push(c.dim(`• ${n}`));
  footer.push(c.dim(`Model: ${model} · ${result.llmCalls} LLM call${result.llmCalls === 1 ? "" : "s"}`));
  return [...parts, footer.join("\n")].join("\n\n");
}

export function shoppingListMarkdown(result: SuggestResult): string {
  const lines = ["# Shopping list", "", "Indicative prices in CZK — check your supplier.", ""];
  result.projects.forEach((p, i) => {
    const missing = p.parts.filter((x) => x.missing > 0);
    lines.push(`## ${i + 1}. ${p.title}`, "");
    if (missing.length === 0) {
      lines.push("You already have everything. 🎉", "");
      return;
    }
    for (const m of missing) {
      const price = m.unitPriceCzk !== undefined ? `~${m.missing * m.unitPriceCzk} CZK` : "price n/a";
      lines.push(`- [ ] ${m.missing}× ${m.name} — ${price}`);
    }
    lines.push("", `**Total:** ~${p.missingCostCzk} CZK${p.unpricedMissing.length ? " + household items" : ""}`, "");
  });
  return lines.join("\n");
}
