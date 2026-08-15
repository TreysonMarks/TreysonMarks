import cv2

from coop_tracker.config import EggConfig
from coop_tracker.egg_detect import count_eggs, find_eggs
from conftest import empty_nest, nest_with_egg


CFG = EggConfig()


def test_no_eggs_in_empty_nest():
    assert count_eggs(empty_nest(), CFG) == 0


def test_counts_single_egg():
    assert count_eggs(nest_with_egg(), CFG) == 1


def test_counts_two_eggs():
    frame = empty_nest()
    cv2.ellipse(frame, (110, 120), (28, 20), 0, 0, 360, (255, 255, 255), -1)
    cv2.ellipse(frame, (210, 120), (28, 20), 0, 0, 360, (250, 250, 250), -1)
    assert count_eggs(frame, CFG) == 2


def test_ignores_tiny_bright_speck():
    frame = empty_nest()
    cv2.circle(frame, (50, 50), 3, (255, 255, 255), -1)  # far below min_area
    assert count_eggs(frame, CFG) == 0


def test_find_eggs_returns_bounding_box():
    boxes = find_eggs(nest_with_egg(center=(160, 120)), CFG)
    assert len(boxes) == 1
    x, y, w, h = boxes[0]
    # Box should roughly bracket the ellipse we drew (axes 30x20 at 160,120).
    assert 120 < x + w / 2 < 200
    assert 80 < y + h / 2 < 160
