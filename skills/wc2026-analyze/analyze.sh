#!/usr/bin/env bash
set -euo pipefail

BACKEND=""

if [[ -n "${WC2026_BACKEND:-}" ]] && [[ -f "$WC2026_BACKEND/analyze.py" ]]; then
  BACKEND="$WC2026_BACKEND"
fi

if [[ -z "$BACKEND" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  CANDIDATES=(
    "$SCRIPT_DIR/../../backend"
    "$SCRIPT_DIR/../backend"
    "$HOME/worldcup-2026/backend"
    "$HOME/projects/worldcup-2026/backend"
    "$HOME/code/worldcup-2026/backend"
  )
  for p in "${CANDIDATES[@]}"; do
    if [[ -f "$p/analyze.py" ]]; then
      BACKEND="$p"
      break
    fi
  done
fi

if [[ -z "$BACKEND" ]]; then
  echo "❌ 找不到 worldcup-2026 项目"
  echo "   设置环境变量指向 backend 目录："
  echo "   export WC2026_BACKEND=/path/to/worldcup-2026/backend"
  exit 1
fi

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
