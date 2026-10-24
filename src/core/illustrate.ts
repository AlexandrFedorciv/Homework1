/**
 * "Flat-lay" illustrations of a project's parts, generated as SVG.
 *
 * Every part gets a small drawing of the component (board, servo, sensor, LED strip, …),
 * its quantity, and — when we know the user's inventory — whether they own it or need to buy it.
 * Works for curated gallery projects *and* for projects the LLM just invented, because the icon
 * is chosen from the part's canonical key (see catalog.ts), with a fallback by name.
 */

export interface IllustratedPart {
  key: string;
  name: string;
  qty: number;
  have?: number;
  missing?: number;
  unitPriceCzk?: number;
}

export interface IllustrationOptions {
  title: string;
  subtitle?: string;
  parts: IllustratedPart[];
  /** Mark owned / missing parts. Off for gallery previews where we don't know the inventory. */
  showStatus?: boolean;
  columns?: number;
}

const C = {
  paper: "#f4f1ea",
  grid: "#e6e1d5",
  ink: "#1d1f22",
  muted: "#6b6a66",
  accent: "#e8590c",
  ok: "#2b8a3e",
  bad: "#c92a2a",
  warn: "#c77700",
  pcbGreen: "#2f7d4f",
  pcbBlue: "#2a5ea8",
  pcbRed: "#b23a3a",
  pcbBlack: "#2b2b2b",
  pcbPurple: "#5b3f8f",
  servo: "#3b7dd8",
  yellow: "#f2c230",
  metal: "#c3c6cc",
  white: "#ffffff",
  tan: "#d9b382",
};

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const S = `stroke="${C.ink}" stroke-width="1.5" stroke-linejoin="round"`;

// ---------------------------------------------------------------------------
// Icons — each draws inside a 90 × 64 box
// ---------------------------------------------------------------------------

const pins = (x0: number, x1: number, y: number) => {
  let s = "";
  for (let x = x0; x <= x1; x += 6) s += `<rect x="${x}" y="${y}" width="3.5" height="3.5" fill="${C.ink}"/>`;
  return s;
};

const legs = (xs: number[], y0: number, y1: number) =>
  xs.map((x) => `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="${C.metal}" stroke-width="2"/>`).join("");

function board(color = C.pcbGreen, small = false): string {
  const [x, w] = small ? [17, 56] : [5, 80];
  return `<rect x="${x}" y="8" width="${w}" height="48" rx="4" fill="${color}" ${S}/>
    ${pins(x + 7, x + w - 9, 11)}${pins(x + 7, x + w - 9, 49.5)}
    <rect x="${x + w / 2 - 11}" y="24" width="22" height="16" rx="1.5" fill="${C.pcbBlack}"/>
    <rect x="${x - 4}" y="26" width="11" height="12" rx="1.5" fill="${C.metal}" ${S}/>
    <circle cx="${x + w - 10}" cy="32" r="2.5" fill="${C.yellow}"/>`;
}

function camera(): string {
  return `${board(C.pcbBlack, true)}<circle cx="45" cy="32" r="12" fill="${C.ink}" ${S}/><circle cx="45" cy="32" r="6" fill="#3d5a80"/><circle cx="42" cy="29" r="1.8" fill="${C.white}"/>`;
}

function servo(color = C.servo): string {
  return `<rect x="8" y="27" width="74" height="8" rx="2" fill="${color}" ${S}/>
    <rect x="18" y="18" width="54" height="32" rx="3" fill="${color}" ${S}/>
    <circle cx="8" cy="31" r="2" fill="${C.paper}"/><circle cx="82" cy="31" r="2" fill="${C.paper}"/>
    <rect x="22" y="11" width="30" height="7" rx="3.5" fill="${C.white}" ${S}/>
    <circle cx="33" cy="17" r="6" fill="${C.white}" ${S}/>
    <path d="M60 50 C 64 58, 74 60, 86 60" fill="none" stroke="#a0522d" stroke-width="2"/>
    <path d="M62 50 C 66 56, 76 57, 86 57" fill="none" stroke="#e03131" stroke-width="2"/>
    <path d="M64 50 C 68 54, 78 54, 86 54" fill="none" stroke="#f08c00" stroke-width="2"/>`;
}

function stepper(): string {
  return `<rect x="58" y="22" width="26" height="22" rx="2" fill="${C.white}" ${S}/>
    <circle cx="38" cy="33" r="24" fill="${C.metal}" ${S}/><circle cx="38" cy="33" r="16" fill="#adb1b8"/>
    <rect x="35" y="2" width="6" height="12" fill="${C.metal}" ${S}/>`;
}

function dcMotor(): string {
  return `<rect x="8" y="18" width="52" height="28" rx="4" fill="${C.yellow}" ${S}/>
    <rect x="18" y="12" width="10" height="6" fill="${C.yellow}" ${S}/>
    <rect x="60" y="28" width="12" height="8" fill="${C.white}" ${S}/>
    <circle cx="20" cy="32" r="4" fill="${C.white}" ${S}/>
    <line x1="2" y1="26" x2="8" y2="26" stroke="#e03131" stroke-width="2"/><line x1="2" y1="38" x2="8" y2="38" stroke="${C.ink}" stroke-width="2"/>`;
}

function wheel(): string {
  return `<circle cx="45" cy="32" r="27" fill="${C.pcbBlack}" ${S}/><circle cx="45" cy="32" r="17" fill="${C.yellow}" ${S}/>
    <circle cx="45" cy="32" r="4" fill="${C.white}" ${S}/>
    ${[0, 60, 120, 180, 240, 300].map((a) => `<line x1="45" y1="32" x2="${45 + 15 * Math.cos((a * Math.PI) / 180)}" y2="${32 + 15 * Math.sin((a * Math.PI) / 180)}" stroke="${C.ink}" stroke-width="1"/>`).join("")}`;
}

function chassis(): string {
  let holes = "";
  for (let x = 20; x <= 70; x += 10) holes += `<circle cx="${x}" cy="22" r="2" fill="${C.paper}" ${S}/><circle cx="${x}" cy="40" r="2" fill="${C.paper}" ${S}/>`;
  return `<rect x="0" y="14" width="10" height="36" rx="3" fill="${C.pcbBlack}"/><rect x="80" y="14" width="10" height="36" rx="3" fill="${C.pcbBlack}"/>
    <rect x="9" y="8" width="72" height="48" rx="10" fill="#f5d97a" fill-opacity="0.85" ${S}/>${holes}
    <circle cx="45" cy="31" r="5" fill="${C.metal}" ${S}/>`;
}

function driver(color = C.pcbRed): string {
  let fins = "";
  for (let x = 32; x <= 58; x += 5) fins += `<rect x="${x}" y="2" width="2.5" height="22" fill="${C.ink}"/>`;
  return `<rect x="5" y="14" width="80" height="44" rx="3" fill="${color}" ${S}/>${fins}
    <rect x="30" y="20" width="31" height="6" fill="${C.ink}"/>
    <rect x="7" y="22" width="12" height="18" fill="#3b82c4" ${S}/><rect x="71" y="22" width="12" height="18" fill="#3b82c4" ${S}/>
    <rect x="33" y="44" width="24" height="10" fill="#3b82c4" ${S}/>`;
}

function relay(): string {
  return `<rect x="5" y="18" width="80" height="40" rx="3" fill="${C.pcbBlue}" ${S}/>
    <rect x="34" y="6" width="42" height="36" rx="2" fill="#1f4fa0" ${S}/>
    <text x="55" y="27" font-size="7" fill="${C.white}" text-anchor="middle" font-family="monospace">5V</text>
    <rect x="8" y="26" width="20" height="22" fill="#3b82c4" ${S}/>
    <circle cx="13" cy="31" r="2" fill="${C.metal}"/><circle cx="13" cy="38" r="2" fill="${C.metal}"/><circle cx="13" cy="45" r="2" fill="${C.metal}"/>
    <circle cx="70" cy="52" r="2.5" fill="#e03131"/>`;
}

function ultrasonic(): string {
  const eye = (cx: number) =>
    `<circle cx="${cx}" cy="30" r="16" fill="${C.metal}" ${S}/><circle cx="${cx}" cy="30" r="11" fill="#55595f"/>
     <path d="M${cx - 8} 26 h16 M${cx - 9} 30 h18 M${cx - 8} 34 h16" stroke="#7b8088" stroke-width="1"/>`;
  return `<rect x="2" y="8" width="86" height="46" rx="3" fill="${C.pcbBlue}" ${S}/>${eye(24)}${eye(66)}
    <rect x="40" y="12" width="10" height="6" rx="1" fill="${C.metal}"/>${legs([36, 42, 48, 54], 54, 62)}`;
}

function sensor(color = C.pcbBlue, chip = C.pcbBlack): string {
  return `<rect x="20" y="10" width="50" height="38" rx="3" fill="${color}" ${S}/>
    <rect x="36" y="20" width="18" height="14" rx="1.5" fill="${chip}"/>
    <circle cx="26" cy="16" r="2" fill="${C.paper}"/><circle cx="64" cy="16" r="2" fill="${C.paper}"/>
    ${legs([33, 40, 47, 54], 48, 60)}`;
}

function grillSensor(color: string): string {
  let slots = "";
  for (let y = 16; y <= 40; y += 6) slots += `<rect x="33" y="${y}" width="24" height="3" rx="1" fill="${C.ink}" fill-opacity="0.45"/>`;
  return `<rect x="28" y="8" width="34" height="42" rx="3" fill="${color}" ${S}/>${slots}${legs([37, 43, 49, 55], 50, 62)}`;
}

function pir(): string {
  return `<rect x="16" y="38" width="58" height="20" rx="2" fill="${C.pcbGreen}" ${S}/>
    <path d="M22 38 A23 23 0 0 1 68 38 Z" fill="${C.white}" ${S}/>
    <path d="M30 38 A15 23 0 0 1 45 15 M60 38 A15 23 0 0 0 45 15 M45 15 V38" fill="none" stroke="${C.ink}" stroke-width="0.8" stroke-opacity="0.5"/>`;
}

function soil(): string {
  return `<path d="M30 4 H60 V48 L45 62 L30 48 Z" fill="${C.pcbBlack}" ${S}/>
    <rect x="35" y="8" width="20" height="10" rx="1" fill="${C.metal}"/>
    <line x1="38" y1="28" x2="52" y2="28" stroke="${C.white}" stroke-width="1" stroke-opacity="0.6"/>
    <line x1="38" y1="34" x2="52" y2="34" stroke="${C.white}" stroke-width="1" stroke-opacity="0.6"/>`;
}

function ldr(): string {
  return `<circle cx="45" cy="22" r="14" fill="#e9c46a" ${S}/>
    <path d="M37 16 h16 M37 20 h16 M37 24 h16 M37 28 h16" stroke="#c0392b" stroke-width="1.6"/>${legs([40, 50], 36, 62)}`;
}

function display(kind: "oled" | "lcd"): string {
  const [x, w, screen, textColor] = kind === "oled" ? [18, 54, "#0b1a2b", "#5ad1ff"] : [2, 86, "#9bd34a", "#24411a"];
  return `<rect x="${x}" y="8" width="${w}" height="48" rx="3" fill="${C.pcbBlue}" ${S}/>
    <rect x="${x + 5}" y="15" width="${w - 10}" height="30" rx="1" fill="${screen}" ${S}/>
    <rect x="${x + 10}" y="21" width="${(w - 20) * 0.7}" height="4" fill="${textColor}"/>
    <rect x="${x + 10}" y="30" width="${(w - 20) * 0.9}" height="4" fill="${textColor}"/>
    <rect x="${x + 10}" y="38" width="${(w - 20) * 0.4}" height="3" fill="${textColor}"/>${pins(x + 14, x + 32, 49)}`;
}

function ledStrip(): string {
  let leds = "";
  for (let x = 6; x <= 80; x += 14)
    leds += `<circle cx="${x + 4}" cy="32" r="8" fill="${C.yellow}" fill-opacity="0.35"/><rect x="${x}" y="28" width="8" height="8" fill="${C.white}" ${S}/>`;
  return `<rect x="0" y="22" width="90" height="20" rx="2" fill="${C.white}" ${S}/>${leds}
    <path d="M0 36 C -2 50, 6 58, 14 60" fill="none" stroke="#e03131" stroke-width="2"/>`;
}

function led(color = "#e03131"): string {
  return `<path d="M34 34 V20 A11 11 0 0 1 56 20 V34 Z" fill="${color}" fill-opacity="0.85" ${S}/>
    <rect x="31" y="34" width="28" height="4" fill="${color}" ${S}/>
    <ellipse cx="40" cy="18" rx="3" ry="5" fill="${C.white}" fill-opacity="0.6"/>${legs([40, 50], 38, 62)}`;
}

function rgbLed(): string {
  return `<path d="M34 34 V20 A11 11 0 0 1 56 20 V34 Z" fill="${C.white}" ${S}/>
    <circle cx="40" cy="24" r="3" fill="#e03131"/><circle cx="50" cy="24" r="3" fill="#2f9e44"/><circle cx="45" cy="16" r="3" fill="#1c7ed6"/>
    <rect x="31" y="34" width="28" height="4" fill="${C.white}" ${S}/>${legs([38, 43, 48, 53], 38, 62)}`;
}

function resistor(): string {
  return `<line x1="2" y1="32" x2="88" y2="32" stroke="${C.metal}" stroke-width="2.5"/>
    <rect x="26" y="23" width="38" height="18" rx="8" fill="#e3c79b" ${S}/>
    <rect x="33" y="23" width="4" height="18" fill="#8b4513"/><rect x="41" y="23" width="4" height="18" fill="${C.ink}"/>
    <rect x="49" y="23" width="4" height="18" fill="#e8590c"/><rect x="57" y="23" width="3" height="18" fill="#c9a227"/>`;
}

function button(): string {
  return `<rect x="25" y="14" width="40" height="40" rx="3" fill="${C.pcbBlack}" ${S}/>
    <circle cx="45" cy="34" r="12" fill="#e03131" ${S}/>${legs([27, 63], 18, 8)}${legs([27, 63], 50, 62)}`;
}

function pot(): string {
  return `<rect x="24" y="28" width="42" height="26" rx="2" fill="${C.pcbBlue}" ${S}/>
    <circle cx="45" cy="26" r="15" fill="${C.metal}" ${S}/><line x1="45" y1="26" x2="45" y2="13" stroke="${C.ink}" stroke-width="2.5"/>
    ${legs([33, 45, 57], 54, 63)}`;
}

function buzzer(): string {
  return `<circle cx="45" cy="30" r="24" fill="${C.pcbBlack}" ${S}/><circle cx="45" cy="30" r="17" fill="none" stroke="#444" stroke-width="1"/>
    <circle cx="45" cy="30" r="4" fill="${C.paper}"/><text x="45" y="49" font-size="7" fill="#999" text-anchor="middle" font-family="monospace">+</text>`;
}

function speaker(): string {
  return `<circle cx="45" cy="32" r="27" fill="${C.metal}" ${S}/><circle cx="45" cy="32" r="21" fill="${C.pcbBlack}"/>
    <circle cx="45" cy="32" r="13" fill="#3a3a3a"/><circle cx="45" cy="32" r="6" fill="#555"/>`;
}

function cell(color = "#e8590c", label = "AA"): string {
  return `<rect x="8" y="20" width="66" height="24" rx="5" fill="${color}" ${S}/>
    <rect x="74" y="26" width="7" height="12" rx="1.5" fill="${C.metal}" ${S}/>
    <rect x="8" y="20" width="16" height="24" rx="5" fill="${C.ink}" fill-opacity="0.85"/>
    <text x="48" y="36" font-size="11" font-weight="700" fill="${C.white}" text-anchor="middle" font-family="sans-serif">${label}</text>`;
}

function batteryHolder(): string {
  let cells = "";
  for (let y = 12; y <= 42; y += 10) cells += `<rect x="12" y="${y}" width="58" height="8" rx="3" fill="#e8590c" ${S}/>`;
  return `<rect x="6" y="8" width="70" height="48" rx="3" fill="${C.pcbBlack}" ${S}/>${cells}
    <path d="M76 20 C 84 22, 86 32, 89 40" fill="none" stroke="#e03131" stroke-width="2"/>
    <path d="M76 26 C 82 30, 82 38, 86 46" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
}

function pack(color = C.metal, label = "LiPo", textColor: string = C.ink): string {
  return `<rect x="10" y="12" width="66" height="40" rx="5" fill="${color}" ${S}/>
    <text x="43" y="37" font-size="10" font-weight="700" fill="${textColor}" text-anchor="middle" font-family="sans-serif">${label}</text>
    <path d="M76 24 C 84 24, 86 30, 88 36" fill="none" stroke="#e03131" stroke-width="2"/><path d="M76 30 C 82 30, 84 36, 86 42" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
}

function adapter(): string {
  return `<rect x="8" y="10" width="38" height="44" rx="6" fill="${C.pcbBlack}" ${S}/>
    <rect x="14" y="2" width="5" height="10" fill="${C.metal}"/><rect x="35" y="2" width="5" height="10" fill="${C.metal}"/>
    <path d="M46 40 C 60 40, 64 20, 78 22" fill="none" stroke="${C.ink}" stroke-width="3"/>
    <rect x="76" y="17" width="12" height="10" rx="1.5" fill="${C.metal}" ${S}/>`;
}

function usbCable(): string {
  return `<path d="M6 50 C 20 10, 50 64, 70 24" fill="none" stroke="${C.ink}" stroke-width="3.5"/>
    <rect x="66" y="10" width="14" height="16" rx="2" fill="${C.metal}" ${S}/><rect x="0" y="48" width="14" height="10" rx="2" fill="${C.metal}" ${S}/>`;
}

function breadboard(): string {
  let dots = "";
  for (let x = 10; x <= 80; x += 6) {
    for (const y of [22, 27, 32, 42, 47]) dots += `<rect x="${x}" y="${y}" width="2.5" height="2.5" fill="#9a958a"/>`;
  }
  return `<rect x="2" y="8" width="86" height="50" rx="3" fill="${C.white}" ${S}/>
    <line x1="8" y1="13" x2="82" y2="13" stroke="#e03131" stroke-width="1.2"/><line x1="8" y1="17" x2="82" y2="17" stroke="#1c7ed6" stroke-width="1.2"/>
    <line x1="8" y1="53" x2="82" y2="53" stroke="#e03131" stroke-width="1.2"/><rect x="6" y="37" width="78" height="2.5" fill="${C.grid}"/>${dots}`;
}

function wires(): string {
  const colors = ["#e03131", "#1c7ed6", "#f2c230", "#2f9e44", C.ink];
  return colors
    .map(
      (c, i) =>
        `<path d="M${8 + i * 4} ${54 - i * 2} C ${25 + i * 5} ${4 + i * 6}, ${55 - i * 3} ${60 - i * 4}, ${80 - i * 2} ${10 + i * 8}" fill="none" stroke="${c}" stroke-width="2.4"/>` +
        `<rect x="${5 + i * 4}" y="${52 - i * 2}" width="6" height="8" fill="${C.pcbBlack}"/><rect x="${77 - i * 2}" y="${6 + i * 8}" width="6" height="8" fill="${C.pcbBlack}"/>`,
    )
    .join("");
}

function pump(): string {
  return `<rect x="16" y="14" width="40" height="44" rx="8" fill="${C.pcbBlack}" ${S}/>
    <rect x="56" y="22" width="14" height="8" fill="${C.pcbBlack}" ${S}/>
    <path d="M70 26 C 84 26, 86 10, 74 4" fill="none" stroke="#74c0fc" stroke-width="5" stroke-opacity="0.8"/>
    <circle cx="36" cy="44" r="5" fill="#444"/>`;
}

function screws(): string {
  const screw = (x: number, y: number, r: number) =>
    `<g transform="rotate(${r} ${x} ${y})"><circle cx="${x}" cy="${y}" r="7" fill="${C.metal}" ${S}/><line x1="${x - 4}" y1="${y}" x2="${x + 4}" y2="${y}" stroke="${C.ink}" stroke-width="1.5"/>
     <rect x="${x - 2.5}" y="${y + 7}" width="5" height="20" fill="${C.metal}" ${S}/></g>`;
  return `${screw(22, 14, -15)}${screw(45, 12, 5)}${screw(68, 16, 20)}<polygon points="40,52 50,52 54,58 50,64 40,64 36,58" fill="${C.metal}" ${S}/>`;
}

function sticks(): string {
  return [0, 1, 2]
    .map((i) => `<rect x="6" y="${14 + i * 14}" width="78" height="10" rx="5" fill="${C.tan}" ${S} transform="rotate(${-8 + i * 6} 45 ${19 + i * 14})"/>`)
    .join("");
}

function cardboard(): string {
  return `<polygon points="10,24 45,12 80,24 45,36" fill="#d7a868" ${S}/><polygon points="10,24 45,36 45,62 10,50" fill="#c8955a" ${S}/>
    <polygon points="80,24 45,36 45,62 80,50" fill="#b98447" ${S}/>`;
}

function glue(): string {
  return `<rect x="10" y="26" width="70" height="12" rx="6" fill="#f1f3f5" fill-opacity="0.9" ${S}/>
    <rect x="18" y="40" width="54" height="10" rx="5" fill="#f1f3f5" fill-opacity="0.9" ${S}/>`;
}

function tape(): string {
  return `<circle cx="45" cy="32" r="26" fill="${C.pcbBlack}" ${S}/><circle cx="45" cy="32" r="13" fill="${C.paper}" ${S}/>
    <path d="M70 40 L88 52 L84 58 L66 46 Z" fill="${C.pcbBlack}"/>`;
}

function jar(): string {
  return `<rect x="26" y="8" width="38" height="8" rx="2" fill="${C.metal}" ${S}/>
    <path d="M24 16 H66 V56 a4 4 0 0 1 -4 4 H28 a4 4 0 0 1 -4 -4 Z" fill="#d0ebff" fill-opacity="0.8" ${S}/>
    <rect x="25" y="30" width="40" height="28" fill="#74c0fc" fill-opacity="0.6"/>`;
}

function generic(): string {
  return `<rect x="20" y="10" width="50" height="44" rx="6" fill="${C.white}" ${S} stroke-dasharray="4 3"/>
    <text x="45" y="40" font-size="22" font-weight="700" fill="${C.muted}" text-anchor="middle" font-family="sans-serif">?</text>`;
}

const BY_KEY: Record<string, () => string> = {
  "arduino-uno": () => board(),
  "arduino-nano": () => board(C.pcbBlue, true),
  esp32: () => board(C.pcbBlack),
  esp8266: () => board(C.pcbBlue, true),
  "pi-pico": () => board(C.pcbGreen, true),
  "raspberry-pi": () => board(C.pcbGreen),
  "esp32-cam": camera,
  "servo-sg90": () => servo(),
  "servo-mg996r": () => servo(C.pcbBlack),
  "servo-driver": () => driver(C.pcbBlue),
  "stepper-28byj48": stepper,
  "dc-gear-motor": dcMotor,
  "motor-driver": () => driver(),
  "mosfet-module": () => sensor(C.pcbRed),
  "robot-chassis": chassis,
  wheel,
  "ultrasonic-sensor": ultrasonic,
  "tof-sensor": () => sensor(C.pcbPurple),
  "pir-sensor": pir,
  dht22: () => grillSensor(C.white),
  dht11: () => grillSensor("#4dabf7"),
  bme280: () => sensor(C.pcbPurple),
  "soil-moisture": soil,
  ldr,
  imu: () => sensor(C.pcbBlue),
  "line-sensor": () => sensor(C.pcbBlue),
  "sound-sensor": () => sensor(C.pcbRed),
  rfid: () => sensor(C.pcbBlue),
  "ir-receiver": () => sensor(C.pcbBlack),
  gps: () => sensor(C.pcbBlue),
  bluetooth: () => sensor(C.pcbBlue),
  nrf24: () => sensor(C.pcbGreen),
  oled: () => display("oled"),
  "lcd-1602": () => display("lcd"),
  "led-strip": ledStrip,
  led: () => led(),
  "rgb-led": rgbLed,
  resistor,
  button,
  potentiometer: pot,
  buzzer,
  speaker,
  "mp3-player": () => sensor(C.pcbRed),
  relay,
  "water-pump": pump,
  breadboard,
  "jumper-wires": wires,
  "usb-cable": usbCable,
  "battery-18650": () => cell("#2f9e44", "18650"),
  "battery-holder": batteryHolder,
  "aa-battery": () => cell(),
  "9v-battery": () => pack("#495057", "9V", C.white),
  lipo: () => pack(),
  "power-bank": () => pack("#dee2e6", "USB"),
  "charger-module": () => sensor(C.pcbBlue),
  "buck-converter": () => sensor(C.pcbBlue),
  "power-supply-5v": adapter,
  "m3-screws": screws,
};

export function iconFor(key: string, name: string): string {
  const byKey = BY_KEY[key];
  if (byKey) return byKey();
  const n = name.toLowerCase();
  if (/stick|popsicle|dowel/.test(n) && !/glue/.test(n)) return sticks();
  if (/glue/.test(n)) return glue();
  if (/tape/.test(n)) return tape();
  if (/cardboard|body|box|case|enclosure|3d/.test(n)) return cardboard();
  if (/jar|water|bottle|reservoir/.test(n)) return jar();
  if (/sensor|module/.test(n)) return sensor();
  return generic();
}

// ---------------------------------------------------------------------------
// Layout

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
// ---------------------------------------------------------------------------

function wrapLabel(text: string, maxChars: number, maxLines: number): string[] {
  const clean = text.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim() || text;
  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if ((line + " " + w).length <= maxChars) line += " " + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1]!.slice(0, maxChars - 1) + "…";
  }
  return lines.map((l) => (l.length > maxChars ? l.slice(0, maxChars - 1) + "…" : l));
}

export function illustrateParts(opts: IllustrationOptions): string {
  const { title, subtitle, parts, showStatus = true } = opts;
  const cols = Math.max(1, Math.min(opts.columns ?? 4, parts.length));
  const cellW = 150;
  const cellH = 136;
  const pad = 22;
  const headerH = subtitle ? 74 : 56;
  const rows = Math.ceil(parts.length / cols);
  const legendH = showStatus ? 34 : 12;
  const width = pad * 2 + cols * cellW;
  const height = headerH + rows * cellH + legendH + pad / 2;
  const font = `font-family="'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif"`;
  // Unique pattern id: several of these SVGs are inlined into one web page.
  const gridId = `grid-${hash(title + parts.map((p) => p.key + (p.missing ?? "")).join())}`;

  const cells = parts
    .map((p, i) => {
      const x = pad + (i % cols) * cellW;
      const y = headerH + Math.floor(i / cols) * cellH;
      const status = !showStatus ? "none" : (p.missing ?? 0) === 0 ? "have" : (p.have ?? 0) === 0 ? "missing" : "partial";
      const border = status === "missing" ? C.bad : status === "partial" ? C.warn : C.ink;
      const dash = status === "missing" || status === "partial" ? `stroke-dasharray="5 4"` : "";
      const fade = status === "missing" ? `opacity="0.5"` : "";
      const label = wrapLabel(p.name, 21, 2)
        .map((l, k) => `<text x="${cellW / 2 - 6}" y="${98 + k * 13}" font-size="11.5" fill="${C.ink}" text-anchor="middle" ${font}>${esc(l)}</text>`)
        .join("");

      let badge = "";
      if (status === "have") {
        badge = `<circle cx="14" cy="14" r="9" fill="${C.ok}"/><path d="M9.5 14 l3 3 l6 -6.5" fill="none" stroke="${C.white}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
      } else if (status === "missing" || status === "partial") {
        const cost = p.unitPriceCzk !== undefined ? ` ~${(p.missing ?? 0) * p.unitPriceCzk} Kč` : "";
        const txt = status === "partial" ? `need ${p.missing} more` : `BUY${cost}`;
        const w = txt.length * 6.4 + 12;
        badge = `<rect x="6" y="6" width="${w}" height="17" rx="8.5" fill="${status === "partial" ? C.warn : C.bad}"/>
          <text x="${6 + w / 2}" y="18" font-size="10" font-weight="700" fill="${C.white}" text-anchor="middle" ${font}>${esc(txt)}</text>`;
      }
      const qty = p.qty > 1
        ? `<rect x="${cellW - 46}" y="6" width="34" height="17" rx="8.5" fill="${C.ink}"/><text x="${cellW - 29}" y="18" font-size="10.5" font-weight="700" fill="${C.paper}" text-anchor="middle" ${font}>×${p.qty}</text>`
        : "";

      return `<g transform="translate(${x} ${y})">
        <rect x="0" y="0" width="${cellW - 12}" height="${cellH - 12}" rx="10" fill="${C.white}" fill-opacity="0.7" stroke="${border}" stroke-width="1.2" ${dash}/>
        <g transform="translate(${(cellW - 12 - 90) / 2} 22)" ${fade}>${iconFor(p.key, p.name)}</g>
        ${label}${badge}${qty}
      </g>`;
    })
    .join("");

  const legend = showStatus
    ? `<g transform="translate(${pad} ${height - legendH + 4})" ${font} font-size="11" fill="${C.muted}">
        <circle cx="7" cy="7" r="6" fill="${C.ok}"/><text x="18" y="11">you have it</text>
        <rect x="100" y="1" width="12" height="12" rx="3" fill="none" stroke="${C.bad}" stroke-dasharray="3 2"/><text x="118" y="11">to buy</text>
        <rect x="170" y="1" width="12" height="12" rx="3" fill="none" stroke="${C.warn}" stroke-dasharray="3 2"/><text x="188" y="11">have some, need more</text>
      </g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(title)} — parts">
  <defs><pattern id="${gridId}" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="${C.grid}" stroke-width="1"/></pattern></defs>
  <rect width="${width}" height="${height}" fill="${C.paper}"/><rect width="${width}" height="${height}" fill="url(#${gridId})"/>
  <rect x="0" y="0" width="6" height="${height}" fill="${C.accent}"/>
  <text x="${pad}" y="34" font-size="21" font-weight="700" fill="${C.ink}" ${font}>${esc(title)}</text>
  ${subtitle ? `<text x="${pad}" y="56" font-size="12.5" fill="${C.muted}" ${font}>${esc(subtitle)}</text>` : ""}
  ${cells}${legend}
</svg>`;
}

/** Convenience wrapper for an enriched project (owned/missing known) or a gallery project (not known). */
export function illustrateProject(
  p: { title: string; difficulty: string; estimatedHours: number; parts: IllustratedPart[] },
  opts: { showStatus?: boolean } = {},
): string {
  const subtitle = `${p.difficulty} · ~${p.estimatedHours} h · ${p.parts.length} part types`;
  return illustrateParts({ title: p.title, subtitle, parts: p.parts, showStatus: opts.showStatus ?? true });
}
