#!/bin/bash
set -euo pipefail

ROOT="$HOME/.dodaios"
PY="$ROOT/.venv/bin/python"
PATCH_MANAGER="$ROOT/ja_patches/apply_ja_patches.py"

echo "===== JA MACOS UPDATE ====="
echo "CHANNEL=stable"
echo "PLATFORM=macos"
echo "VERSION=0.1.0"

if [ ! -x "$PY" ]; then
  echo "Python do JA nao encontrado: $PY" >&2
  exit 1
fi

if [ ! -f "$PATCH_MANAGER" ]; then
  echo "Patch manager do JA nao encontrado: $PATCH_MANAGER" >&2
  exit 1
fi

"$PY" "$PATCH_MANAGER"

echo "JA_MACOS_UPDATE=OK"
