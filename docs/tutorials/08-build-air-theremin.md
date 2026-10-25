# 8 · Build the Air Theremin

**Difficulty:** beginner · **Time:** ~2 hours · **Soldering:** none

A theremin is an instrument you play without touching it. Ours measures how far your hand is from an ultrasonic sensor and turns that distance into a note. A potentiometer switches between three musical scales. On the pentatonic one it's almost impossible to play a wrong note.

This is one of PartsBin's [gallery projects](../../data/showcase.json) (`--project air-theremin`), written out in full with tested-to-compile code.

![Air Theremin parts](../images/gallery/air-theremin.svg)

---

## Parts

| Part | Qty | Notes |
|---|---|---|
| Arduino Uno (or clone) | 1 | a Nano works too: same pins |
| HC-SR04 ultrasonic sensor | 1 | |
| **Passive** piezo buzzer | 1 | an *active* buzzer can only beep one pitch. Passive ones usually have no sticker and a visible circuit board underneath |
| 10 kΩ potentiometer | 1 | any value 1k–100k works |
| Breadboard + jumper wires | 1 set | |

Check what you're missing:

```bash
npm start -- --project air-theremin "arduino uno, hc-sr04, breadboard, jumper wires"
```

## Wiring

| From | To |
|---|---|
| HC-SR04 **VCC** | 5V |
| HC-SR04 **GND** | GND |
| HC-SR04 **TRIG** | D9 |
| HC-SR04 **ECHO** | D10 |
| Buzzer **+** (longer leg / marked +) | D8 |
| Buzzer **−** | GND |
| Potentiometer **left leg** | 5V |
| Potentiometer **right leg** | GND |
| Potentiometer **middle leg** (wiper) | A0 |

Tips:
- Put the breadboard's red rail on 5V and the blue rail on GND, then connect every VCC/GND to the rails.
- Point the sensor **up**, with nothing above it for at least 60 cm.

## Step 1: Test the sensor alone

Before writing the instrument, make sure the sensor works. Upload the full sketch from step 3 and open **Tools → Serial Monitor** at **115200 baud**. Move your hand: you should see lines like

```
23.4 cm  scale=major  note=67
```

No lines? Check TRIG/ECHO aren't swapped and that VCC is on 5V, not 3.3V.

## Step 2: How the code works

1. **Measure:** a 10 µs pulse on TRIG makes the sensor send an ultrasonic chirp. ECHO stays HIGH until the echo returns. `pulseIn()` measures that time, and `µs / 58` converts it to centimetres (sound goes there *and back*).
2. **Smooth:** the last 5 readings are averaged so the note doesn't jitter.
3. **Zone:** the 5–50 cm range is split into 8 zones, inverted so **a closer hand = a higher note**.
4. **Scale:** the potentiometer is read in thirds: major, minor, pentatonic. Each scale is a list of semitone offsets from C4 (MIDI note 60).
5. **Play:** a MIDI note becomes a frequency with `440 × 2^((note − 69) / 12)`. `tone()` plays it, only when the note changes, to avoid clicks.
6. **Silence:** if no hand is seen for 300 ms, `noTone()`.

## Step 3: Upload the code

The complete sketch is in [`examples/air-theremin/air-theremin.ino`](../../examples/air-theremin/air-theremin.ino).

1. Open it in the Arduino IDE (it will offer to put it in a folder of the same name: say yes).
2. **Tools → Board → Arduino Uno**, **Tools → Port →** your board (on Windows `COM3` or similar).
3. Click **Upload**.

No libraries are needed.

## Step 4: Play

- Hold your hand flat, 5–50 cm above the sensor, and move it slowly up and down.
- Turn the potentiometer to switch scales. The Serial Monitor shows which one is active. Find the pentatonic end and try "Twinkle Twinkle".
- The Serial Monitor shows which note you're on, which helps you learn the zones.

## Make it yours

| Idea | Change |
|---|---|
| Lower / higher pitch | `ROOT_NOTE = 48` (one octave down) or `72` (up) |
| Bigger playing area | `MAX_CM = 70` (the sensor gets less reliable beyond ~80 cm) |
| More notes | add a 4th scale with 12 entries, and set `ZONES = 12` |
| Louder | a small speaker through a 100 Ω resistor instead of the piezo |
| Light show | add an LED on D6 and set its brightness with `analogWrite()` from the zone |

## Troubleshooting

| Problem | Fix |
|---|---|
| Only one pitch, very loud | you have an *active* buzzer, so swap it for a passive one |
| Notes jump randomly | something else is in the sensor's cone (wall, lamp). Point it at the ceiling and increase `AVG_N` |
| Silent, but the Serial Monitor shows notes | buzzer polarity, or buzzer on the wrong pin (must be D8) |
| Nothing in the Serial Monitor | wrong baud rate (must be 115200), or TRIG/ECHO swapped |

---

[← Back to all tutorials](../README.md)
