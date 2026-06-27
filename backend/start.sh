#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-8570}"

if [[ -f .venv/bin/python ]]; then
  PY=".venv/bin/python"
else
  PY="python3"
fi

exec env PYTHONPATH=. "$PY" -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
