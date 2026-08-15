from datetime import datetime

from coop_tracker.config import (
    Chicken, HsvRange, ProcessingConfig, PresenceConfig, EggConfig, Zone,
)
from coop_tracker.tracker import ZoneTracker, crop_zone, State
from conftest import empty_nest, nest_with_egg, hen_present


RED = Chicken("Henrietta", "red", [
    HsvRange((0, 120, 70), (10, 255, 255)),
    HsvRange((169, 120, 70), (179, 255, 255)),
])
BLUE = Chicken("Nugget", "blue", [HsvRange((100, 120, 70), (130, 255, 255))])


def _proc():
    # Short, test-friendly debounce windows.
    return ProcessingConfig(
        min_band_pixels=30,
        presence=PresenceConfig(
            enter_ratio=0.05, enter_frames=2, exit_frames=2,
            settle_frames=2, min_visit_frames=2,
        ),
        egg=EggConfig(),
    )


def _feed(tracker, frame, n):
    """Feed a frame n times, returning the first event produced (or None)."""
    event = None
    for _ in range(n):
        result = tracker.update(frame, datetime(2026, 8, 15, 9, 0, 0))
        event = event or result
    return event


def _feed_hen(tracker, color_bgr, n):
    """Feed n *distinct* hen frames so the background model keeps seeing motion."""
    event = None
    for i in range(n):
        frame = hen_present(color_bgr, seed=i)
        result = tracker.update(frame, datetime(2026, 8, 15, 9, 0, 0))
        event = event or result
    return event


def test_crop_zone_clamps_to_bounds():
    frame = empty_nest(100, 100)
    cropped = crop_zone(frame, (80, 80, 100, 100))  # runs off the edge
    assert cropped.shape[0] <= 20 and cropped.shape[1] <= 20


def test_full_laying_sequence_attributes_egg_to_red_hen():
    zone = Zone("box-1", (0, 0, 320, 240))
    tracker = ZoneTracker(zone, [RED, BLUE], _proc())

    tracker.prime(empty_nest())
    # Calm empty nest for a bit — baseline should read zero eggs.
    _feed(tracker, empty_nest(), 3)
    assert tracker.state is State.EMPTY
    assert tracker.eggs_baseline == 0

    # Red-banded hen arrives and sits.
    _feed_hen(tracker, (0, 0, 255), 6)
    assert tracker.state is State.OCCUPIED
    assert tracker.voter.winner() == "Henrietta"

    # She leaves, and now there's a fresh egg in the nest.
    event = _feed(tracker, nest_with_egg(), 6)
    assert event is not None
    assert event.chicken == "Henrietta"
    assert event.box == "box-1"
    assert event.eggs == 1
    assert tracker.state is State.EMPTY


def test_visit_without_new_egg_produces_nothing():
    zone = Zone("box-1", (0, 0, 320, 240))
    tracker = ZoneTracker(zone, [RED, BLUE], _proc())
    tracker.prime(empty_nest())
    _feed(tracker, empty_nest(), 3)
    _feed_hen(tracker, (0, 0, 255), 6)      # hen visits
    event = _feed(tracker, empty_nest(), 6)           # ...but leaves no egg
    assert event is None


def test_egg_collection_lowers_baseline_without_false_event():
    zone = Zone("box-1", (0, 0, 320, 240))
    tracker = ZoneTracker(zone, [RED], _proc())
    tracker.prime(nest_with_egg())          # start with an egg already present
    _feed(tracker, nest_with_egg(), 3)
    assert tracker.eggs_baseline == 1
    # Human removes the egg; nest becomes empty. No hen was ever present.
    _feed(tracker, empty_nest(), 3)
    assert tracker.eggs_baseline == 0
    assert tracker.state is State.EMPTY
