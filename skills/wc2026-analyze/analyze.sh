#!/usr/bin/env bash
set -euo pipefail

BACKEND=""

if [[ -n "${WC2026_BACKEND:-}" ]] && [[ -f "$WC2026_BACKEND/analyze.py" ]]; then
  BACKEND="$WC2026_BACKEND"
fi

for p in "$HOME/data/code/python/worldcup-2026/backend" "$HOME/worldcup-2026/backend"; do
  if [[ -f "$p/analyze.py" ]]; then
    BACKEND="$p"
    break
  fi
done

if [[ -f "$BACKEND/../.venv/bin/python" ]]; then
  PY="$BACKEND/../.venv/bin/python"
elif [[ -f "$BACKEND/.venv/bin/python" ]]; then
  PY="$BACKEND/.venv/bin/python"
else
  PY="python3"
fi

if curl -s --connect-timeout 2 http://localhost:8570/api/sync/status >/dev/null 2>&1; then
  curl -s -X POST --connect-timeout 5 http://localhost:8570/api/sync/refresh >/dev/null 2>&1 &
fi

cd "$BACKEND"
PYTHONPATH=. "$PY" analyze.py "$@"
