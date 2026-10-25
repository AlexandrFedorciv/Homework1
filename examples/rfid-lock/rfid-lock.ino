/*
  RFID Access Lock — a PartsBin example project
  ----------------------------------------------
  Tap an allowed card: green LED, happy beep, the servo opens the latch for 3 seconds.
  Tap any other card: red LED and a low beep. After 5 wrong cards in a row the lock
  ignores every card for 30 seconds.

  Library: "MFRC522" by GithubCommunity (Arduino IDE → Tools → Manage Libraries).

  Wiring (Arduino Uno):
    RC522   3.3V -> 3.3V (NOT 5V!)   GND -> GND   RST -> D9   SDA(SS) -> D10
            MOSI -> D11   MISO -> D12   SCK -> D13
    Servo   signal -> D6   red -> 5V   brown -> GND
    LEDs    green -> 220 Ω -> D7,  red -> 220 Ω -> D8   (short legs to GND)
    Buzzer  + -> D5   - -> GND

  First run: open the Serial Monitor at 115200 baud and tap your cards. Each one prints its
  UID, e.g. "Card UID: 04 A3 1B 2C". Copy the ones you want into ALLOWED below.

  Note: checking only the UID is a learning-grade lock — UIDs can be copied. Fine for a drawer,
  not for a front door.
*/

#include <SPI.h>
#include <MFRC522.h>
#include <Servo.h>

const uint8_t RST_PIN = 9;
const uint8_t SS_PIN = 10;
const uint8_t SERVO_PIN = 6;
const uint8_t GREEN_LED = 7;
const uint8_t RED_LED = 8;
const uint8_t BUZZER = 5;

const int ANGLE_LOCKED = 10;            // find your own angles in step 5 of the tutorial
const int ANGLE_OPEN = 100;
const unsigned long OPEN_MS = 3000;
const uint8_t MAX_FAILS = 5;
const unsigned long LOCKOUT_MS = 30000;

// Cards that may open the lock. Replace with the UIDs printed in the Serial Monitor.
const uint8_t ALLOWED[][4] = {
  {0x04, 0xA3, 0x1B, 0x2C},
  {0xDE, 0xAD, 0xBE, 0xEF},
};
const uint8_t ALLOWED_COUNT = sizeof(ALLOWED) / sizeof(ALLOWED[0]);

MFRC522 reader(SS_PIN, RST_PIN);
Servo latch;
uint8_t failsInARow = 0;
unsigned long lockedOutUntil = 0;

bool isAllowed(const MFRC522::Uid &uid) {
  if (uid.size != 4) return false;        // this sketch stores 4-byte UIDs (most cheap tags)
  for (uint8_t i = 0; i < ALLOWED_COUNT; i++) {
    bool same = true;
    for (uint8_t b = 0; b < 4; b++) {
      if (uid.uidByte[b] != ALLOWED[i][b]) same = false;
    }
    if (same) return true;
  }
  return false;
}

void printUid(const MFRC522::Uid &uid) {
  Serial.print(F("Card UID:"));
  for (uint8_t i = 0; i < uid.size; i++) {
    Serial.print(uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(uid.uidByte[i], HEX);
  }
  Serial.println();
}

void grant() {
  Serial.println(F("Access granted"));
  failsInARow = 0;
  digitalWrite(GREEN_LED, HIGH);
  tone(BUZZER, 1760, 120);
  latch.write(ANGLE_OPEN);
  delay(OPEN_MS);
  latch.write(ANGLE_LOCKED);
  digitalWrite(GREEN_LED, LOW);
}

void deny() {
  failsInARow++;
  Serial.print(F("Access denied ("));
  Serial.print(failsInARow);
  Serial.println(F(" in a row)"));
  digitalWrite(RED_LED, HIGH);
  tone(BUZZER, 220, 400);
  delay(600);
  digitalWrite(RED_LED, LOW);
  if (failsInARow >= MAX_FAILS) {
    lockedOutUntil = millis() + LOCKOUT_MS;
    failsInARow = 0;
    Serial.println(F("Too many wrong cards: locked out for 30 s"));
  }
}

void setup() {
  Serial.begin(115200);
  SPI.begin();
  reader.PCD_Init();
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  latch.attach(SERVO_PIN);
  latch.write(ANGLE_LOCKED);
  Serial.println(F("RFID lock ready. Tap a card."));
}

void loop() {
  // Lockout: blink red and ignore cards until the time is up.
  if (lockedOutUntil != 0) {
    if ((long)(millis() - lockedOutUntil) < 0) {
      digitalWrite(RED_LED, (millis() / 250) % 2);
      return;
    }
    lockedOutUntil = 0;
    digitalWrite(RED_LED, LOW);
  }

  if (!reader.PICC_IsNewCardPresent() || !reader.PICC_ReadCardSerial()) return;

  printUid(reader.uid);
  if (isAllowed(reader.uid)) grant();
  else deny();

  reader.PICC_HaltA();   // stop talking to this card until it is tapped again
  delay(300);
}
