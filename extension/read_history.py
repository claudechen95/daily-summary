#!/usr/bin/env python3
"""
read_history.py — Extract today's Chrome browsing history.

Chrome locks its History SQLite DB while running, so we copy it to /tmp first.

Duration strategy (most accurate first):
  1. Extension active time (active_time/YYYY-MM-DD.jsonl) — real foreground ms
     recorded by the Chrome extension via the Page Visibility API.
  2. Chrome visit_duration (capped at 15 min) — fallback when extension data
     is missing for a domain.
  3. Gap-to-next-visit (capped at 2 min) — for 0-duration visits with no
     extension data.

Usage: python3 read_history.py [--date YYYY-MM-DD] [--hours N]
"""

import sqlite3
import shutil
import tempfile
import os
import json
import argparse
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse
from typing import List, Dict, Set


# Chrome stores timestamps as microseconds since 1601-01-01 00:00:00 UTC
CHROME_EPOCH = datetime(1601, 1, 1, tzinfo=timezone.utc)


def chrome_ts_to_dt(chrome_ts: int) -> datetime:
    return CHROME_EPOCH + timedelta(microseconds=chrome_ts)


def find_chrome_history() -> Path:
    home = Path.home()

    # Search roots for Chrome-family browsers (macOS, Linux, Windows)
    search_roots = [
        home / "Library/Application Support/Google/Chrome",
        home / "Library/Application Support/Google/Chrome Beta",
        home / "Library/Application Support/Google/Chrome Canary",
        home / "Library/Application Support/BraveSoftware/Brave-Browser",
        home / "Library/Application Support/Microsoft Edge",
        home / "AppData/Local/Google/Chrome/User Data",
        home / ".config/google-chrome",
        home / ".config/chromium",
    ]

    best_path = None
    best_count = 0

    for root in search_roots:
        if not root.exists():
            continue
        # Glob ALL profile folders (Default, Profile 1, Profile 2, ... Profile N)
        for candidate in root.glob("*/History"):
            if not candidate.is_file():
                continue
            try:
                with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as tmp:
                    tmp_path = tmp.name
                shutil.copy2(candidate, tmp_path)
                conn = sqlite3.connect(f"file:{tmp_path}?mode=ro", uri=True)
                count = conn.execute("SELECT COUNT(*) FROM visits").fetchone()[0]
                conn.close()
                os.unlink(tmp_path)
                print(f"   Profile: {candidate.parent.name}  visits={count}", flush=True)
                if count > best_count:
                    best_count = count
                    best_path = candidate
            except Exception:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

    if best_path:
        print(f"   Using: {best_path}  ({best_count} visits)", flush=True)
        return best_path

    raise FileNotFoundError(
        "Could not find a non-empty Chrome History file.\n"
        f"Searched under: {home}/Library/Application Support/\n"
        "Make sure Chrome has been used at least once.\n"
        "You can also set HISTORY_PATH=/path/to/History as an env var to override."
    )


def find_history_from_env_or_auto() -> Path:
    """Allow HISTORY_PATH env var override."""
    env_path = os.environ.get("HISTORY_PATH")
    if env_path:
        p = Path(env_path)
        if p.exists():
            return p
        raise FileNotFoundError(f"HISTORY_PATH set but file not found: {env_path}")
    return find_chrome_history()


def load_extension_active_time(date: "datetime.date") -> Dict[str, float]:
    """
    Load per-domain active seconds from Chrome extension TIME_RECORD events.
    Returns {domain: total_active_seconds}.
    Falls back to empty dict if the file doesn't exist (extension not installed,
    or first day of tracking).
    """
    active_time_path = Path(__file__).parent / "active_time" / f"{date}.jsonl"
    if not active_time_path.exists():
        return {}

    domain_ms: Dict[str, float] = defaultdict(float)
    with open(active_time_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            domain = record.get("domain", "").lstrip("www.")
            ms = record.get("active_ms", 0)
            if domain and ms:
                domain_ms[domain] += ms

    result = {d: ms / 1000.0 for d, ms in domain_ms.items()}
    if result:
        total_s = sum(result.values())
        print(f"   Extension time data: {len(result)} domains, "
              f"{total_s/60:.1f} min total foreground time", flush=True)
    return result


def load_history(date: "datetime.date") -> List[Dict]:
    history_path = find_history_from_env_or_auto()

    # Copy to temp file to avoid SQLite lock while Chrome is open
    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as tmp:
        tmp_path = tmp.name
    shutil.copy2(history_path, tmp_path)

    try:
        conn = sqlite3.connect(f"file:{tmp_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Build UTC window for the requested local date
        local_tz = datetime.now().astimezone().tzinfo
        day_start = datetime(date.year, date.month, date.day, tzinfo=local_tz).astimezone(timezone.utc)
        day_end = day_start + timedelta(days=1)

        def to_chrome_ts(dt: datetime) -> int:
            return int((dt - CHROME_EPOCH).total_seconds() * 1_000_000)

        cur.execute(
            """
            SELECT
                v.visit_time,
                v.visit_duration,
                u.url,
                u.title
            FROM visits v
            JOIN urls u ON v.url = u.id
            WHERE v.visit_time BETWEEN ? AND ?
            ORDER BY v.visit_time ASC
            """,
            (to_chrome_ts(day_start), to_chrome_ts(day_end)),
        )
        rows = cur.fetchall()
        conn.close()
    finally:
        os.unlink(tmp_path)

    visits = []
    for row in rows:
        dt = chrome_ts_to_dt(row["visit_time"]).astimezone()
        # visit_duration is in microseconds; 0 means Chrome didn't measure it.
        # Cap at 15 minutes — background tabs left open inflate this otherwise.
        # (Extension active time overrides this per-domain later.)
        MAX_VISIT_S = 15 * 60
        duration_s = min((row["visit_duration"] or 0) / 1_000_000, MAX_VISIT_S)
        visits.append(
            {
                "timestamp": dt.isoformat(),
                "hour": dt.hour,
                "minute": dt.minute,
                "url": row["url"],
                "title": row["title"] or "",
                "domain": urlparse(row["url"]).netloc.lstrip("www."),
                "duration_seconds": round(duration_s, 1),
            }
        )

    # For visits where Chrome reported 0 duration, estimate from gap to next visit
    MAX_GAP = 2 * 60  # seconds — conservative fallback for 0-duration visits
    for i, v in enumerate(visits):
        if v["duration_seconds"] == 0 and i + 1 < len(visits):
            next_ts = datetime.fromisoformat(visits[i + 1]["timestamp"])
            curr_ts = datetime.fromisoformat(v["timestamp"])
            gap = (next_ts - curr_ts).total_seconds()
            v["duration_seconds"] = round(min(gap, MAX_GAP), 1)

    # ── Override with extension active time ───────────────────────────────────
    # When the extension has real foreground data for a domain, scale that
    # domain's visit durations so they sum to the extension's measured total.
    # This keeps per-visit proportions (for timeline) while using accurate totals.
    ext_time = load_extension_active_time(date)

    if ext_time:
        # Group visits by domain
        domain_visits: Dict[str, List[Dict]] = defaultdict(list)
        for v in visits:
            domain_visits[v["domain"]].append(v)

        for domain, ext_s in ext_time.items():
            dvs = domain_visits.get(domain)
            if not dvs:
                continue
            chrome_total = sum(v["duration_seconds"] for v in dvs)
            if chrome_total > 0:
                # Scale proportionally so domain total = ext_s
                scale = ext_s / chrome_total
                for v in dvs:
                    v["duration_seconds"] = round(v["duration_seconds"] * scale, 1)
                    v["duration_source"] = "extension"
            else:
                # No chrome duration at all — spread extension time evenly
                per_visit = ext_s / len(dvs)
                for v in dvs:
                    v["duration_seconds"] = round(per_visit, 1)
                    v["duration_source"] = "extension"

    return visits


def compute_wall_clock_time(visits: List[Dict]) -> float:
    """Merge overlapping visit windows to get true wall-clock browsing time.

    Chrome's visit_duration counts every open tab independently, so parallel
    tabs inflate the raw sum far beyond 24h. Merging overlapping intervals gives
    the actual time the user had a browser window in front of them.
    """
    intervals = []
    for v in visits:
        dur = v.get("duration_seconds", 0)
        if dur <= 0:
            continue
        try:
            start = datetime.fromisoformat(v["timestamp"]).timestamp()
        except Exception:
            continue
        intervals.append((start, start + dur))

    if not intervals:
        return 0.0

    intervals.sort()
    seg_start, seg_end = intervals[0]
    total = 0.0
    for start, end in intervals[1:]:
        if start <= seg_end:
            seg_end = max(seg_end, end)
        else:
            total += seg_end - seg_start
            seg_start, seg_end = start, end
    total += seg_end - seg_start
    return total


def compute_stats(visits: List[Dict]) -> Dict:
    domain_counts: Dict[str, int] = defaultdict(int)
    domain_time: Dict[str, float] = defaultdict(float)
    hourly_domains: Dict[int, Set] = defaultdict(set)
    ext_domains: int = 0

    for v in visits:
        domain_counts[v["domain"]] += 1
        domain_time[v["domain"]] += v.get("duration_seconds", 0)
        hourly_domains[v["hour"]].add(v["domain"])
        if v.get("duration_source") == "extension":
            ext_domains += 1

    top_sites = sorted(domain_counts.items(), key=lambda x: x[1], reverse=True)[:20]
    top_by_time = sorted(domain_time.items(), key=lambda x: x[1], reverse=True)[:20]

    # Build hourly timeline buckets
    timeline = {}
    for hour in range(24):
        if hour in hourly_domains:
            timeline[f"{hour:02d}:00"] = sorted(hourly_domains[hour])

    # Use de-overlapped wall-clock time when no extension data is present.
    # Extension foreground time is already parallel-safe; Chrome fallback is not.
    if ext_domains > 0:
        total_time_s = sum(domain_time.values())
    else:
        total_time_s = compute_wall_clock_time(visits)

    ext_coverage = f"{ext_domains}/{len(visits)} visits from extension" if ext_domains else "none"

    return {
        "total_visits": len(visits),
        "unique_domains": len(domain_counts),
        "total_active_seconds": round(total_time_s),
        "extension_coverage": ext_coverage,
        "top_sites": [{"domain": d, "visits": c} for d, c in top_sites],
        "top_by_time": [
            {"domain": d, "seconds": round(s), "minutes": round(s / 60, 1)}
            for d, s in top_by_time
        ],
        "timeline": timeline,
    }


def main():
    parser = argparse.ArgumentParser(description="Extract Chrome browsing history for a given day.")
    parser.add_argument("--date", default=None, help="Date as YYYY-MM-DD (default: today)")
    parser.add_argument("--output", default=None, help="Output JSON path (default: stdout)")
    args = parser.parse_args()

    if args.date:
        date = datetime.strptime(args.date, "%Y-%m-%d").date()
    else:
        date = datetime.now().date()

    print(f"Reading Chrome history for {date}…", flush=True)
    visits = load_history(date)
    stats = compute_stats(visits)

    result = {
        "date": str(date),
        "stats": stats,
        "visits": visits,
    }

    if args.output:
        Path(args.output).write_text(json.dumps(result, indent=2))
        print(f"Saved {len(visits)} visits → {args.output}")
    else:
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
