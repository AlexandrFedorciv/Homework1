import type { JsonRequest, LlmClient } from "./llm.ts";

/**
 * Offline stand-in for a real model (LLM_PROVIDER=mock).
 * Returns fixed, realistic answers so the whole pipeline — parsing, part matching, pricing,
 * constraint checks, output formatting — can be tried and tested without an API key.
 * The projects are written for a typical Arduino starter kit.
 */

const STARTER_PROJECTS = [
  {
    title: "Desk Crab — a 4-servo walking robot",
    summary: "A palm-sized quadruped that shuffles across your desk and backs away from obstacles it 'sees' with the ultrasonic sensor.",
    difficulty: "intermediate",
    estimatedHours: 6,
    requiresSoldering: false,
    parts: [
      { name: "Arduino Uno", qty: 1, purpose: "brain: gait timing and obstacle logic" },
      { name: "SG90 micro servo", qty: 4, purpose: "one per leg (hip joint)" },
      { name: "HC-SR04 ultrasonic sensor", qty: 1, purpose: "eyes: obstacle distance" },
      { name: "Battery holder (4×AA or 2×18650)", qty: 1, purpose: "separate 6 V supply for the servos" },
      { name: "AA battery", qty: 4, purpose: "servo power" },
      { name: "Breadboard", qty: 1, purpose: "power distribution" },
      { name: "Jumper wire set", qty: 1, purpose: "wiring" },
      { name: "Popsicle sticks", qty: 8, purpose: "legs and body frame" },
      { name: "Hot glue sticks", qty: 2, purpose: "mounting servos to the frame" },
    ],
    steps: [
      { title: "Build the frame", detail: "Glue two popsicle sticks into a cross for the body. Hot-glue one servo at each arm end, horns facing outward." },
      { title: "Attach the legs", detail: "Screw a servo horn onto each servo and glue a popsicle-stick leg to it, angled ~30° down so the body sits 3 cm off the desk." },
      { title: "Wire the servos", detail: "Signal wires to D3, D5, D6, D9. Servo + and − go to the AA pack via the breadboard rails — NOT to the Arduino 5 V pin. Connect the pack's − to Arduino GND (common ground)." },
      { title: "Wire the sensor", detail: "HC-SR04: VCC→5V, GND→GND, TRIG→D10, ECHO→D11. Mount it on the front of the body with a dab of glue." },
      { title: "Center and calibrate", detail: "Upload a sketch that writes 90° to every servo, then re-seat the horns so all legs point straight. Note any per-leg offset in an array." },
      { title: "Write the gait", detail: "Use a 4-phase creep gait: lift-swing one leg at a time in order FL, BR, FR, BL. Store poses in a table and step through them every 150 ms with millis() instead of delay()." },
      { title: "Add obstacle avoidance", detail: "Read distance every 100 ms; if < 15 cm, play the gait table backwards for 2 s, then turn by running only the left legs." },
      { title: "Test and tune", detail: "Run on a non-slip surface. If it drags, increase the lift angle; if it tips, shorten the swing range." },
    ],
    safetyNotes: [
      "Power the servos from the battery pack: four servos stalling at once can brown out or damage the Arduino's regulator.",
      "Hot glue is hot enough to burn — let joints cool before handling.",
    ],
  },
  {
    title: "Air Theremin",
    summary: "Play notes by moving your hand above an ultrasonic sensor; a potentiometer picks the musical scale.",
    difficulty: "beginner",
    estimatedHours: 2,
    requiresSoldering: false,
    parts: [
      { name: "Arduino Uno", qty: 1, purpose: "reads distance, generates tones" },
      { name: "HC-SR04 ultrasonic sensor", qty: 1, purpose: "measures hand height" },
      { name: "Piezo buzzer", qty: 1, purpose: "sound output" },
      { name: "Potentiometer (10k)", qty: 1, purpose: "scale / octave selector" },
      { name: "Breadboard", qty: 1, purpose: "prototyping" },
      { name: "Jumper wire set", qty: 1, purpose: "wiring" },
    ],
    steps: [
      { title: "Wire the sensor", detail: "HC-SR04: VCC→5V, GND→GND, TRIG→D9, ECHO→D10." },
      { title: "Wire the buzzer and pot", detail: "Buzzer + to D8, − to GND. Potentiometer outer legs to 5V and GND, wiper to A0." },
      { title: "Measure distance", detail: "Send a 10 µs TRIG pulse, read ECHO with pulseIn(), convert to cm (duration / 58). Clamp to 5–50 cm." },
      { title: "Map distance to notes", detail: "Split 5–50 cm into 8 zones and map each to a note of the selected scale (major, minor, pentatonic — chosen by the pot reading)." },
      { title: "Play", detail: "Call tone(8, frequency) when the note changes; noTone(8) when no hand is detected for 300 ms." },
      { title: "Smooth it", detail: "Average the last 5 readings so the pitch doesn't jitter between notes." },
    ],
    safetyNotes: [],
  },
  {
    title: "Ultrasonic Radar Sweep",
    summary: "A servo sweeps the ultrasonic sensor back and forth and your laptop draws a live radar screen of nearby objects.",
    difficulty: "beginner",
    estimatedHours: 3,
    requiresSoldering: false,
    parts: [
      { name: "Arduino Uno", qty: 1, purpose: "controls the sweep and takes readings" },
      { name: "SG90 micro servo", qty: 1, purpose: "pans the sensor 15–165°" },
      { name: "HC-SR04 ultrasonic sensor", qty: 1, purpose: "distance at each angle" },
      { name: "Breadboard", qty: 1, purpose: "prototyping" },
      { name: "Jumper wire set", qty: 1, purpose: "wiring" },
      { name: "USB cable", qty: 1, purpose: "serial link to the laptop" },
    ],
    steps: [
      { title: "Mount the sensor", detail: "Glue or tape the HC-SR04 onto the servo horn so it rotates with it." },
      { title: "Wire it up", detail: "Servo signal→D9, servo power→5V/GND (one SG90 is fine on USB power). HC-SR04 TRIG→D10, ECHO→D11." },
      { title: "Sweep and measure", detail: "Loop the servo from 15° to 165° and back in 2° steps; at each step wait 30 ms, then measure distance." },
      { title: "Stream the data", detail: "Print 'angle,distance' lines over Serial at 115200 baud." },
      { title: "Draw the radar", detail: "Write a small Python script (pyserial + matplotlib polar plot) or a Processing sketch that reads the lines and draws fading green dots." },
      { title: "Calibrate", detail: "Place an object at a measured 30 cm and check the plot; adjust the speed-of-sound constant if it's off." },
    ],
    safetyNotes: [],
  },
];

const REPLACEMENT_PROJECT = {
  title: "Light-Seeking Sunflower",
  summary: "A servo turns a cardboard flower toward the brightest light using two light sensors.",
  difficulty: "beginner",
  estimatedHours: 2,
  requiresSoldering: false,
  parts: [
    { name: "Arduino Uno", qty: 1, purpose: "compares the two light readings" },
    { name: "SG90 micro servo", qty: 1, purpose: "turns the flower" },
    { name: "Photoresistor (LDR)", qty: 2, purpose: "left/right light sensors" },
    { name: "Resistor", qty: 2, purpose: "10k voltage dividers for the LDRs" },
    { name: "Breadboard", qty: 1, purpose: "prototyping" },
    { name: "Jumper wire set", qty: 1, purpose: "wiring" },
  ],
  steps: [
    { title: "Build two dividers", detail: "Each LDR from 5V to A0/A1, with a 10k resistor from that pin to GND." },
    { title: "Wire the servo", detail: "Signal→D9, power→5V/GND." },
    { title: "Steer toward light", detail: "If A0 − A1 > 20, move the servo 1° left; if < −20, 1° right. Repeat every 20 ms." },
    { title: "Decorate", detail: "Glue a cardboard flower to the servo horn with the LDRs on either side of the face." },
  ],
  safetyNotes: [],
};

const DETECTED = {
  parts: [
    { name: "Arduino Uno", qty: 1 },
    { name: "SG90 micro servo", qty: 4 },
    { name: "HC-SR04 ultrasonic sensor", qty: 1 },
    { name: "Breadboard", qty: 1 },
    { name: "Jumper wires", qty: 1 },
  ],
};

export function createMockClient(): LlmClient {
  return {
    label: "mock (offline fixtures)",
    async generateJson(req: JsonRequest): Promise<string> {
      const props = (req.schema as { properties?: Record<string, unknown> }).properties ?? {};
      if ("parts" in props) return JSON.stringify(DETECTED);

      const wanted = Number((req.schema as any).properties?.projects?.minItems ?? 3);
      const isReplacement = /Do NOT repeat/.test(req.user);
      const pool = isReplacement ? [REPLACEMENT_PROJECT, ...STARTER_PROJECTS] : STARTER_PROJECTS;
      return JSON.stringify({ projects: pool.slice(0, wanted) });
    },
  };
}
