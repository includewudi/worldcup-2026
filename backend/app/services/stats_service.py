"""Simple visit/visitor stats with JSON file persistence.

File resets on container cold start (acceptable for Render free tier).
Visitors tracked via SHA256-hashed client IP for privacy (one-way hash).
"""
import hashlib
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

_STATS_FILE = Path(__file__).resolve().parent.parent / "data" / "stats.json"
_lock = threading.Lock()

_DEFAULT = {
    "total_visits": 0,
    "unique_visitors": 0,
    "visitor_hashes": [],
    "daily": {},
    "last_visit": None,
}


def _load() -> dict:
    if not _STATS_FILE.exists():
        return dict(_DEFAULT)
    try:
        data = json.loads(_STATS_FILE.read_text())
        for k, v in _DEFAULT.items():
            data.setdefault(k, v)
        return data
    except (json.JSONDecodeError, OSError):
        return dict(_DEFAULT)


def _save(data: dict) -> None:
    try:
        _STATS_FILE.parent.mkdir(parents=True, exist_ok=True)
        _STATS_FILE.write_text(json.dumps(data, ensure_ascii=False))
    except OSError:
        pass


def _hash_ip(ip: str) -> str:
    salt = os.environ.get("STATS_SALT", "wc2026")
    return hashlib.sha256(f"{salt}:{ip}".encode()).hexdigest()[:16]


def record_visit(ip: str | None, path: str = "/") -> dict:
    ip = ip or "unknown"
    visitor_hash = _hash_ip(ip)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    with _lock:
        data = _load()
        data["total_visits"] += 1

        is_new = visitor_hash not in data["visitor_hashes"]
        if is_new:
            data["visitor_hashes"].append(visitor_hash)
            data["unique_visitors"] += 1
            if len(data["visitor_hashes"]) > 5000:
                data["visitor_hashes"] = data["visitor_hashes"][-5000:]

        data["daily"][today] = data["daily"].get(today, 0) + 1
        recent = sorted(data["daily"].keys())[-30:]
        data["daily"] = {k: data["daily"][k] for k in recent}

        data["last_visit"] = datetime.now(timezone.utc).isoformat()
        _save(data)

    return get_stats()


def get_stats() -> dict:
    data = _load()
    return {
        "total_visits": data["total_visits"],
        "unique_visitors": data["unique_visitors"],
        "today": data["daily"].get(datetime.now(timezone.utc).strftime("%Y-%m-%d"), 0),
        "last_visit": data.get("last_visit"),
        "daily": dict(sorted(data.get("daily", {}).items())[-7:]),
    }
