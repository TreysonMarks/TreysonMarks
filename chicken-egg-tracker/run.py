#!/usr/bin/env python3
"""Main capture-and-track loop.

Run this on the Raspberry Pi (typically as a systemd service). It opens the
camera, advances a ZoneTracker for each nesting box on every frame, and writes a
row to the database whenever an egg is confirmed.

    python run.py                       # use config.yaml + chickens.yaml
    python run.py --config my.yaml --chickens hens.yaml
    python run.py --source file:sample.mp4   # override the camera for a quick test
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime

import cv2

from coop_tracker.camera import open_source
from coop_tracker.config import load_config
from coop_tracker.storage import Storage
from coop_tracker.tracker import ZoneTracker, crop_zone

log = logging.getLogger("coop")


def parse_args(argv=None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Track which hen lays each egg.")
    p.add_argument("--config", default="config.yaml")
    p.add_argument("--chickens", default="chickens.yaml")
    p.add_argument("--source", help="Override camera.source (e.g. file:clip.mp4)")
    p.add_argument("--verbose", action="store_true")
    return p.parse_args(argv)


def save_snapshot(frame, zone, snapshot_dir: str, ts: datetime) -> str:
    os.makedirs(snapshot_dir, exist_ok=True)
    roi = crop_zone(frame, zone.rect)
    stamp = ts.strftime("%Y%m%d-%H%M%S")
    filename = f"{stamp}_{zone.name}.jpg"
    path = os.path.join(snapshot_dir, filename)
    cv2.imwrite(path, roi)
    return path


def main(argv=None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    cfg = load_config(args.config, args.chickens)
    if args.source:
        cfg.camera.source = args.source

    if not cfg.zones:
        log.error("No nesting-box zones configured. Run calibrate.py first.")
        return 2
    if not cfg.chickens:
        log.warning("No chickens configured — eggs will be logged as 'Unknown'.")

    storage = Storage(cfg.storage.db_path)
    trackers = [ZoneTracker(z, cfg.chickens, cfg.processing) for z in cfg.zones]

    log.info(
        "Watching %d box(es) for %d hen(s). Source=%s",
        len(trackers), len(cfg.chickens), cfg.camera.source,
    )

    frame_index = 0
    primed = False
    try:
        for frame in open_source(cfg.camera):
            frame_index += 1
            if frame_index % cfg.processing.process_every_n_frames != 0:
                continue

            if not primed:
                for t in trackers:
                    t.prime(frame)
                primed = True
                log.info("Background models primed on the first frame.")
                continue

            now = datetime.now()
            for t in trackers:
                event = t.update(frame, now)
                if event is None:
                    continue
                if cfg.storage.save_snapshots:
                    event.snapshot_path = save_snapshot(
                        frame, t.zone, cfg.storage.snapshot_dir, now
                    )
                storage.record(event)
                who = event.chicken or "an unidentified hen"
                log.info(
                    "🥚 %s laid %d egg(s) in %s (confidence %.0f%%)",
                    who, event.eggs, event.box, event.confidence * 100,
                )
    except KeyboardInterrupt:
        log.info("Stopping (keyboard interrupt).")
    finally:
        storage.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
