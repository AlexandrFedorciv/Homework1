# PartsBin docs

## Tutorials

| # | Tutorial | What you'll learn | Time |
|---|---|---|---|
| 1 | [Getting started](tutorials/01-getting-started.md) | install, first run without a key, add your key, web UI, gallery | 10 min |
| 2 | [From a photo to projects](tutorials/02-photo-to-projects.md) | detect parts from a photo, confirm and correct the list | 5 min |
| 3 | [Constraints, checks and the shopping list](tutorials/03-constraints-and-shopping-list.md) | every constraint, how the self-check replaces bad projects, reading the output | 10 min |
| 4 | [Customize the catalog and the gallery](tutorials/04-customize-the-catalog.md) | change prices, add part names and parts, add your own example projects | 15 min |
| 5 | [Build the Air Theremin](tutorials/05-build-air-theremin.md) | a complete hardware build with Arduino code | ~2 h |
| 6 | [Build the Ultrasonic Radar](tutorials/06-build-radar-sweep.md) | a complete build with Arduino + Python live viewer | ~3 h |

## Example code

| Project | Files |
|---|---|
| Air Theremin | [`examples/air-theremin/air-theremin.ino`](../examples/air-theremin/air-theremin.ino) |
| Ultrasonic Radar | [`examples/radar-sweep/radar-sweep.ino`](../examples/radar-sweep/radar-sweep.ino), [`examples/radar-sweep/radar_viewer.py`](../examples/radar-sweep/radar_viewer.py) |

## Pictures

- `images/screenshots/`: the CLI and web UI
- `images/gallery/`: a parts picture for every gallery project (regenerate with `npm run gallery:images`)
- `images/examples/`: pictures used in the tutorials
