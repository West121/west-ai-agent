#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/mobile-flutter"
LOCAL_PROPERTIES="$APP_DIR/android/local.properties"
DEFAULT_FLUTTER_BIN="/Users/west/dev/env/flutter/bin/flutter"
FLUTTER_BIN="${FLUTTER_BIN:-flutter}"
RECOMMENDED_NDK_VERSION="28.2.13676358"
ACTION="check"

if [[ ${1:-} == "--fix" ]]; then
  ACTION="fix"
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "mobile-flutter app directory not found: $APP_DIR" >&2
  exit 1
fi

if [[ "$FLUTTER_BIN" == "flutter" && -x "$DEFAULT_FLUTTER_BIN" ]]; then
  FLUTTER_BIN="$DEFAULT_FLUTTER_BIN"
fi

if ! command -v "$FLUTTER_BIN" >/dev/null 2>&1; then
  echo "flutter not found: set FLUTTER_BIN or add flutter to PATH" >&2
  exit 1
fi

SDK_DIR="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [[ -z "$SDK_DIR" && -f "$LOCAL_PROPERTIES" ]]; then
  SDK_DIR="$(grep -E '^sdk\.dir=' "$LOCAL_PROPERTIES" | head -1 | cut -d= -f2-)"
fi

if [[ -z "$SDK_DIR" ]]; then
  echo "Android SDK directory not found. Set ANDROID_SDK_ROOT/ANDROID_HOME or apps/mobile-flutter/android/local.properties." >&2
  exit 1
fi

if [[ ! -d "$SDK_DIR" ]]; then
  echo "Android SDK directory does not exist: $SDK_DIR" >&2
  exit 1
fi

SDKMANAGER=""
for candidate in \
  "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" \
  "$SDK_DIR/cmdline-tools/bin/sdkmanager"; do
  if [[ -x "$candidate" ]]; then
    SDKMANAGER="$candidate"
    break
  fi
done

if [[ -z "$SDKMANAGER" ]]; then
  SDKMANAGER="$(find "$SDK_DIR/cmdline-tools" -name sdkmanager -type f 2>/dev/null | head -1 || true)"
fi

if [[ -z "$SDKMANAGER" || ! -x "$SDKMANAGER" ]]; then
  echo "sdkmanager not found under $SDK_DIR/cmdline-tools." >&2
  exit 1
fi

JAVA_BIN="$(command -v java || true)"
if [[ -z "$JAVA_BIN" ]]; then
  echo "java not found on PATH." >&2
  exit 1
fi

BROKEN_NDKS=()
GOOD_NDKS=()
if [[ -d "$SDK_DIR/ndk" ]]; then
  while IFS= read -r -d '' ndk_dir; do
    if [[ -f "$ndk_dir/source.properties" ]]; then
      GOOD_NDKS+=("$(basename "$ndk_dir")")
    else
      BROKEN_NDKS+=("$ndk_dir")
    fi
  done < <(find "$SDK_DIR/ndk" -mindepth 1 -maxdepth 1 -type d -print0)
fi

cat <<REPORT
Flutter: $($FLUTTER_BIN --version | head -1)
Java: $($JAVA_BIN -version 2>&1 | head -1)
Android SDK: $SDK_DIR
sdkmanager: $SDKMANAGER
Known NDKs: ${GOOD_NDKS[*]:-none}
Broken NDK dirs: ${BROKEN_NDKS[*]:-none}
Recommended NDK: $RECOMMENDED_NDK_VERSION
REPORT

if [[ "$ACTION" == "fix" ]]; then
  if [[ ${#BROKEN_NDKS[@]} -gt 0 ]]; then
    printf '%s\n' "Removing broken NDK directories..."
    rm -rf "${BROKEN_NDKS[@]}"
  fi
  printf '%s\n' "Installing NDK side by side $RECOMMENDED_NDK_VERSION..."
  yes | "$SDKMANAGER" --install "ndk;$RECOMMENDED_NDK_VERSION"
fi

if [[ ! -f "$SDK_DIR/ndk/$RECOMMENDED_NDK_VERSION/source.properties" ]]; then
  cat <<EOF2
Android preflight failed:
- Required NDK $RECOMMENDED_NDK_VERSION is missing or incomplete.

Fix:
  rm -rf "$SDK_DIR/ndk/$RECOMMENDED_NDK_VERSION"
  yes | "$SDKMANAGER" --install 'ndk;$RECOMMENDED_NDK_VERSION'
EOF2
  exit 1
fi

echo "Android preflight OK"
