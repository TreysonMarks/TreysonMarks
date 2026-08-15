import os

from coop_tracker.config import load_config

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_example_configs_load():
    cfg = load_config(
        os.path.join(HERE, "config.example.yaml"),
        os.path.join(HERE, "chickens.example.yaml"),
    )
    assert len(cfg.zones) == 3
    assert cfg.zones[0].name == "box-1"
    assert len(cfg.zones[0].rect) == 4

    names = [c.name for c in cfg.chickens]
    assert "Henrietta" in names

    # Red band should have two HSV ranges (it wraps the hue circle).
    red = next(c for c in cfg.chickens if c.name == "Henrietta")
    assert len(red.hsv_ranges) == 2
    assert red.hsv_ranges[0].lower == (0, 120, 70)


def test_defaults_when_sections_missing(tmp_path):
    cfg_path = os.path.join(tmp_path, "c.yaml")
    hens_path = os.path.join(tmp_path, "h.yaml")
    with open(cfg_path, "w") as fh:
        fh.write("zones: []\n")
    with open(hens_path, "w") as fh:
        fh.write("chickens: []\n")
    cfg = load_config(cfg_path, hens_path)
    assert cfg.camera.source == "picamera2"
    assert cfg.processing.presence.enter_ratio == 0.06
    assert cfg.dashboard.port == 8080
