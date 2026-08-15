import os
from datetime import datetime, date, timedelta

from coop_tracker.storage import Storage, LayingEvent


def _storage(tmp_path):
    return Storage(os.path.join(tmp_path, "eggs.db"))


def test_record_and_daily_total(tmp_path):
    s = _storage(tmp_path)
    now = datetime(2026, 8, 15, 9, 0, 0)
    s.record(LayingEvent("Henrietta", "box-1", 1, 0.9, now))
    s.record(LayingEvent("Henrietta", "box-1", 1, 0.8, now))
    s.record(LayingEvent("Nugget", "box-2", 1, 0.7, now))

    day = s.eggs_for_day(date(2026, 8, 15))
    assert day["Henrietta"] == 2
    assert day["Nugget"] == 1
    s.close()


def test_unidentified_rolls_up_as_unknown(tmp_path):
    s = _storage(tmp_path)
    now = datetime(2026, 8, 15, 9, 0, 0)
    s.record(LayingEvent(None, "box-3", 1, 0.0, now))
    assert s.eggs_for_day(date(2026, 8, 15))["Unknown"] == 1
    assert s.totals_by_chicken()["Unknown"] == 1
    s.close()


def test_multi_egg_delta(tmp_path):
    s = _storage(tmp_path)
    now = datetime(2026, 8, 15, 9, 0, 0)
    s.record(LayingEvent("Marshmallow", "box-1", 2, 0.6, now))
    assert s.totals_by_chicken()["Marshmallow"] == 2
    s.close()


def test_recent_events_ordered_newest_first(tmp_path):
    s = _storage(tmp_path)
    base = datetime(2026, 8, 15, 8, 0, 0)
    for i in range(3):
        s.record(LayingEvent("Henrietta", "box-1", 1, 0.9, base + timedelta(minutes=i)))
    recent = s.recent_events(limit=2)
    assert len(recent) == 2
    assert recent[0]["ts"] >= recent[1]["ts"]
    s.close()
