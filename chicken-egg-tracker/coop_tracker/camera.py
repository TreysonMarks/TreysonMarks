"""Frame sources.

The rest of the program just calls ``frames()`` and gets a stream of BGR numpy
arrays. This module hides where they come from so the exact same detection code
runs against the Pi camera in the coop and against a video file on your laptop.
"""

from __future__ import annotations

import time
from typing import Iterator

import cv2
import numpy as np

from .config import CameraConfig


def _rotate(frame: np.ndarray, degrees: int) -> np.ndarray:
    if degrees == 90:
        return cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
    if degrees == 180:
        return cv2.rotate(frame, cv2.ROTATE_180)
    if degrees == 270:
        return cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return frame


def open_source(cfg: CameraConfig) -> Iterator[np.ndarray]:
    """Yield BGR frames forever (or until a finite source is exhausted)."""

    src = cfg.source

    if src == "picamera2":
        yield from _picamera2_frames(cfg)
    elif src.startswith("opencv:"):
        index = int(src.split(":", 1)[1])
        yield from _opencv_frames(index, cfg)
    elif src.startswith("file:"):
        path = src.split(":", 1)[1]
        yield from _opencv_frames(path, cfg, loop=True)
    elif src.startswith("image:"):
        path = src.split(":", 1)[1]
        yield from _image_frames(path, cfg)
    else:
        raise ValueError(
            f"Unknown camera source {src!r}. Use picamera2, opencv:<n>, "
            f"file:<path> or image:<path>."
        )


def _picamera2_frames(cfg: CameraConfig) -> Iterator[np.ndarray]:
    # Imported lazily: picamera2 only exists on the Raspberry Pi, and we don't
    # want importing this module to fail on a dev machine.
    from picamera2 import Picamera2  # type: ignore

    picam = Picamera2()
    config = picam.create_video_configuration(
        main={"size": (cfg.width, cfg.height), "format": "RGB888"}
    )
    picam.configure(config)
    picam.start()
    interval = 1.0 / max(cfg.fps, 1)
    try:
        while True:
            rgb = picam.capture_array()
            frame = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
            yield _rotate(frame, cfg.rotate)
            time.sleep(interval)
    finally:
        picam.stop()


def _opencv_frames(source, cfg: CameraConfig, loop: bool = False) -> Iterator[np.ndarray]:
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video source {source!r}")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, cfg.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cfg.height)
    interval = 1.0 / max(cfg.fps, 1)
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                if loop:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                break
            yield _rotate(frame, cfg.rotate)
            time.sleep(interval)
    finally:
        cap.release()


def _image_frames(path: str, cfg: CameraConfig) -> Iterator[np.ndarray]:
    frame = cv2.imread(path)
    if frame is None:
        raise RuntimeError(f"Could not read image {path!r}")
    frame = _rotate(frame, cfg.rotate)
    interval = 1.0 / max(cfg.fps, 1)
    while True:
        yield frame.copy()
        time.sleep(interval)
