#!/usr/bin/env python3
"""Calibration helpers for setting up the coop camera.

Setup is three steps, and this script has a subcommand for each:

1. ``snapshot``       Grab one frame from the camera so you can see what it sees.
2. ``preview-zones``  Draw your configured nesting-box rectangles onto that frame
                      so you can confirm each box lines up with a zone.
3. ``sample-band``    Point at the region of the image where a hen's colored band
                      is, and get an HSV range to paste into chickens.yaml.

Everything works headless (it reads/writes image files), so you can run it over
SSH on the Pi and copy the preview images to your laptop to look at them.

Examples
--------
    python calibrate.py snapshot --out coop.jpg
    python calibrate.py preview-zones --image coop.jpg --out zones.jpg
    python calibrate.py sample-band --image coop.jpg --rect 480 560 40 40
"""

from __future__ import annotations

import argparse
import sys

import cv2
import numpy as np

from coop_tracker.camera import open_source
from coop_tracker.config import load_config


def cmd_snapshot(args) -> int:
    cfg = load_config(args.config, args.chickens)
    if args.source:
        cfg.camera.source = args.source
    frame = next(open_source(cfg.camera))
    cv2.imwrite(args.out, frame)
    h, w = frame.shape[:2]
    print(f"Saved {args.out} ({w}x{h}). Open it and note the pixel corners of each box.")
    return 0


def cmd_preview_zones(args) -> int:
    cfg = load_config(args.config, args.chickens)
    frame = cv2.imread(args.image)
    if frame is None:
        print(f"Could not read {args.image}", file=sys.stderr)
        return 1
    for zone in cfg.zones:
        x, y, w, h = zone.rect
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
        cv2.putText(
            frame, zone.name, (x + 4, y + 22),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2,
        )
    cv2.imwrite(args.out, frame)
    print(f"Saved {args.out} with {len(cfg.zones)} zone(s) drawn.")
    return 0


def cmd_sample_band(args) -> int:
    frame = cv2.imread(args.image)
    if frame is None:
        print(f"Could not read {args.image}", file=sys.stderr)
        return 1

    x, y, w, h = args.rect
    patch = frame[y:y + h, x:x + w]
    if patch.size == 0:
        print("Rectangle is outside the image.", file=sys.stderr)
        return 1

    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
    med = np.median(hsv.reshape(-1, 3), axis=0).astype(int)
    hue, sat, val = int(med[0]), int(med[1]), int(med[2])

    h_margin, s_floor, v_floor = 10, max(60, sat - 80), max(50, val - 80)

    print(f"# Sampled median HSV = ({hue}, {sat}, {val})")
    print("# Paste under this hen's `hsv_ranges:` in chickens.yaml —")
    if hue < h_margin or hue > 179 - h_margin:
        # Red wraps around the hue circle, so emit two ranges.
        print("    hsv_ranges:")
        print(f"      - lower: [0, {s_floor}, {v_floor}]")
        print(f"        upper: [{h_margin}, 255, 255]")
        print(f"      - lower: [{179 - h_margin}, {s_floor}, {v_floor}]")
        print("        upper: [179, 255, 255]")
    else:
        lo_h, hi_h = max(0, hue - h_margin), min(179, hue + h_margin)
        print("    hsv_ranges:")
        print(f"      - lower: [{lo_h}, {s_floor}, {v_floor}]")
        print(f"        upper: [{hi_h}, 255, 255]")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--config", default="config.yaml")
    p.add_argument("--chickens", default="chickens.yaml")
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("snapshot", help="Grab one frame from the camera.")
    s.add_argument("--out", default="coop.jpg")
    s.add_argument("--source", help="Override camera.source")
    s.set_defaults(func=cmd_snapshot)

    z = sub.add_parser("preview-zones", help="Draw configured zones on an image.")
    z.add_argument("--image", required=True)
    z.add_argument("--out", default="zones.jpg")
    z.set_defaults(func=cmd_preview_zones)

    b = sub.add_parser("sample-band", help="Suggest an HSV range from an image region.")
    b.add_argument("--image", required=True)
    b.add_argument("--rect", type=int, nargs=4, metavar=("X", "Y", "W", "H"), required=True)
    b.set_defaults(func=cmd_sample_band)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
