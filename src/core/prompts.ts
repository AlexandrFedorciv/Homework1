import type { Constraints, InventoryItem } from "./schemas.ts";

export const PROJECT_SYSTEM_PROMPT = `You are an experienced maker mentor who designs small electronics, home-network and security gadgets for hobbyists.

Given the parts a person already owns and their constraints, propose distinct, genuinely buildable projects.

Rules:
- Use as many of the person's own parts as makes sense: the goal is to build with what they have and buy little.
- The "parts" list must contain EVERY part the build needs, including the ones they already own. Do not list tools (soldering iron, screwdriver, computer) as parts. Cheap household materials (cardboard, tape, hot glue sticks) may be listed.
- For parts they own, reuse their exact wording. For other parts, prefer the common names given in the prompt.
- Quantities must be exact (e.g. a 4-legged walker needs 4 servos).
- Steps must be concrete: wiring with pin numbers, what the code does, calibration and how to test. Aim for 5-9 steps.
- estimatedHours is a realistic total for someone at the stated skill level, including debugging.
- Respect every constraint. If no soldering is possible, use only solderless connections (breadboard, jumper wires, screw terminals).
- Never propose mains-voltage (230 V / 110 V AC) wiring unless the skill level is "advanced".
- Security projects must protect the user's own network, devices, accounts or spaces (ad blocking, VPN, 2FA, locks, alarms). Never propose tools for attacking, intercepting or disrupting other people's networks or devices.
- Add safety notes where relevant (Li-ion/LiPo handling, servo current draw, hot glue, sharp edges).
- The projects must differ from each other in what they do, not just in which parts they use.`;

export function buildProjectPrompt(opts: {
  inventory: InventoryItem[];
  constraints: Constraints;
  catalogNames: string[];
  count: number;
  avoidTitles?: string[];
  feedback?: string[];
}): string {
  const { inventory, constraints: c, catalogNames, count, avoidTitles = [], feedback = [] } = opts;
  const lines: string[] = [];

  lines.push(`Propose exactly ${count} project${count === 1 ? "" : "s"}.`, "");
  lines.push("Parts I already have:");
  lines.push(...inventory.map((i) => `- ${i.qty} × ${i.raw}`), "");

  lines.push("Constraints:");
  const cons: string[] = [];
  if (c.goal) cons.push(`- Goal / theme: ${c.goal}`);
  if (c.skill) cons.push(`- Skill level: ${c.skill} (difficulty must be at or below this)`);
  if (c.maxHours !== undefined) cons.push(`- Total build time: at most ${c.maxHours} hours`);
  if (c.budget !== undefined) cons.push(`- Budget for parts I'd need to buy: at most ${c.budget} CZK (use the price hints below)`);
  if (c.canSolder === false) cons.push("- I cannot solder: solderless builds only");
  if (c.canSolder === true) cons.push("- Soldering is fine");
  lines.push(...(cons.length ? cons : ["- none (surprise me, but keep it practical)"]), "");

  lines.push(`Common part names with indicative prices (use these names for parts I don't own): ${catalogNames.join("; ")}`, "");

  if (avoidTitles.length) {
    lines.push(`Do NOT repeat these already-suggested projects: ${avoidTitles.join("; ")}`, "");
  }
  if (feedback.length) {
    lines.push("Previous suggestions were rejected for these reasons — make sure the new ones avoid them:");
    lines.push(...feedback.map((f) => `- ${f}`), "");
  }
  return lines.join("\n").trim();
}

export const DETECT_SYSTEM_PROMPT = `You identify electronic components in photos of a hobbyist's parts bin.

- List only components you can actually see. Do not guess hidden items.
- Use the common hobby name, with the model number when it is legible or the part is unmistakable (e.g. "SG90 micro servo", "HC-SR04 ultrasonic sensor", "Arduino Uno").
- Count identical items and report the quantity.
- Ignore tools, packaging and furniture.`;

export const DETECT_USER_PROMPT = "Which electronic components are in this photo? Return them as a parts list.";
