import numpy as np
import cv2

from coop_tracker.config import Chicken, HsvRange
from coop_tracker.identify import identify, BandVoter, Identification


RED = Chicken("Henrietta", "red", [
    HsvRange((0, 120, 70), (10, 255, 255)),
    HsvRange((169, 120, 70), (179, 255, 255)),
])
BLUE = Chicken("Nugget", "blue", [HsvRange((100, 120, 70), (130, 255, 255))])
GREEN = Chicken("Marshmallow", "green", [HsvRange((40, 80, 70), (80, 255, 255))])
FLOCK = [RED, BLUE, GREEN]


def _patch(color_bgr, size=60):
    img = np.zeros((size, size, 3), dtype=np.uint8)
    img[:] = color_bgr
    return img


def test_identifies_dominant_red_band():
    ident = identify(_patch((0, 0, 255)), FLOCK, min_pixels=30)
    assert ident.name == "Henrietta"
    assert ident.confidence > 0.9


def test_identifies_blue_band():
    ident = identify(_patch((255, 0, 0)), FLOCK, min_pixels=30)
    assert ident.name == "Nugget"


def test_no_match_on_plain_gray():
    ident = identify(_patch((110, 110, 110)), FLOCK, min_pixels=30)
    assert ident.name is None
    assert ident.confidence == 0.0


def test_min_pixels_floor_rejects_tiny_speck():
    img = np.zeros((60, 60, 3), dtype=np.uint8)
    img[0:2, 0:2] = (0, 0, 255)  # only 4 red pixels
    ident = identify(img, FLOCK, min_pixels=30)
    assert ident.name is None


def test_empty_roi_is_safe():
    ident = identify(np.zeros((0, 0, 3), dtype=np.uint8), FLOCK)
    assert ident.name is None


def test_voter_picks_majority_over_a_visit():
    voter = BandVoter()
    for _ in range(5):
        voter.add(Identification("Henrietta", {}, 0.9))
    voter.add(Identification("Nugget", {}, 0.4))   # one noisy frame
    voter.add(Identification(None, {}, 0.0))       # one blank frame
    assert voter.winner() == "Henrietta"
    assert voter.frames_seen == 7
    assert voter.winner_confidence() > 0.8


def test_voter_empty_returns_none():
    assert BandVoter().winner() is None
