"""SQLite persistence for laying events.

One table, ``events``, one row per confirmed laying event. Everything the
dashboard shows is a query over this table. SQLite means zero setup on the Pi
and the whole history is a single portable file you can copy off for backup.
"""

from __future__ import annotations

import os
import sqlite3
from dataclasses import dataclass
from datetime import date, datetime
from typing import Dict, List, Optional


@dataclass
class LayingEvent:
    chicken: Optional[str]   # None when a hen couldn't be identified
    box: str
    eggs: int
    confidence: float
    ts: datetime
    snapshot_path: Optional[str] = None


_SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ts            TEXT    NOT NULL,          -- ISO 8601, local time
    day           TEXT    NOT NULL,          -- YYYY-MM-DD, for fast per-day grouping
    chicken       TEXT,                      -- NULL if unidentified
    box           TEXT    NOT NULL,
    eggs          INTEGER NOT NULL DEFAULT 1,
    confidence    REAL    NOT NULL DEFAULT 0,
    snapshot_path TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_day ON events(day);
CREATE INDEX IF NOT EXISTS idx_events_chicken ON events(chicken);
"""


class Storage:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        parent = os.path.dirname(db_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def record(self, event: LayingEvent) -> int:
        cur = self._conn.execute(
            """
            INSERT INTO events (ts, day, chicken, box, eggs, confidence, snapshot_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event.ts.isoformat(timespec="seconds"),
                event.ts.date().isoformat(),
                event.chicken,
                event.box,
                event.eggs,
                round(event.confidence, 4),
                event.snapshot_path,
            ),
        )
        self._conn.commit()
        return int(cur.lastrowid)

    # ---- queries used by the dashboard -------------------------------------

    def eggs_for_day(self, day: date) -> Dict[str, int]:
        """{chicken_name: egg_count} for one day. Unidentified rows key on 'Unknown'."""

        rows = self._conn.execute(
            """
            SELECT COALESCE(chicken, 'Unknown') AS name, SUM(eggs) AS total
            FROM events WHERE day = ? GROUP BY name ORDER BY total DESC
            """,
            (day.isoformat(),),
        ).fetchall()
        return {row["name"]: int(row["total"]) for row in rows}

    def daily_totals(self, days: int = 14) -> List[Dict]:
        """Per-day, per-chicken totals for the last ``days`` calendar days."""

        rows = self._conn.execute(
            """
            SELECT day, COALESCE(chicken, 'Unknown') AS name, SUM(eggs) AS total
            FROM events
            WHERE day >= date('now', 'localtime', ?)
            GROUP BY day, name
            ORDER BY day DESC
            """,
            (f"-{int(days)} days",),
        ).fetchall()
        return [dict(row) for row in rows]

    def totals_by_chicken(self) -> Dict[str, int]:
        """All-time egg totals per chicken."""

        rows = self._conn.execute(
            """
            SELECT COALESCE(chicken, 'Unknown') AS name, SUM(eggs) AS total
            FROM events GROUP BY name ORDER BY total DESC
            """
        ).fetchall()
        return {row["name"]: int(row["total"]) for row in rows}

    def recent_events(self, limit: int = 25) -> List[Dict]:
        rows = self._conn.execute(
            "SELECT * FROM events ORDER BY id DESC LIMIT ?", (int(limit),)
        ).fetchall()
        return [dict(row) for row in rows]
