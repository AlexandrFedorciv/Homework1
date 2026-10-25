# 6 · Build the RFID Access Lock

**Difficulty:** beginner · **Time:** ~2 hours · **Soldering:** none

Tap the right card and a servo swings the latch of your drawer or box open. Tap a wrong one and it beeps red. Five wrong cards in a row lock it out for 30 seconds, a small taste of how real access-control systems slow down guessing.

This is the gallery project `rfid-lock`:

```bash
npm start -- --project rfid-lock "arduino uno, sg90, breadboard, jumper wires"
```

![RFID lock parts](../images/gallery/rfid-lock.svg)

---

## Parts

| Part | Qty | Notes |
|---|---|---|
| Arduino Uno (or clone) | 1 | |
| RC522 RFID reader + card + key fob | 1 | the common blue 13.56 MHz kit |
| SG90 micro servo | 1 | the latch |
| 5 mm LEDs: green + red | 2 | |
| 220 Ω resistors | 2 | for the LEDs |
| Piezo buzzer | 1 | a *passive* one plays different tones |
| Breadboard + jumper wires | 1 set | female-to-male wires make the RC522 easier |

Library: **MFRC522** (Arduino IDE → Tools → Manage Libraries → search "MFRC522"). `Servo` and `SPI` come with the IDE.

## Step 1: Wire the reader

> ⚠ The RC522 runs on **3.3 V**. Connecting its power pin to 5V can damage it.

| RC522 pin | Arduino Uno |
|---|---|
| 3.3V | 3.3V |
| GND | GND |
| RST | D9 |
| SDA (SS) | D10 |
| MOSI | D11 |
| MISO | D12 |
| SCK | D13 |
| IRQ | not connected |

## Step 2: Wire the latch, LEDs and buzzer

| Part | Arduino Uno |
|---|---|
| Servo signal (orange) | D6 |
| Servo + (red) | 5V |
| Servo − (brown) | GND |
| Green LED (long leg) → 220 Ω | D7 |
| Red LED (long leg) → 220 Ω | D8 |
| LED short legs | GND |
| Buzzer + | D5 |
| Buzzer − | GND |

## Step 3: Read your card IDs

1. Open [`examples/rfid-lock/rfid-lock.ino`](../../examples/rfid-lock/rfid-lock.ino) in the Arduino IDE, select **Arduino Uno** and your port, and **Upload**.
2. Open the **Serial Monitor** at **115200 baud**.
3. Tap each card and fob on the reader. Each prints a line like:

```
Card UID: 04 A3 1B 2C
Access denied (1 in a row)
```

Write down the UIDs of the cards you want to accept.

## Step 4: Allow your cards

At the top of the sketch, replace the two example UIDs with yours:

```cpp
const uint8_t ALLOWED[][4] = {
  {0x04, 0xA3, 0x1B, 0x2C},   // my blue fob
  {0x93, 0x5E, 0x10, 0xA7},   // my white card
};
```

Upload again. Your cards now give a green LED, a high beep, and the servo moves.

## Step 5: Build the latch

1. Glue or screw the servo inside the **lid** of a wooden or cardboard box, near the front edge.
2. Fix a small block (a piece of wood or folded cardboard) on the inside of the **front wall**, just below where the servo horn swings.
3. Find two angles: **locked** (the horn sits behind the block, so the lid won't open) and **open** (the horn is clear). Change `ANGLE_LOCKED` and `ANGLE_OPEN` in the sketch until both work.
4. Mount the reader behind a thin wall (up to ~5 mm of wood or plastic): RFID reads through it, so nobody sees the reader.

> Keep a backup way in, such as a hidden screw in the bottom, in case the electronics fail with the box locked.

## Step 6: Test everything

| Test | Expected |
|---|---|
| Allowed card | green LED, high beep, latch opens for 3 s, then closes |
| Unknown card | red LED, low beep |
| 5 unknown cards in a row | red LED blinks, every card ignored for 30 s |
| Allowed card after the lockout | opens again |

## How it works

- `PICC_IsNewCardPresent()` and `PICC_ReadCardSerial()` ask the reader whether a card is in its field and read its **UID**, a 4-byte (sometimes 7-byte) serial number.
- `isAllowed()` compares it with the `ALLOWED` list, byte by byte.
- The lockout counts wrong cards in a row. After 5, it stores `millis() + 30000` and ignores the reader until then. That's the same idea as a phone that makes you wait after wrong PINs.

## Make it yours

| Idea | How |
|---|---|
| Add/remove cards without re-uploading | a "master card" that, when tapped, makes the next card allowed; store the list in EEPROM |
| Log every attempt | print time + UID to the Serial Monitor, or to an SD card module |
| A real lock | a 12 V solenoid lock through a relay or MOSFET module and its own power supply (advanced) |

## Why this is a "learning" lock

The sketch only checks the card's UID. Cheap card cloners can copy UIDs, so treat this as a lock for a drawer or a box of LEGO, not your front door. Real access systems use cards with cryptographic challenge-response (for example MIFARE DESFire) so the secret never leaves the card.

## Troubleshooting

| Problem | Fix |
|---|---|
| Nothing in the Serial Monitor when tapping | check SDA→D10 and RST→D9, and that the reader has 3.3 V |
| `PCD_Init` hangs or UIDs look random | loose jumper wires on MOSI/MISO/SCK; keep the wires short |
| Arduino resets when the servo moves | power the servo from a separate 5 V supply (shared GND) |
| My UID has 7 bytes | your card type uses 7-byte UIDs: extend `ALLOWED` and the `uid.size` check to 7 |

---

**Next:** [7 · Build the Ultrasonic Radar →](07-build-radar-sweep.md)
