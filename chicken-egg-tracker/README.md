# 🐔 Coop Egg Tracker

Figure out **which hen laid which egg**, using one Raspberry Pi, one camera
pointed at the nesting boxes, and colored leg bands on the birds.

The Pi watches the nesting boxes. When a hen settles into a box it identifies her
by the color of her leg band; when she leaves, it checks whether a new egg
appeared and credits it to her. Everything is logged to a little database and
shown on a phone-friendly web dashboard.

```
        one camera, wide view of the boxes
                     │
   ┌─────────────────┼─────────────────┐
   │  box-1          box-2          box-3   │   ← you split the frame into zones
   └─────────────────┼─────────────────┘
                     ▼
   for each box:  is a hen here?  ──►  who is she? (leg-band color)
                     │
                 she left ──►  did a new egg appear?  ──►  log it to her
                                                             │
                                                     web dashboard 🥚
```

## How it works

Each nesting box is a rectangle you mark in the camera frame (a "zone"). For each
zone the program runs a small state machine (`coop_tracker/tracker.py`):

1. **Presence** — it keeps a reference picture of the *empty* nest and measures
   how much the box differs from it. A hen makes most of the box change, so the
   "foreground" jumps. The reference only updates while the box is empty, so slow
   daylight changes are absorbed but a hen sitting still for a long time never
   disappears from view. (`presence.py`)
2. **Identity** — while she's in the box, it looks for pixels matching each hen's
   leg-band color (an HSV range per hen) and votes across the whole visit for the
   best match. (`identify.py`)
3. **Egg check** — after she leaves and the nest settles, it counts bright,
   egg-shaped blobs and compares to how many were there before she arrived. A new
   one is credited to the hen who won the vote. (`egg_detect.py`)
4. **Log & show** — the event goes into SQLite (`storage.py`) and appears on the
   Flask dashboard (`dashboard.py`).

Colored bands (not numbered ones) are the whole reason this is feasible: reading
color off a moving bird is far more reliable than reading tiny printed digits.

## What you need

- Raspberry Pi (a Pi 4 or Pi 5 is comfortable; a Pi 3 or Zero 2 W works at a few
  frames per second).
- A camera: the Raspberry Pi Camera Module, or any USB webcam.
- **Solid colored leg bands, a clearly different color per hen.** Avoid
  easily-confused pairs (red/orange, blue/teal, etc.).
- The camera mounted so it can see into all the nesting boxes — you said one
  angle covers all three, which is exactly the supported setup.

## Install (on the Pi)

```bash
git clone <this repo> chicken-egg-tracker
cd chicken-egg-tracker
bash scripts/install.sh
```

That installs dependencies and copies `config.example.yaml` → `config.yaml` and
`chickens.example.yaml` → `chickens.yaml` for you to edit.

To try it on a laptop first (no Pi camera needed), install the dev deps and point
it at a video file:

```bash
pip install -r requirements-dev.txt
python run.py --source file:some_coop_clip.mp4 --verbose
```

## Set it up (calibration)

**1. Take a snapshot to see what the camera sees:**

```bash
python calibrate.py snapshot --out coop.jpg
```

**2. Mark the nesting boxes.** Open `coop.jpg`, note the pixel corners of each
box, and put them in `config.yaml` under `zones` as `[x, y, width, height]`.
Check your work:

```bash
python calibrate.py preview-zones --image coop.jpg --out zones.jpg
```

`zones.jpg` shows green rectangles where the program thinks each box is.

**3. Register each hen's band color.** Find the region in `coop.jpg` where a
hen's band appears and sample it — this prints a ready-to-paste HSV block:

```bash
python calibrate.py sample-band --image coop.jpg --rect X Y W H
```

Paste each hen's block into `chickens.yaml` and give her a name.

## Run it

```bash
python run.py --verbose          # capture loop; logs an event per confirmed egg
python dashboard.py              # web dashboard on http://<pi>:8080
```

To start both automatically on boot:

```bash
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now chicken-tracker chicken-dashboard
```

## Tuning

All thresholds live in `config.yaml` and are commented there. The ones you're
most likely to touch:

| Setting | What it does | Turn it… |
|---|---|---|
| `presence.enter_ratio` | how much of a box must change to count as "a hen is here" | **down** if hens are missed, **up** if shadows trigger it |
| `egg.brightness_thresh` | how bright a blob must be to be an egg | **up** if pale bedding is counted as eggs |
| `egg.min_area` / `max_area` | allowed egg blob size in pixels | match to how big eggs look at your camera height |
| `min_band_pixels` | how many band-colored pixels are needed to trust an ID | **up** if hens get misidentified |

Snapshots of each confirmed egg are saved under `data/snapshots/` so you can spot
check and adjust.

## Honest limitations

This is a hobby computer-vision project, not a lab instrument. Expect to tune it,
and expect some mistakes:

- If two hens are in the same box, or one hen's band isn't visible, identification
  can be wrong or fall back to **"Unknown"**.
- A hen who lays and a hen who just visits look similar until the egg check; very
  dark boxes or eggs the same color as bedding are harder.
- It infers "she laid it because a new egg appeared during her visit" — it can't
  literally watch the egg emerge. Camera placement (a clear top-down-ish view of
  each nest) matters more than anything else for accuracy.

Start with two or three well-separated band colors, watch the dashboard and the
saved snapshots for a few days, and adjust the thresholds.

## Project layout

```
run.py                 Capture loop: camera → trackers → database
dashboard.py           Flask web dashboard
calibrate.py           Snapshot / zone-preview / band-color helper
config.example.yaml    Camera, zones, detection thresholds  → copy to config.yaml
chickens.example.yaml  Hen registry + band colors           → copy to chickens.yaml
coop_tracker/
  config.py            Loads the YAML into typed dataclasses
  camera.py            Frame sources (Pi camera / USB / video file / image)
  presence.py          Is a hen in the box?
  identify.py          Which hen? (leg-band color)
  egg_detect.py        Count egg-shaped blobs
  tracker.py           Per-box state machine tying it together
  storage.py           SQLite logging + dashboard queries
templates/             Dashboard HTML
systemd/               Service files for auto-start on boot
tests/                 Test suite (run: python -m pytest)
```

## Tests

```bash
python -m pytest
```

The tests build synthetic coop frames and exercise the full pipeline — hen
identification, egg counting, the state machine, storage, and config loading —
so you can refactor with confidence.
