"""Shared test helpers: builders for synthetic coop frames."""

import os
import sys

import numpy as np
import cv2

# Make the project importable when running `pytest` from the repo root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def empty_nest(w=320, h=240, gray=110):
    """A calm, empty nest: uniform mid-gray, darker than an egg."""
    return np.full((h, w, 3), gray, dtype=np.uint8)


def nest_with_egg(w=320, h=240, gray=110, center=(160, 120)):
    """An empty nest with one bright egg-shaped blob."""
    frame = empty_nest(w, h, gray)
    cv2.ellipse(frame, center, (30, 20), 0, 0, 360, (255, 255, 255), -1)
    return frame


def hen_present(color_bgr, w=320, h=240, seed=0):
    """A hen filling the box: dark body + a colored leg band + a little motion.

    The random noise mimics a shifting bird so background subtraction keeps
    seeing foreground instead of learning the hen into the background.
    """
    rng = np.random.default_rng(seed)
    frame = np.full((h, w, 3), 60, dtype=np.uint8)  # dark brown-ish body
    noise = rng.integers(-15, 16, size=frame.shape, dtype=np.int16)
    frame = np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    # A solid colored leg band patch.
    cv2.rectangle(frame, (140, 180), (180, 220), color_bgr, -1)
    return frame
