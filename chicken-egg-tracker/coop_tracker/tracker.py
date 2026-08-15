"""Per-zone state machine that turns a stream of frames into laying events.

For each nesting box we run this tiny state machine:

    EMPTY ──hen arrives──▶ OCCUPIED ──hen leaves──▶ SETTLING ──stable──▶ EMPTY
                              │  (identify her here)      │ (count eggs here)
                              ▲───────hen returns─────────┘

* While EMPTY we keep a rolling baseline of how many eggs are already in the box.
* On entering OCCUPIED we freeze that baseline and start voting on who she is.
* SETTLING waits a few frames after she leaves so the nest is calm and any new
  egg is visible, then compares the egg count to the baseline. A positive delta
  is credited to the hen who won the vote.

The state machine is deliberately framework-free and deterministic so it can be
unit-tested by feeding it a scripted sequence of frames.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

import numpy as np

from .config import Chicken, ProcessingConfig, Zone
from .egg_detect import count_eggs
from .identify import BandVoter, identify
from .presence import PresenceDetector
from .storage import LayingEvent


class State(Enum):
    EMPTY = "empty"
    OCCUPIED = "occupied"
    SETTLING = "settling"


def crop_zone(frame: np.ndarray, rect) -> np.ndarray:
    """Crop (x, y, w, h) from a frame, clamped to the frame bounds."""

    x, y, w, h = rect
    fh, fw = frame.shape[:2]
    x0 = max(0, min(x, fw))
    y0 = max(0, min(y, fh))
    x1 = max(0, min(x + w, fw))
    y1 = max(0, min(y + h, fh))
    return frame[y0:y1, x0:x1]


class ZoneTracker:
    def __init__(
        self,
        zone: Zone,
        chickens: List[Chicken],
        proc: ProcessingConfig,
    ) -> None:
        self.zone = zone
        self.chickens = chickens
        self.proc = proc
        self.presence = PresenceDetector()
        self.voter = BandVoter()

        self.state = State.EMPTY
        self.enter_count = 0
        self.exit_count = 0
        self.settle_count = 0
        self.visit_frames = 0

        self.eggs_baseline = 0     # eggs seen while the box sits empty
        self.eggs_before = 0       # baseline frozen at the moment a hen entered

        # Exposed for logging / the live overlay.
        self.last_ratio = 0.0

    def prime(self, frame: np.ndarray) -> None:
        """Warm up the background model and egg baseline on an empty box."""

        roi = crop_zone(frame, self.zone.rect)
        self.presence.prime(roi)
        self.eggs_baseline = count_eggs(roi, self.proc.egg)

    def update(self, frame: np.ndarray, now: Optional[datetime] = None) -> Optional[LayingEvent]:
        """Advance the state machine by one frame; return an event if one fired."""

        now = now or datetime.now()
        roi = crop_zone(frame, self.zone.rect)
        ratio = self.presence.foreground_ratio(roi)
        self.last_ratio = ratio
        present = ratio >= self.proc.presence.enter_ratio

        if self.state is State.EMPTY:
            # While empty, let the presence reference drift with the daylight, and
            # refresh the baseline egg count so egg collection (which lowers it) is
            # never mistaken for laying and stray bedding settles out.
            if not present:
                self.presence.update_reference(roi)
            self.eggs_baseline = count_eggs(roi, self.proc.egg)
            if present:
                self.enter_count += 1
                if self.enter_count >= self.proc.presence.enter_frames:
                    self.eggs_before = self.eggs_baseline
                    self.voter.reset()
                    self.visit_frames = 0
                    self.enter_count = 0
                    self.state = State.OCCUPIED
            else:
                self.enter_count = 0
            return None

        if self.state is State.OCCUPIED:
            self.visit_frames += 1
            if present:
                self.exit_count = 0
                ident = identify(roi, self.chickens, self.proc.min_band_pixels)
                self.voter.add(ident)
            else:
                self.exit_count += 1
                if self.exit_count >= self.proc.presence.exit_frames:
                    self.exit_count = 0
                    self.settle_count = 0
                    self.state = State.SETTLING
            return None

        if self.state is State.SETTLING:
            if present:
                # False alarm — she shifted, not left. Resume the visit.
                self.settle_count = 0
                self.state = State.OCCUPIED
                return None

            self.settle_count += 1
            if self.settle_count < self.proc.presence.settle_frames:
                return None

            # Nest is calm again: decide whether a new egg appeared.
            self.settle_count = 0
            self.state = State.EMPTY
            eggs_after = count_eggs(roi, self.proc.egg)
            delta = eggs_after - self.eggs_before
            self.eggs_baseline = eggs_after

            if self.visit_frames < self.proc.presence.min_visit_frames:
                return None  # too brief to be a real sit
            if delta < 1:
                return None  # no new egg

            return LayingEvent(
                chicken=self.voter.winner(),
                box=self.zone.name,
                eggs=int(delta),
                confidence=self.voter.winner_confidence(),
                ts=now,
            )

        return None
