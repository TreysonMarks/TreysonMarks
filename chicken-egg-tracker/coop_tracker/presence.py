"""Detect whether a hen is currently in a nesting box.

Each zone keeps a reference image of the *empty* nest. Every frame we take the
absolute difference from that reference; when a hen is in the box a large
fraction of the pixels differ, so the foreground ratio spikes.

The key detail is *when* the reference updates. The tracker only refreshes it
while the box is empty, so:

* slow lighting changes over the day are absorbed (no false detections), but
* a hen who sits perfectly still for several minutes never gets learned into the
  background — she keeps differing from the last empty view and stays detected.

That second property is why we don't use an always-adapting model like MOG2: a
broody hen would slowly vanish from it.
"""

from __future__ import annotations

from typing import Optional

import cv2
import numpy as np


class PresenceDetector:
    """Reference-difference foreground estimator for one nesting-box zone."""

    def __init__(self, diff_threshold: int = 25) -> None:
        self.diff_threshold = diff_threshold
        self._reference: Optional[np.ndarray] = None  # float32 grayscale
        self._kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    @staticmethod
    def _gray(bgr_zone: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(bgr_zone, cv2.COLOR_BGR2GRAY)
        return cv2.GaussianBlur(gray, (5, 5), 0)

    def prime(self, bgr_zone: np.ndarray, frames: int = 1) -> None:
        """Seed the reference directly from an (assumed empty) nest view."""

        if bgr_zone.size == 0:
            return
        self._reference = self._gray(bgr_zone).astype(np.float32)

    def foreground_ratio(self, bgr_zone: np.ndarray) -> float:
        """Fraction of the zone (0..1) that differs from the empty reference."""

        if bgr_zone.size == 0:
            return 0.0
        gray = self._gray(bgr_zone)
        if self._reference is None:
            self._reference = gray.astype(np.float32)
            return 0.0
        diff = cv2.absdiff(gray, self._reference.astype(np.uint8))
        _, mask = cv2.threshold(diff, self.diff_threshold, 255, cv2.THRESH_BINARY)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self._kernel)
        return float(np.count_nonzero(mask)) / float(mask.size)

    def update_reference(self, bgr_zone: np.ndarray, alpha: float = 0.05) -> None:
        """Blend the current (empty) view into the reference to track lighting.

        Call this only when the box is empty. ``alpha`` sets how fast the
        reference drifts — small values track gradual daylight changes without
        chasing brief disturbances.
        """

        if bgr_zone.size == 0:
            return
        gray = self._gray(bgr_zone).astype(np.float32)
        if self._reference is None:
            self._reference = gray
        else:
            cv2.accumulateWeighted(gray, self._reference, alpha)
