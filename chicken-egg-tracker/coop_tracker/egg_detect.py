"""Count eggs in an (empty) nesting box.

This only runs when no hen is present — after she leaves, we compare the egg
count to what it was before she arrived. Eggs are lighter and rounder than
bedding, so we threshold for bright regions and keep blobs whose area, aspect
ratio and roundness look egg-like.

Counting the *number* of egg-like blobs (rather than just "something changed")
lets a single hen be credited with two eggs, and lets a human collecting eggs
lower the baseline without being mistaken for a laying event.
"""

from __future__ import annotations

from typing import List, Tuple

import cv2
import numpy as np

from .config import EggConfig


def count_eggs(bgr_zone: np.ndarray, cfg: EggConfig) -> int:
    """Return how many egg-like blobs are visible in this zone."""

    return len(find_eggs(bgr_zone, cfg))


def find_eggs(bgr_zone: np.ndarray, cfg: EggConfig) -> List[Tuple[int, int, int, int]]:
    """Return bounding boxes (x, y, w, h) of egg-like blobs in the zone."""

    if bgr_zone.size == 0:
        return []

    gray = cv2.cvtColor(bgr_zone, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)

    _, thresh = cv2.threshold(gray, cfg.brightness_thresh, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    eggs: List[Tuple[int, int, int, int]] = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < cfg.min_area or area > cfg.max_area:
            continue

        x, y, w, h = cv2.boundingRect(contour)
        aspect = w / h if h else 0.0
        if aspect < cfg.min_aspect or aspect > cfg.max_aspect:
            continue

        perimeter = cv2.arcLength(contour, True)
        if perimeter == 0:
            continue
        circularity = 4.0 * np.pi * area / (perimeter * perimeter)
        if circularity < cfg.circularity_min:
            continue

        eggs.append((x, y, w, h))

    return eggs
