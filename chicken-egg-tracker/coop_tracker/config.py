"""Configuration loading for the coop tracker.

Config lives in two YAML files so the two things you'll edit most often are
separated:

* ``config.yaml``   — camera, nesting-box zones, detection thresholds, storage.
* ``chickens.yaml`` — the registry of hens and the HSV color of each leg band.

Both are loaded into plain dataclasses so the rest of the code gets attribute
access and editor autocomplete instead of nested dict lookups.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Tuple

import yaml

# An HSV triple, e.g. (0, 120, 70). OpenCV uses H in [0, 179], S/V in [0, 255].
Hsv = Tuple[int, int, int]


@dataclass
class HsvRange:
    """A lower/upper HSV band. Red wraps the hue circle so a band may need two."""

    lower: Hsv
    upper: Hsv


@dataclass
class Chicken:
    """One hen and the color of her leg band."""

    name: str
    band: str  # human-readable color name, purely for display
    hsv_ranges: List[HsvRange] = field(default_factory=list)


@dataclass
class Zone:
    """A nesting box as a rectangle in the camera frame: (x, y, width, height)."""

    name: str
    rect: Tuple[int, int, int, int]


@dataclass
class PresenceConfig:
    enter_ratio: float = 0.06     # foreground fraction that counts as "a hen is here"
    enter_frames: int = 3         # consecutive frames above the ratio to enter OCCUPIED
    exit_frames: int = 5          # consecutive frames below it to consider her gone
    settle_frames: int = 8        # frames to wait after she leaves before counting eggs
    min_visit_frames: int = 4     # ignore fly-throughs shorter than this


@dataclass
class EggConfig:
    min_area: int = 400
    max_area: int = 20000
    min_aspect: float = 0.5       # width/height of the egg's bounding box
    max_aspect: float = 1.6
    brightness_thresh: int = 170  # eggs are lighter than nesting material
    circularity_min: float = 0.55


@dataclass
class ProcessingConfig:
    process_every_n_frames: int = 1
    presence: PresenceConfig = field(default_factory=PresenceConfig)
    egg: EggConfig = field(default_factory=EggConfig)
    min_band_pixels: int = 60     # min matching pixels to trust a band identification


@dataclass
class CameraConfig:
    # source is one of:
    #   "picamera2"          — the Raspberry Pi camera module (default on the Pi)
    #   "opencv:<index>"     — a USB webcam, e.g. "opencv:0"
    #   "file:<path>"        — loop a video file (great for testing)
    #   "image:<path>"       — repeat a single still image (unit tests / demos)
    source: str = "picamera2"
    width: int = 1280
    height: int = 720
    fps: int = 5
    rotate: int = 0               # 0, 90, 180 or 270 degrees


@dataclass
class StorageConfig:
    db_path: str = "data/eggs.db"
    snapshot_dir: str = "data/snapshots"
    save_snapshots: bool = True


@dataclass
class DashboardConfig:
    host: str = "0.0.0.0"
    port: int = 8080


@dataclass
class Config:
    camera: CameraConfig
    processing: ProcessingConfig
    storage: StorageConfig
    dashboard: DashboardConfig
    zones: List[Zone]
    chickens: List[Chicken]


def _load_yaml(path: str | Path) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def _tuple3(seq) -> Hsv:
    if len(seq) != 3:
        raise ValueError(f"HSV value must have 3 components, got {seq!r}")
    return (int(seq[0]), int(seq[1]), int(seq[2]))


def load_chickens(path: str | Path) -> List[Chicken]:
    # The chicken registry is written after calibration, so tolerate it being
    # absent — callers that need it (run.py) warn on an empty list.
    if not Path(path).exists():
        return []
    raw = _load_yaml(path)
    chickens: List[Chicken] = []
    for item in raw.get("chickens", []):
        ranges = [
            HsvRange(lower=_tuple3(r["lower"]), upper=_tuple3(r["upper"]))
            for r in item.get("hsv_ranges", [])
        ]
        chickens.append(
            Chicken(name=item["name"], band=item.get("band", ""), hsv_ranges=ranges)
        )
    return chickens


def load_config(
    config_path: str | Path = "config.yaml",
    chickens_path: str | Path = "chickens.yaml",
) -> Config:
    raw = _load_yaml(config_path)

    cam = raw.get("camera", {})
    camera = CameraConfig(
        source=cam.get("source", "picamera2"),
        width=int(cam.get("width", 1280)),
        height=int(cam.get("height", 720)),
        fps=int(cam.get("fps", 5)),
        rotate=int(cam.get("rotate", 0)),
    )

    proc = raw.get("processing", {})
    pres = proc.get("presence", {})
    egg = proc.get("egg", {})
    processing = ProcessingConfig(
        process_every_n_frames=int(proc.get("process_every_n_frames", 1)),
        min_band_pixels=int(proc.get("min_band_pixels", 60)),
        presence=PresenceConfig(
            enter_ratio=float(pres.get("enter_ratio", 0.06)),
            enter_frames=int(pres.get("enter_frames", 3)),
            exit_frames=int(pres.get("exit_frames", 5)),
            settle_frames=int(pres.get("settle_frames", 8)),
            min_visit_frames=int(pres.get("min_visit_frames", 4)),
        ),
        egg=EggConfig(
            min_area=int(egg.get("min_area", 400)),
            max_area=int(egg.get("max_area", 20000)),
            min_aspect=float(egg.get("min_aspect", 0.5)),
            max_aspect=float(egg.get("max_aspect", 1.6)),
            brightness_thresh=int(egg.get("brightness_thresh", 170)),
            circularity_min=float(egg.get("circularity_min", 0.55)),
        ),
    )

    store = raw.get("storage", {})
    storage = StorageConfig(
        db_path=store.get("db_path", "data/eggs.db"),
        snapshot_dir=store.get("snapshot_dir", "data/snapshots"),
        save_snapshots=bool(store.get("save_snapshots", True)),
    )

    dash = raw.get("dashboard", {})
    dashboard = DashboardConfig(
        host=dash.get("host", "0.0.0.0"),
        port=int(dash.get("port", 8080)),
    )

    zones = [
        Zone(name=z["name"], rect=tuple(int(v) for v in z["rect"]))
        for z in raw.get("zones", [])
    ]

    chickens = load_chickens(chickens_path)

    return Config(
        camera=camera,
        processing=processing,
        storage=storage,
        dashboard=dashboard,
        zones=zones,
        chickens=chickens,
    )
