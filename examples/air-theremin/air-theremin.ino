/*
  Air Theremin — a PartsBin example project
  ------------------------------------------
  Move your hand above the HC-SR04: the closer your hand, the higher the note.
  The potentiometer picks the scale: major / minor / pentatonic.

  Wiring (Arduino Uno):
    HC-SR04   VCC -> 5V   GND -> GND   TRIG -> D9   ECHO -> D10
    Buzzer    +   -> D8   -   -> GND          (use a PASSIVE piezo — an active buzzer only beeps one pitch)
    Pot       outer legs -> 5V and GND, middle leg (wiper) -> A0

  Open the Serial Monitor at 115200 baud to see distance, scale and note.
*/

const uint8_t TRIG_PIN = 9;
const uint8_t ECHO_PIN = 10;
const uint8_t BUZZER_PIN = 8;
const uint8_t POT_PIN = A0;

const float MIN_CM = 5.0;                     // closest usable hand distance
const float MAX_CM = 50.0;                    // farther than this = "no hand"
const unsigned long SILENCE_AFTER_MS = 300;   // stop playing this long after the hand disappears
const uint8_t ROOT_NOTE = 60;                 // MIDI 60 = C4

// Each scale = 8 notes, as semitone offsets from the root note.
const uint8_t ZONES = 8;
const int8_t SCALES[3][ZONES] = {
  {0, 2, 4, 5, 7, 9, 11, 12},   // major
  {0, 2, 3, 5, 7, 8, 10, 12},   // natural minor
  {0, 2, 4, 7, 9, 12, 14, 16},  // major pentatonic (hard to play a wrong note!)
};
const char* const SCALE_NAMES[3] = {"major", "minor", "pentatonic"};

// Moving average of the last few readings, so the pitch doesn't jitter.
const uint8_t AVG_N = 5;
float history[AVG_N];
uint8_t histIndex = 0;
uint8_t histCount = 0;

int currentNote = -1;           // -1 = silent
unsigned long lastHandSeenMs = 0;

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);   // a 10 µs pulse starts one measurement
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Echo pulse length = time for sound to travel there and back.
  // Timeout 6000 µs ≈ 1 m, so a missing echo can't block the loop for long.
  unsigned long echoUs = pulseIn(ECHO_PIN, HIGH, 6000UL);
  if (echoUs == 0) return -1;     // nothing in range
  return echoUs / 58.0;           // µs -> cm (speed of sound, there and back)
}

float midiToHz(int note) {
  return 440.0 * pow(2.0, (note - 69) / 12.0);
}

float smoothed(float cm) {
  history[histIndex] = cm;
  histIndex = (histIndex + 1) % AVG_N;
  if (histCount < AVG_N) histCount++;
  float sum = 0;
  for (uint8_t i = 0; i < histCount; i++) sum += history[i];
  return sum / histCount;
}

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.begin(115200);
  Serial.println(F("Air Theremin ready - wave your hand 5-50 cm above the sensor."));
}

void loop() {
  float cm = readDistanceCm();
  unsigned long now = millis();

  if (cm >= MIN_CM && cm <= MAX_CM) {
    lastHandSeenMs = now;
    float avg = smoothed(cm);

    // Pot in thirds -> scale 0, 1 or 2.
    uint8_t scale = min(2, analogRead(POT_PIN) / 342);

    // Distance -> zone 0..7, inverted so a closer hand plays a higher note.
    int zone = (int)((avg - MIN_CM) / (MAX_CM - MIN_CM) * ZONES);
    zone = constrain(zone, 0, ZONES - 1);
    zone = ZONES - 1 - zone;

    int note = ROOT_NOTE + SCALES[scale][zone];
    if (note != currentNote) {
      tone(BUZZER_PIN, (unsigned int)midiToHz(note));
      currentNote = note;
      Serial.print(avg, 1);
      Serial.print(F(" cm  scale="));
      Serial.print(SCALE_NAMES[scale]);
      Serial.print(F("  note="));
      Serial.println(note);
    }
  } else if (currentNote != -1 && now - lastHandSeenMs > SILENCE_AFTER_MS) {
    noTone(BUZZER_PIN);
    currentNote = -1;
    histCount = 0;   // start fresh next time a hand appears
  }

  delay(30);   // ~30 readings per second; the HC-SR04 needs >= 25 ms between pings anyway
}
