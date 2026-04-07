#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-debug}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/mobile-flutter"
DEFAULT_FLUTTER_BIN="/Users/west/dev/env/flutter/bin/flutter"
FLUTTER_BIN="${FLUTTER_BIN:-flutter}"

if [[ "$FLUTTER_BIN" == "flutter" && -x "$DEFAULT_FLUTTER_BIN" ]]; then
  FLUTTER_BIN="$DEFAULT_FLUTTER_BIN"
fi

if [[ "$MODE" != "debug" && "$MODE" != "release" ]]; then
  echo "Usage: $0 [debug|release]" >&2
  exit 1
fi

bash "$ROOT_DIR/scripts/mobile-flutter-android-preflight.sh"
cd "$APP_DIR"
"$FLUTTER_BIN" build apk "--$MODE"
