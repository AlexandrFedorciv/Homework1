# PartsBin docs

## Tutorials

| # | Tutorial | What you'll learn | Time |
|---|---|---|---|
| 1 | [Getting started](tutorials/01-getting-started.md) | install, first run without a key, add your key, web UI, gallery | 10 min |
| 2 | [From a photo to projects](tutorials/02-photo-to-projects.md) | detect parts from a photo, confirm and correct the list | 5 min |
| 3 | [Constraints, checks and the shopping list](tutorials/03-constraints-and-shopping-list.md) | every constraint, how the self-check replaces bad projects, reading the output | 10 min |
| 4 | [Customize the catalog and the gallery](tutorials/04-customize-the-catalog.md) | change prices, add part names and parts, add your own example projects | 15 min |
| 5 | [Build the Pi-hole Ad Blocker](tutorials/05-build-pi-hole.md) | block ads and trackers for your whole home network with a Raspberry Pi | ~1.5 h |
| 6 | [Build the RFID Access Lock](tutorials/06-build-rfid-lock.md) | a card-operated latch with lockout, Arduino code included | ~2 h |
| 7 | [Build the Ultrasonic Radar](tutorials/07-build-radar-sweep.md) | a servo-swept sensor plus a live Python radar screen | ~3 h |
| 8 | [Build the Air Theremin](tutorials/08-build-air-theremin.md) | play music by waving your hand, Arduino code included | ~2 h |

## Example code

| Project | Files |
|---|---|
| RFID Access Lock | [`examples/rfid-lock/rfid-lock.ino`](../examples/rfid-lock/rfid-lock.ino) |
| Ultrasonic Radar | [`examples/radar-sweep/radar-sweep.ino`](../examples/radar-sweep/radar-sweep.ino), [`examples/radar-sweep/radar_viewer.py`](../examples/radar-sweep/radar_viewer.py) |
| Air Theremin | [`examples/air-theremin/air-theremin.ino`](../examples/air-theremin/air-theremin.ino) |

## Pictures

- `images/screenshots/`: the CLI and web UI
- `images/gallery/`: a parts drawing for every gallery project (regenerate with `npm run gallery:images`)
- `images/photos/`: openly licensed photos of similar finished builds, see [CREDITS](images/photos/CREDITS.md)
- `images/examples/`: pictures used in the tutorials
