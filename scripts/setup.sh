#!/usr/bin/env bash
# 在 app/ 建置城市通：沒有 Flutter 3.47.6 就裝到 ~/Tools/flutter
set -euo pipefail

FLUTTER_VERSION="3.47.6"
FLUTTER_DIR="$HOME/Tools/flutter"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if command -v fvm >/dev/null && [ -f "$ROOT/app/.fvmrc" ]; then
  F="fvm flutter"; D="fvm dart"
  (cd "$ROOT/app" && fvm install)
else
  if ! command -v flutter >/dev/null || ! flutter --version 2>/dev/null | grep -q "$FLUTTER_VERSION"; then
    if [ ! -x "$FLUTTER_DIR/bin/flutter" ]; then
      mkdir -p "$HOME/Tools"
      git clone --depth 1 -b "$FLUTTER_VERSION" https://github.com/flutter/flutter.git "$FLUTTER_DIR"
    fi
    export PATH="$FLUTTER_DIR/bin:$PATH"
    grep -q 'Tools/flutter/bin' "$HOME/.zshrc" 2>/dev/null || echo 'export PATH="$HOME/Tools/flutter/bin:$PATH"' >> "$HOME/.zshrc"
  fi
  F="flutter"; D="dart"
fi

cd "$ROOT/app"
$F --version
$F pub get
$D run build_runner build --delete-conflicting-outputs
echo "✅ 完成。開模擬器或接手機後：cd app && $F run"
