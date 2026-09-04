#!/usr/bin/env bash
# Copy Noto Sans glyphs (OFL) and Protomaps basemap sprites (MIT) into the delivery root.
set -euo pipefail
ROOT=${1:?delivery root}
TMP=$(mktemp -d)
git clone --depth 1 -q https://github.com/protomaps/basemaps-assets "$TMP/bma"
mkdir -p "$ROOT/fonts" "$ROOT/sprites/basemap"
cp -r "$TMP/bma/fonts/." "$ROOT/fonts/"
V=$(ls "$TMP/bma/sprites" | sort -V | tail -1)
rm -rf "$ROOT/sprites/basemap/$V"; cp -r "$TMP/bma/sprites/$V" "$ROOT/sprites/basemap/$V"
cp "$TMP/bma/fonts/OFL.txt" "$ROOT/fonts/OFL.txt" 2>/dev/null || true
rm -rf "$TMP"
echo "fonts -> $ROOT/fonts ; sprites -> $ROOT/sprites/basemap/$V"
