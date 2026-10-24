#!/usr/bin/env python3
"""
Live radar screen for the PartsBin "Ultrasonic Radar Sweep" project.

Reads "angle,distance_cm" lines from the Arduino and draws them as fading green dots
on a half-circle radar, with a sweep line showing where the sensor is pointing.

Install:  pip install pyserial matplotlib
Run:      python radar_viewer.py COM3              (Windows — see Device Manager → Ports)
          python radar_viewer.py /dev/ttyUSB0      (Linux)
          python radar_viewer.py /dev/cu.usbmodem1101   (macOS)
Options:  --range 100   max distance shown in cm
          --fade 4      seconds before a dot fades out
Close the Arduino IDE's Serial Monitor first — only one program can use the port.
"""

import argparse
import math
import threading
import time

import matplotlib.pyplot as plt
import numpy as np
import serial
from matplotlib.animation import FuncAnimation

parser = argparse.ArgumentParser(description="Live radar view for the PartsBin radar sweep")
parser.add_argument("port", help="serial port, e.g. COM3 or /dev/ttyUSB0")
parser.add_argument("--baud", type=int, default=115200)
parser.add_argument("--range", type=float, default=100.0, help="max distance in cm")
parser.add_argument("--fade", type=float, default=4.0, help="seconds until a dot disappears")
args = parser.parse_args()

points: dict[int, tuple[float, float]] = {}  # angle -> (distance_cm, time seen)
state = {"angle": 90}
lock = threading.Lock()


def read_serial(ser: serial.Serial) -> None:
    """Background thread: parse lines like '42,37.5' as they arrive."""
    while ser.is_open:
        try:
            line = ser.readline().decode("ascii", errors="ignore").strip()
        except (serial.SerialException, OSError, TypeError):
            break  # port closed or Arduino unplugged

        if "," not in line:
            continue
        try:
            angle_s, dist_s = line.split(",", 1)
            angle, dist = int(angle_s), float(dist_s)
        except ValueError:
            continue  # half a line right after connecting, or other noise
        with lock:
            state["angle"] = angle
            if 0 < dist <= args.range:
                points[angle] = (dist, time.time())
            else:
                points.pop(angle, None)


ser = serial.Serial(args.port, args.baud, timeout=1)
threading.Thread(target=read_serial, args=(ser,), daemon=True).start()

GREEN = "#39ff6a"
fig = plt.figure(figsize=(9, 5.5), facecolor="black")
ax = fig.add_subplot(projection="polar", facecolor="black")
ax.set_thetamin(0)
ax.set_thetamax(180)
ax.set_rmax(args.range)
ax.set_rticks(np.linspace(args.range / 4, args.range, 4))
ax.tick_params(colors=GREEN, labelsize=9)
ax.grid(color=GREEN, alpha=0.25)
ax.spines["polar"].set_color(GREEN)
ax.set_title("PartsBin radar  (cm)", color=GREEN, pad=12)

dots = ax.scatter([], [], s=36)
(sweep,) = ax.plot([], [], color=GREEN, linewidth=2, alpha=0.8)


def update(_frame):
    now = time.time()
    with lock:
        items = list(points.items())
        angle = state["angle"]

    thetas, radii, colors = [], [], []
    for a, (dist, seen) in items:
        age = now - seen
        if age > args.fade:
            continue
        thetas.append(math.radians(a))
        radii.append(dist)
        colors.append((0.22, 1.0, 0.42, max(0.1, 1 - age / args.fade)))

    dots.set_offsets(np.column_stack([thetas, radii]) if thetas else np.empty((0, 2)))
    dots.set_facecolors(colors if colors else "none")
    sweep.set_data([math.radians(angle)] * 2, [0, args.range])
    return dots, sweep


anim = FuncAnimation(fig, update, interval=50, blit=False, cache_frame_data=False)
try:
    plt.show()
finally:
    ser.close()
