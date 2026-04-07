#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/mobile-flutter"
DEFAULT_FLUTTER_BIN="/Users/west/dev/env/flutter/bin/flutter"
FLUTTER_BIN="${FLUTTER_BIN:-flutter}"

if [[ "$FLUTTER_BIN" == "flutter" && -x "$DEFAULT_FLUTTER_BIN" ]]; then
  FLUTTER_BIN="$DEFAULT_FLUTTER_BIN"
fi

cd "$APP_DIR"

"$FLUTTER_BIN" pub get
"$FLUTTER_BIN" analyze
"$FLUTTER_BIN" test
