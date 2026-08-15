"""Identify a hen by the color of her leg band.

Given a color crop of a nesting box (the region where a hen's legs appear), we
build an HSV mask per chicken and count how many pixels fall inside that band's
color range. The hen with the most matching pixels — provided she clears a
minimum-pixel floor — wins that frame.

Color is far more robust than trying to read numbers off a moving bird, which is
why we asked for solid colored bands.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

import cv2
import numpy as np

from .config import Chicken


@dataclass
class Identification:
    name: Optional[str]          # winning chicken, or None if nothing cleared the floor
    pixel_counts: Dict[str, int]  # per-chicken matching pixel counts (for debugging)
    confidence: float            # winner's share of all matched band pixels, 0..1


def band_mask(hsv_image: np.ndarray, chicken: Chicken) -> np.ndarray:
    """Binary mask of pixels matching any of this chicken's HSV ranges."""

    mask = np.zeros(hsv_image.shape[:2], dtype=np.uint8)
    for rng in chicken.hsv_ranges:
        lower = np.array(rng.lower, dtype=np.uint8)
        upper = np.array(rng.upper, dtype=np.uint8)
        mask = cv2.bitwise_or(mask, cv2.inRange(hsv_image, lower, upper))
    return mask


def identify(
    bgr_roi: np.ndarray,
    chickens: List[Chicken],
    min_pixels: int = 60,
) -> Identification:
    """Score a color ROI against every chicken and return the best band match."""

    if bgr_roi.size == 0:
        return Identification(name=None, pixel_counts={}, confidence=0.0)

    # A light blur suppresses single-pixel color noise before thresholding.
    blurred = cv2.GaussianBlur(bgr_roi, (5, 5), 0)
    hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV)

    counts: Dict[str, int] = {}
    for chicken in chickens:
        counts[chicken.name] = int(np.count_nonzero(band_mask(hsv, chicken)))

    if not counts:
        return Identification(name=None, pixel_counts={}, confidence=0.0)

    best_name = max(counts, key=counts.get)
    best_count = counts[best_name]
    total = sum(counts.values())

    if best_count < min_pixels:
        return Identification(name=None, pixel_counts=counts, confidence=0.0)

    confidence = best_count / total if total else 0.0
    return Identification(name=best_name, pixel_counts=counts, confidence=confidence)


class BandVoter:
    """Accumulates per-frame identifications across a single nesting-box visit.

    A hen shifts around while she's in the box, so any one frame can misfire.
    We tally weighted votes over the whole visit and take the winner at the end.
    """

    def __init__(self) -> None:
        self._votes: Dict[str, float] = {}
        self.frames_seen = 0

    def add(self, ident: Identification) -> None:
        self.frames_seen += 1
        if ident.name is not None:
            # Weight each vote by its confidence so clean frames count for more.
            self._votes[ident.name] = self._votes.get(ident.name, 0.0) + ident.confidence

    def winner(self) -> Optional[str]:
        if not self._votes:
            return None
        return max(self._votes, key=self._votes.get)

    def winner_confidence(self) -> float:
        if not self._votes:
            return 0.0
        total = sum(self._votes.values())
        return self._votes[self.winner()] / total if total else 0.0

    def reset(self) -> None:
        self._votes.clear()
        self.frames_seen = 0
