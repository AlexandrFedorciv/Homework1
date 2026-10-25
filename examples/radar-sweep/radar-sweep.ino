/*
  Ultrasonic Radar Sweep — a PartsBin example project
  ----------------------------------------------------
  A servo pans an HC-SR04 from 15° to 165° and back. At every step the Arduino prints
  "angle,distance_cm" over Serial; radar_viewer.py turns that into a live radar screen.

  Wiring (Arduino Uno):
    SG90 servo  signal (orange) -> D9   red -> 5V   brown -> GND
    HC-SR04     VCC -> 5V   GND -> GND   TRIG -> D10   ECHO -> D11

  One SG90 is fine on USB power. If the board resets when the servo moves, power the servo
  from a separate 5-6 V supply and connect the grounds together.
*/

#include <Servo.h>

const uint8_t SERVO_PIN = 9;
const uint8_t TRIG_PIN = 10;
const uint8_t ECHO_PIN = 11;

const int MIN_ANGLE = 15;
const int MAX_ANGLE = 165;
const int STEP_DEG = 2;
const unsigned int SETTLE_MS = 30;     // let the servo stop wobbling before measuring

// 343 m/s at ~20 °C. Tweak during calibration (step 6 of the tutorial).
const float SPEED_OF_SOUND_CM_PER_US = 0.0343;

Servo pan;

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long echoUs = pulseIn(ECHO_PIN, HIGH, 12000UL);   // ~2 m timeout
  if (echoUs == 0) return -1;                                // no echo
  return echoUs * SPEED_OF_SOUND_CM_PER_US / 2.0;            // there and back
}

void measureAt(int angle) {
  pan.write(angle);
  delay(SETTLE_MS);
  float cm = readDistanceCm();
  Serial.print(angle);
  Serial.print(',');
  Serial.println(cm, 1);   // -1 means "nothing in range" — the viewer ignores it
}

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pan.attach(SERVO_PIN);
  Serial.begin(115200);
}

void loop() {
  for (int a = MIN_ANGLE; a <= MAX_ANGLE; a += STEP_DEG) measureAt(a);
  for (int a = MAX_ANGLE; a >= MIN_ANGLE; a -= STEP_DEG) measureAt(a);
}
