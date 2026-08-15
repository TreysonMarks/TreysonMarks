#!/usr/bin/env python3
"""Flask dashboard for browsing egg-laying history.

Read-only view over the same SQLite database ``run.py`` writes to. Start it on
the Pi and open http://<pi-address>:8080 from your phone in the coop, or from a
laptop on the same network.

    python dashboard.py
    python dashboard.py --config config.yaml
"""

from __future__ import annotations

import argparse
from datetime import date

from flask import Flask, render_template

from coop_tracker.config import load_config
from coop_tracker.storage import Storage


def create_app(config_path: str = "config.yaml", chickens_path: str = "chickens.yaml") -> Flask:
    cfg = load_config(config_path, chickens_path)
    app = Flask(__name__)
    known_names = [c.name for c in cfg.chickens]

    def get_storage() -> Storage:
        # A fresh connection per request keeps this thread-safe under Flask's
        # dev server without a connection pool.
        return Storage(cfg.storage.db_path)

    @app.route("/")
    def index():
        storage = get_storage()
        try:
            today = date.today()
            today_eggs = storage.eggs_for_day(today)
            # Show every known hen, even the ones with zero eggs today.
            for name in known_names:
                today_eggs.setdefault(name, 0)

            totals = storage.totals_by_chicken()
            for name in known_names:
                totals.setdefault(name, 0)

            recent = storage.recent_events(limit=25)
            history = storage.daily_totals(days=14)

            # Pivot the flat history rows into {day: {chicken: eggs}} for a grid.
            days_sorted = sorted({row["day"] for row in history}, reverse=True)
            names_sorted = sorted(totals.keys())
            grid = {d: {n: 0 for n in names_sorted} for d in days_sorted}
            for row in history:
                grid[row["day"]][row["name"]] = row["total"]

            return render_template(
                "dashboard.html",
                today=today.isoformat(),
                today_eggs=dict(sorted(today_eggs.items())),
                today_total=sum(today_eggs.values()),
                totals=dict(sorted(totals.items(), key=lambda kv: -kv[1])),
                recent=recent,
                grid=grid,
                grid_days=days_sorted,
                grid_names=names_sorted,
            )
        finally:
            storage.close()

    return app


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Egg-laying dashboard.")
    p.add_argument("--config", default="config.yaml")
    p.add_argument("--chickens", default="chickens.yaml")
    args = p.parse_args(argv)

    cfg = load_config(args.config, args.chickens)
    app = create_app(args.config, args.chickens)
    app.run(host=cfg.dashboard.host, port=cfg.dashboard.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
